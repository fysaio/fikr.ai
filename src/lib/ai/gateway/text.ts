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
  // English
  /\b(kill|hurt|harm|cut)(ting)?\s+(myself|my\s*self|mysef)\b/i,
  /\bend(ing)?\s+(my\s+life|it\s+all)\b/i,
  /\b(take|taking)\s+my\s+own\s+life\b/i,
  /\bsuicid/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|wake\s+up)\b/i,
  /\b(want|wanna|wish)\s+(to\s+)?(die|be\s+dead|disappear\s+forever)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|go\s+on|going\s+on)\b/i,
  /\bcan'?t\s+(keep\s+going|go\s+on)\b/i,
  /\b(kill|hurt|harm)\s+(him|her|them|someone|somebody)\b/i,
  /\bbeing\s+(abused|beaten|raped)\b/i,
  // Nigerian Pidgin and mixed phrasing. "i no wan die" (I do not want to die) must NOT match.
  /\bi\s+no\s+wan\s+(live|dey\s+alive|be\s+alive)\b/i,
  /\bi\s+(don\s+)?tire\s+(for|to)\s+(this\s+)?(life|live)\b/i,
  /\bi\s+wan\s+(die|kill\s+(myself|mysef))\b/i,
  /\bi\s+(go|wan)\s+end\s+(my\s+life|myself|mysef)\b/i,
  /\bmake\s+i\s+die\b/i,
  /\blife\s+no\s+(dey\s+)?worth\s+(it|am|living)\b/i,
];

/** Cheap local safety gate. A hit skips the model and shows fixed, careful copy. */
export function looksLikeCrisis(text: string): boolean {
  if (!text) return false;
  return CRISIS.some((r) => r.test(text));
}

/** Short acknowledgements that never need a model reply. */
export function isTrivialAck(text: string, lastAssistant?: string | null): boolean {
  const t = normalizeForKey(text).replace(/[.!?]+$/g, '');
  // After a question or an offer, even "ok" or "yes" is an answer the model must see ("Want a reminder at 3?" "yes").
  if (lastAssistant && lastAssistant.trim().endsWith('?')) return false;
  // A bare yes or no with nothing before it has nothing to answer. After a statement it may still be meant as an answer.
  if (['yes', 'no', 'yeah', 'nope'].includes(t)) return !lastAssistant;
  if (['ok', 'okay', 'k', 'thanks', 'thank you', 'thx', 'cool', 'got it', 'alright', 'noted'].includes(t)) return true;
  return isThanksPhrase(t);
}

/** Words a plain thank-you may be made of. Anything outside this set ("for the reminder", "can you", a name) is real content. */
const THANKS_WORDS = new Set([
  'ok', 'okay', 'alright', 'cool', 'great', 'nice', 'good', 'perfect', 'got', 'it', 'noted', 'that', 'thats', 'this', 'is', 'helps', 'helpful', 'clear',
  'thanks', 'thank', 'you', 'thx', 'ty', 'cheers', 'many', 'appreciate', 'appreciated', 'much', 'so', 'very', 'really', 'a', 'lot', 'again', 'all',
]);
const THANKS_MARKERS = new Set(['thanks', 'thank', 'thx', 'ty', 'cheers', 'appreciate', 'appreciated']);

/**
 * "Ok thanks, that helps." and "great, thank you so much" need no model reply. The phrase must hold a thanks word and
 * nothing but small talk, stay short, and carry no question, so "thanks, can you also..." still reaches the model.
 */
function isThanksPhrase(t: string): boolean {
  if (t.includes('?')) return false;
  const words = t.replace(/[\u2019']/g, '').replace(/[^a-z\s]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 7) return false;
  return words.every((w) => THANKS_WORDS.has(w)) && words.some((w) => THANKS_MARKERS.has(w));
}
