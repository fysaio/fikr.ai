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
  /** Which provider attempts failed and how. Content-free (status and short code). */
  detail?: string;
  usage: Usage;
}

const flight = new SingleFlight();

/** Listeners for every finished call. Content-free. The eval runner uses this to learn why a call fell back. */
const taps: Array<(e: GatewayEvent) => void> = [];
export function onGatewayEvent(fn: (e: GatewayEvent) => void) { taps.push(fn); }

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

const emptyUsage = (): Usage => ({ cachedIn: 0, tokensIn: 0, tokensOut: 0, latencyMs: 0, provider: null, model: null, retried: false });

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
  const day = dayKey(deps.now());
  const done = (r: TaskResult<Out>) => {
    const ev = { task: task.id, version: task.version, source: r.source, reason: r.reason, detail: r.detail, usage: r.usage };
    deps.onEvent?.(ev);
    for (const t of taps) { try { t(ev); } catch { /* a tap must never break a call */ } }
    // Free answers are counted too, so hit rates are measurable. Fire and forget; never slows or fails the call.
    if (deps.budget?.note && (r.source === 'rule' || r.source === 'cache')) void deps.budget.note(ctx.userId, day, task.id, r.source).catch(() => {});
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
    const fallback = (reason: string, usage: Usage = emptyUsage(), detail?: string) =>
      done({ data: finish(task.fallback(input), input), source: 'fallback', usage, reason, detail });

    if (deps.providers.length === 0) return fallback('no_provider');

    const messages: ChatMessage[] = [
      { role: 'system', content: task.system },
      { role: 'user', content: task.buildUser(input) },
    ];
    // Reserve the worst case up front so concurrent calls cannot overshoot the cap together.
    const reserve = estimateTokens(task.system) + estimateTokens(messages[1].content) + task.maxOutTokens;
    if (deps.budget) {
      let ok = true;
      try { ok = await deps.budget.reserve(ctx.userId, day, reserve, deps.cap); } catch { ok = true; /* never block the user on a metering outage */ }
      if (!ok) return fallback('budget');
    }

    const usage = emptyUsage();
    const started = Date.now();
    // One wall-clock cap for everything below. Without it two slow providers plus a repair can run for 3x
    // timeoutMs and outlive the serverless function, so the person sees an error instead of the fallback copy.
    const deadline = started + (task.totalTimeoutMs ?? Math.round(task.timeoutMs * 1.5));
    const MIN_CALL_MS = Math.min(1500, Math.floor(task.timeoutMs / 2));
    let result: Out | null = null;
    let reason = 'provider_failed';
    // One short token per failed attempt ("primary:400:json_validate_failed"). Status and code only, never the message.
    const attempts: string[] = [];

    for (const provider of deps.providers) {
      const left = deadline - Date.now();
      if (left < MIN_CALL_MS) { reason = 'timeout'; attempts.push('deadline'); break; }
      try {
        let resp = await deps.transport({ provider, messages, temperature: task.temperature, maxTokens: task.maxOutTokens, timeoutMs: Math.min(task.timeoutMs, left), json: true });
        usage.tokensIn += resp.tokensIn; usage.tokensOut += resp.tokensOut; usage.cachedIn += resp.cachedIn ?? 0; usage.provider = provider.name; usage.model = provider.model;

        let parsed = tryParse(task, resp.text);
        const leftForRepair = deadline - Date.now();
        if (!parsed.ok && task.repair && leftForRepair >= MIN_CALL_MS) {
          usage.retried = true;
          const repairMsgs: ChatMessage[] = [...messages, { role: 'assistant', content: resp.text.slice(0, 1500) }, { role: 'user', content: `Invalid output: ${parsed.error}. Return corrected JSON only.` }];
          resp = await deps.transport({ provider, messages: repairMsgs, temperature: 0, maxTokens: task.maxOutTokens, timeoutMs: Math.min(task.timeoutMs, leftForRepair), json: true });
          usage.tokensIn += resp.tokensIn; usage.tokensOut += resp.tokensOut; usage.cachedIn += resp.cachedIn ?? 0;
          parsed = tryParse(task, resp.text);
        }
        if (parsed.ok) { result = parsed.value; break; }
        reason = 'invalid_output';
        attempts.push(`${provider.name}:invalid_output`);
        // Bad JSON from one model is worth one try on the next provider.
      } catch (e) {
        const pe = e as { status?: number; code?: string };
        reason = pe?.status === 429 ? 'rate_limited' : 'provider_failed';
        attempts.push(`${provider.name}:${pe?.status ?? 'err'}${pe?.code ? `:${pe.code}` : ''}`);
        // fall through to next provider
      }
    }
    usage.latencyMs = Date.now() - started;

    if (deps.budget) {
      try { await deps.budget.settle(ctx.userId, day, task.id, reserve, { tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, cachedIn: usage.cachedIn, repaired: usage.retried, cacheHit: false, fallback: result === null }); } catch { /* best-effort */ }
    }
    if (result === null) return fallback(reason, usage, attempts.join(' ') || undefined);

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
