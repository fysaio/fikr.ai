import type { FocusEntry, DaySummary } from './log.ts';

export interface YTask { id: string | number; title: string; kind?: string; contact_name?: string; at?: string; status?: string }
export interface YInput {
  now: Date;
  tasks: YTask[];
  done: Record<string | number, boolean>;
  doneAt: Record<string | number, string>;
  focus: FocusEntry[];
  days: DaySummary[];
  /** Tasks still open and visible today. */
  open: YTask[];
  guess?: { id: string; text: string } | null;
}

export type YCard =
  | { kind: 'intro' }
  | { kind: 'done'; items: string[] }
  | { kind: 'focus'; total: string; sessions: string[]; line: string }
  | { kind: 'people'; names: string[]; waiting: string[] }
  | { kind: 'guess'; id: string; text: string }
  | { kind: 'open'; items: Array<{ title: string; when: string }> }
  | { kind: 'close'; carry: number };

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const yesterdayOf = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
export const count = (n: number) => (n < WORDS.length ? WORDS[n] : String(n));

export function hoursMinutes(total: number): string {
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}`;
}

export function buildYesterday(i: YInput): YCard[] {
  const y = key(yesterdayOf(i.now));
  const cards: YCard[] = [{ kind: 'intro' }];

  const doneTasks = i.tasks.filter((t) => i.done[t.id] && i.doneAt[t.id] && key(new Date(i.doneAt[t.id])) === y);
  const closed = i.days.find((d) => d.date === y);
  const doneTitles = Array.from(new Set([...doneTasks.map((t) => t.title), ...(closed?.done || [])]));
  if (doneTitles.length) cards.push({ kind: 'done', items: doneTitles });

  const sessions = i.focus.filter((f) => key(new Date(f.at)) === y);
  if (sessions.length) {
    const total = sessions.reduce((s, f) => s + f.minutes, 0);
    const early = sessions.every((f) => new Date(f.at).getHours() < 12);
    const n = sessions.length;
    cards.push({
      kind: 'focus',
      total: hoursMinutes(total),
      sessions: sessions.map((f) => `${f.title} · ${f.minutes} min`),
      line: `minutes, in ${n === 1 ? 'one session' : `${count(n).toLowerCase()} sessions`}.${early ? (n === 1 ? ' Before noon.' : ' All before noon.') : ''}`,
    });
  }

  const reached = doneTasks.filter((t) => t.kind === 'follow' && t.contact_name).map((t) => t.contact_name as string);
  const waiting = i.open.filter((t) => t.kind === 'follow' && t.contact_name).map((t) => t.contact_name as string);
  if (reached.length || waiting.length) cards.push({ kind: 'people', names: Array.from(new Set(reached)), waiting: Array.from(new Set(waiting)) });

  if (i.guess) cards.push({ kind: 'guess', id: i.guess.id, text: i.guess.text });

  if (i.open.length) cards.push({ kind: 'open', items: i.open.map((t) => ({ title: t.title, when: t.at ? `Today, ${t.at}` : 'No time set yet' })) });

  cards.push({ kind: 'close', carry: i.open.length });
  return cards;
}
