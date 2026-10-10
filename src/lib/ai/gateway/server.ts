import { configureGateway } from './gateway.ts';
import { LayeredCache, MemoryCache } from './cache.ts';
import { SupabaseBudget, SupabaseCache, rateLimitSupabase } from './supabase-stores.ts';
import { dailyCap } from './budget.ts';
import { loadProviders, openAITransport } from './providers.ts';
import { recordCallMetric } from '../metrics';

/** Wires the gateway to Supabase. Import this from API routes only. Idempotent. */
let ready = false;
export function ensureGateway() {
  if (ready) return;
  const hasDb = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder'));
  configureGateway({
    providers: loadProviders(),
    transport: openAITransport,
    cache: new LayeredCache(new MemoryCache(), hasDb ? new SupabaseCache() : null),
    budget: hasDb ? new SupabaseBudget() : null,
    cap: dailyCap(),
    now: () => new Date(),
    onEvent: (e) => {
      // Content-free: ids, source and token counts only.
      recordCallMetric({ endpoint: `${e.task}:${e.source}`, model: e.usage.model ?? e.source, tokensIn: e.usage.tokensIn, tokensOut: e.usage.tokensOut, latencyMs: e.usage.latencyMs, success: e.source !== 'fallback', retried: e.usage.retried });
      if (process.env.NODE_ENV !== 'test') console.info('[ai]', e.task, e.version, e.source, e.reason ?? '', e.usage.tokensIn + '/' + e.usage.tokensOut);
    },
  });
  ready = true;
}

const mem = new Map<string, { n: number; reset: number }>();
/** Per-user, per-bucket limit. Shared across instances when the database is configured. */
export async function allow(userId: string, bucket: string, limit: number, windowSec = 60): Promise<boolean> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return rateLimitSupabase(userId, bucket, limit, windowSec);
  const k = `${userId}|${bucket}`, now = Date.now(), e = mem.get(k);
  if (!e || now > e.reset) { mem.set(k, { n: 1, reset: now + windowSec * 1000 }); return true; }
  return ++e.n <= limit;
}
