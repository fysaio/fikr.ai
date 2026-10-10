import { createHash } from 'node:crypto';
import { stableStringify } from './text.ts';

export interface CacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSec: number, meta: { userId: string | null; task: string; version: string }): Promise<void>;
}

export function cacheKey(parts: { task: string; version: string; scope: 'user' | 'global'; userId: string; input: unknown }): string {
  const scopeId = parts.scope === 'user' ? parts.userId : 'global';
  return createHash('sha256').update(`${parts.task}|${parts.version}|${scopeId}|${stableStringify(parts.input)}`).digest('hex');
}

/** Per-process LRU with TTL. Fast path; the database store is the shared one. */
export class MemoryCache implements CacheStore {
  private map = new Map<string, { v: unknown; exp: number }>();
  constructor(private max = 500, private now: () => number = Date.now) {}
  async get(key: string) {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.exp <= this.now()) { this.map.delete(key); return null; }
    this.map.delete(key); this.map.set(key, hit); // refresh LRU order
    return hit.v;
  }
  async set(key: string, value: unknown, ttlSec: number) {
    this.map.set(key, { v: value, exp: this.now() + ttlSec * 1000 });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
  get size() { return this.map.size; }
}

/** Two layers: memory first, shared store second. */
export class LayeredCache implements CacheStore {
  constructor(private l1: CacheStore, private l2: CacheStore | null) {}
  async get(key: string) {
    const a = await this.l1.get(key);
    if (a !== null) return a;
    if (!this.l2) return null;
    try {
      const b = await this.l2.get(key);
      if (b !== null) await this.l1.set(key, b, 300, { userId: null, task: '', version: '' });
      return b;
    } catch { return null; }
  }
  async set(key: string, value: unknown, ttlSec: number, meta: { userId: string | null; task: string; version: string }) {
    await this.l1.set(key, value, ttlSec, meta);
    if (this.l2) { try { await this.l2.set(key, value, ttlSec, meta); } catch { /* cache is best-effort */ } }
  }
}

/** Collapses concurrent identical calls into one. Double taps and outbox replays cost one call. */
export class SingleFlight {
  private inflight = new Map<string, Promise<unknown>>();
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const p = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }
}
