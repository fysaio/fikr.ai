import { createClient } from '@supabase/supabase-js';
import type { BudgetStore } from './budget.ts';
import type { CacheStore } from './cache.ts';

/** Service-role client. Server only. These tables have RLS on and no policies, so only this client reaches them. */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('placeholder')) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class SupabaseCache implements CacheStore {
  async get(key: string) {
    const db = admin(); if (!db) return null;
    const { data } = await db.from('ai_cache').select('value, expires_at').eq('key', key).maybeSingle();
    if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
    void db.rpc('ai_cache_touch', { p_key: key });
    return data.value ?? null;
  }
  async set(key: string, value: unknown, ttlSec: number, meta: { userId: string | null; task: string; version: string }) {
    const db = admin(); if (!db) return;
    await db.from('ai_cache').upsert({ key, value, task: meta.task, version: meta.version, user_id: meta.userId, expires_at: new Date(Date.now() + ttlSec * 1000).toISOString() });
  }
}

export class SupabaseBudget implements BudgetStore {
  async reserve(userId: string, day: string, tokens: number, cap: number) {
    const db = admin(); if (!db) return true;
    const { data, error } = await db.rpc('ai_reserve_tokens', { p_user: userId, p_day: day, p_tokens: tokens, p_cap: cap });
    if (error) throw error;
    return Boolean(data);
  }
  async settle(userId: string, day: string, task: string, reserved: number, u: { tokensIn: number; tokensOut: number; cacheHit: boolean; fallback: boolean }) {
    const db = admin(); if (!db) return;
    const { error } = await db.rpc('ai_settle_usage', { p_user: userId, p_day: day, p_task: task, p_reserved: reserved, p_in: u.tokensIn, p_out: u.tokensOut, p_fallback: u.fallback });
    if (error) throw error;
  }
}

export async function rateLimitSupabase(userId: string, bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const db = admin(); if (!db) return true;
  const { data, error } = await db.rpc('ai_rate_hit', { p_user: userId, p_bucket: bucket, p_limit: limit, p_window_sec: windowSec });
  if (error) return true; // never lock users out because metering is down; the daily token cap still applies
  return Boolean(data);
}

export { admin as serviceClient };
