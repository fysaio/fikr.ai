import { clip } from './text.ts';

/** Keep only the last n turns, each clipped. Older turns are already captured as stored facts. */
export function recentTurns<T extends { q?: string; a?: string }>(history: T[], n = 3, maxChars = 500): Array<{ q: string; a: string }> {
  return history.slice(-n).map((h) => ({ q: clip(h.q ?? '', 160), a: clip(h.a ?? '', maxChars) }));
}

export interface CompactFact { id: string; category: string; entity?: string | null; value: string; due_text?: string | null }

/** One line per fact instead of a JSON object per fact. Roughly 60% fewer tokens. */
export function compactFacts(facts: CompactFact[], cap = 20, perFactChars = 140): string {
  if (facts.length === 0) return 'none';
  return facts
    .slice(-cap)
    .map((f) => `${f.id}|${f.category}|${f.entity ?? ''}|${clip(f.value, perFactChars)}${f.due_text ? `|due ${f.due_text}` : ''}`)
    .join('\n');
}

/** Small stable digest of fact ids and text, for cache keys. */
export function factsDigest(facts: CompactFact[]): string {
  let h = 5381;
  const s = facts.map((f) => `${f.id}:${f.value}`).join('\n');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
