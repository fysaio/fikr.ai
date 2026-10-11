/**
 * Chat facts → Memory. Pure code, no model, no framework imports (so `npm test` can run it).
 *
 * Before this existed, every fact the chat extracted was added to Life as-is: the same thing said twice became two
 * memories, and "actually Aisha is my coursemate" sat next to the old line instead of replacing it.
 */

export type Confidence = 'known' | 'stated' | 'observed' | 'hypothesized';

/** The few Memory fields this module needs. A full `Memory` satisfies it. */
export interface MemoryLike {
  id: string | number;
  category: string;
  text: string;
  confidence?: Confidence | string;
  status?: string;
  gone?: boolean;
  rejected?: boolean;
  updated_at?: string;
}

export interface ChatFactLike {
  category: string;
  text: string;
  supersedes?: string | null;
}

export interface Reconciled<F extends ChatFactLike> {
  /** New memories to add. */
  add: F[];
  /** Existing memories whose text should be replaced (the person corrected them). */
  update: Array<{ id: string; text: string }>;
  /** Facts dropped as already known. */
  skipped: number;
}

const normalise = (s: string): string => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

/** Dice coefficient on character bigrams, 0..1. Same idea as lib/memory/pipeline.ts, without its imports. */
export function similarity(a: string, b: string): number {
  const x = normalise(a), y = normalise(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); }
    return m;
  };
  const gx = grams(x), gy = grams(y);
  let hit = 0;
  for (const [g, n] of gx) hit += Math.min(n, gy.get(g) ?? 0);
  return (2 * hit) / (x.length - 1 + (y.length - 1));
}

/** Memories the app still treats as live. Deleted, forgotten and rejected ones never count as known or as context. */
export const isLive = (m: MemoryLike): boolean => m.status !== 'deleted' && !m.gone && !m.rejected;

export const DUPLICATE_THRESHOLD = 0.85;

export function reconcileChatFacts<F extends ChatFactLike>(facts: F[], existing: MemoryLike[]): Reconciled<F> {
  const pool = existing.filter(isLive).map((m) => ({ id: String(m.id), category: m.category, text: m.text }));
  const out: Reconciled<F> = { add: [], update: [], skipped: 0 };

  for (const f of facts) {
    const text = (f.text ?? '').trim();
    if (text.length < 4) { out.skipped++; continue; }

    // A correction of a memory the person really has: replace its text, keep its history.
    const target = f.supersedes ? pool.find((m) => m.id === f.supersedes) : undefined;
    if (target) {
      if (similarity(target.text, text) >= DUPLICATE_THRESHOLD) { out.skipped++; continue; }
      out.update.push({ id: target.id, text });
      target.text = text; // later facts in this same reply compare against the corrected line
      continue;
    }

    // Already known (same category, nearly the same sentence), or said twice in this reply.
    if (pool.some((m) => m.category === f.category && similarity(m.text, text) >= DUPLICATE_THRESHOLD)) { out.skipped++; continue; }

    out.add.push({ ...f, text });
    pool.push({ id: `new_${pool.length}`, category: f.category, text });
  }
  return out;
}

/** Order in which stored memory is worth sending to the model when only a few lines fit. */
const CONTEXT_RANK: Record<string, number> = { commitments: 0, patterns: 1, people: 2, projects: 3, goals: 4, prefs: 5, places: 6, history: 7 };

/**
 * Builds the CONTEXT the chat sends: live memories only, most useful categories first, newest first inside a
 * category, each with its confidence so the model can tell a stated fact from a guess.
 */
export function buildChatContext(
  life: Record<string, MemoryLike[] | undefined> | null | undefined,
  limit = 20,
): Array<{ id: string; category: string; text: string; confidence: Confidence }> {
  const rows = Object.entries(life ?? {}).flatMap(([category, items]) =>
    (items ?? []).filter(isLive).map((m) => ({
      id: String(m.id),
      category,
      text: m.text,
      confidence: (['known', 'stated', 'observed', 'hypothesized'].includes(String(m.confidence)) ? m.confidence : 'stated') as Confidence,
      at: m.updated_at ?? '',
    })),
  );
  rows.sort((a, b) => (CONTEXT_RANK[a.category] ?? 9) - (CONTEXT_RANK[b.category] ?? 9) || b.at.localeCompare(a.at));
  return rows.slice(0, limit).map(({ at: _at, ...r }) => r);
}
