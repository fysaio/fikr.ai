import { cacheKey, LayeredCache, MemoryCache, SingleFlight, type CacheStore } from './cache.ts';
import { dailyCap, dayKey, type BudgetStore } from './budget.ts';
import { extractJSON, loadProviders, openAITransport } from './providers.ts';
import { estimateTokens, looksLikeCrisis, sanitizeDeep } from './text.ts';
import type { ChatMessage, ProviderConfig, TaskDef, TaskResult, Transport, Usage } from './types.ts';

export interface GatewayDeps {
  providers: ProviderConfig[];
  transport: Transport;
  cache: CacheStore;
  budget: BudgetStore | null;
  now: () => Date;
  cap: number;
  /** Content-free event hook (metrics). */
  onEvent?: (e: GatewayEvent) => void;
}

export interface GatewayEvent {
  task: string;
  version: string;
  source: TaskResult<unknown>['source'];
  reason?: string;
  usage: Usage;
}

const flight = new SingleFlight();

let defaultDeps: GatewayDeps | null = null;
export function configureGateway(deps: Partial<GatewayDeps>) {
  defaultDeps = { ...getDefaultDeps(), ...deps };
}
export function getDefaultDeps(): GatewayDeps {
  if (defaultDeps) return defaultDeps;
  defaultDeps = {
    providers: loadProviders(),
    transport: openAITransport,
    cache: new LayeredCache(new MemoryCache(), null),
    budget: null,
    now: () => new Date(),
    cap: dailyCap(),
  };
  return defaultDeps;
}

const emptyUsage = (): Usage => ({ tokensIn: 0, tokensOut: 0, latencyMs: 0, provider: null, model: null, retried: false });

/**
 * The only door to a model. Order of work, cheapest first:
 *  1. validate input   2. safety gate   3. plain-code shortcut   4. cache
 *  5. single-flight    6. budget                7. provider chain with one repair   8. fixed fallback
 */
export async function runTask<In, Out>(
  task: TaskDef<In, Out>,
  rawInput: unknown,
  ctx: { userId: string },
  deps: GatewayDeps = getDefaultDeps()
): Promise<TaskResult<Out>> {
  const done = (r: TaskResult<Out>) => {
    deps.onEvent?.({ task: task.id, version: task.version, source: r.source, reason: r.reason, usage: r.usage });
    return r;
  };
  const finish = (out: Out, input: In) => sanitizeDeep(task.finalize ? task.finalize(out, input) : out);

  const parsedIn = task.inputSchema.safeParse(rawInput);
  if (!parsedIn.success) throw new GatewayInputError(task.id);
  const input = parsedIn.data;

  // Safety first. A message that is both "overwhelmed" and a crisis must get the careful copy, not a venting shortcut.
  if (task.safe && task.userText && looksLikeCrisis(task.userText(input))) {
    return done({ data: finish(task.safe(input), input), source: 'rule', usage: emptyUsage(), reason: 'safety' });
  }

  const short = task.shortcut?.(input) ?? null;
  if (short) return done({ data: finish(short, input), source: 'rule', usage: emptyUsage() });

  const key = task.cache ? cacheKey({ task: task.id, version: task.version, scope: task.cache.scope, userId: ctx.userId, input: task.cache.keyOf(input) }) : null;
  if (key) {
    const hit = await deps.cache.get(key);
    if (hit !== null) {
      const v = task.outputSchema.safeParse(hit);
      if (v.success) return done({ data: v.data, source: 'cache', usage: emptyUsage() });
    }
  }

  const run = async (): Promise<TaskResult<Out>> => {
    const fallback = (reason: string, usage: Usage = emptyUsage()) =>
      done({ data: finish(task.fallback(input), input), source: 'fallback', usage, reason });

    if (deps.providers.length === 0) return fallback('no_provider');

    const messages: ChatMessage[] = [
      { role: 'system', content: task.system },
      { role: 'user', content: task.buildUser(input) },
    ];
    // Reserve the worst case up front so concurrent calls cannot overshoot the cap together.
    const reserve = estimateTokens(task.system) + estimateTokens(messages[1].content) + task.maxOutTokens;
    const day = dayKey(deps.now());
    if (deps.budget) {
      let ok = true;
      try { ok = await deps.budget.reserve(ctx.userId, day, reserve, deps.cap); } catch { ok = true; /* never block the user on a metering outage */ }
      if (!ok) return fallback('budget');
    }

    const usage = emptyUsage();
    const started = Date.now();
    let result: Out | null = null;
    let reason = 'provider_failed';

    for (const provider of deps.providers) {
      try {
        let resp = await deps.transport({ provider, messages, temperature: task.temperature, maxTokens: task.maxOutTokens, timeoutMs: task.timeoutMs, json: true });
        usage.tokensIn += resp.tokensIn; usage.tokensOut += resp.tokensOut; usage.provider = provider.name; usage.model = provider.model;

        let parsed = tryParse(task, resp.text);
        if (!parsed.ok && task.repair) {
          usage.retried = true;
          const repairMsgs: ChatMessage[] = [...messages, { role: 'assistant', content: resp.text.slice(0, 1500) }, { role: 'user', content: `Invalid output: ${parsed.error}. Return corrected JSON only.` }];
          resp = await deps.transport({ provider, messages: repairMsgs, temperature: 0, maxTokens: task.maxOutTokens, timeoutMs: task.timeoutMs, json: true });
          usage.tokensIn += resp.tokensIn; usage.tokensOut += resp.tokensOut;
          parsed = tryParse(task, resp.text);
        }
        if (parsed.ok) { result = parsed.value; break; }
        reason = 'invalid_output';
        // Bad JSON from one model is worth one try on the next provider.
      } catch (e) {
        reason = (e as { status?: number })?.status === 429 ? 'rate_limited' : 'provider_failed';
        // fall through to next provider
      }
    }
    usage.latencyMs = Date.now() - started;

    if (deps.budget) {
      try { await deps.budget.settle(ctx.userId, day, task.id, reserve, { tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, cacheHit: false, fallback: result === null }); } catch { /* best-effort */ }
    }
    if (result === null) return fallback(reason, usage);

    const final = finish(result, input);
    if (key && task.cache) await deps.cache.set(key, final, task.cache.ttlSec, { userId: task.cache.scope === 'user' ? ctx.userId : null, task: task.id, version: task.version });
    return done({ data: final, source: 'model', usage });
  };

  return key ? flight.run(key, run) : run();
}

function tryParse<In, Out>(task: TaskDef<In, Out>, text: string): { ok: true; value: Out } | { ok: false; error: string } {
  let json: unknown;
  try { json = extractJSON(text); } catch { return { ok: false, error: 'not valid JSON' }; }
  const v = task.outputSchema.safeParse(json);
  if (v.success) return { ok: true, value: v.data };
  return { ok: false, error: v.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ') };
}

export class GatewayInputError extends Error {
  constructor(public task: string) { super(`Invalid input for task ${task}`); }
}
