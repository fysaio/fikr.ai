/** Small pure helpers shared by the gateway. No imports, so they run anywhere. */

export function stripDashes(text: string): string {
  if (!text) return '';
  return text.replace(/[—–]/g, ' - ').replace(/\s{2,}/g, ' ').trim();
}

/** Rough token estimate. English averages about 4 chars per token; we round up. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.6);
}

export function normalizeForKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function clip(text: string, max: number): string {
  const t = (text || '').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

/** Deep-apply stripDashes to every string in a value. */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === 'string') return stripDashes(value) as unknown as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitizeDeep(v);
    return out as T;
  }
  return value;
}

/** Stable JSON: sorted keys, so equal inputs always hash equal. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

const CRISIS = [
  /\b(kill|hurt|harm)\s+(myself|my\s*self)\b/i,
  /\bend\s+(my\s+life|it\s+all)\b/i,
  /\bsuicid/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\b(kill|hurt|harm)\s+(him|her|them|someone|somebody)\b/i,
  /\bbeing\s+(abused|beaten|raped)\b/i,
];

/** Cheap local safety gate. A hit skips the model and shows fixed, careful copy. */
export function looksLikeCrisis(text: string): boolean {
  if (!text) return false;
  return CRISIS.some((r) => r.test(text));
}

/** Short acknowledgements that never need a model reply. */
export function isTrivialAck(text: string): boolean {
  const t = normalizeForKey(text).replace(/[.!?]+$/g, '');
  return ['ok', 'okay', 'k', 'thanks', 'thank you', 'thx', 'cool', 'got it', 'alright', 'noted', 'yes', 'no'].includes(t);
}
