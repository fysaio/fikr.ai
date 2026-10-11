import type { Candidate } from './decide.ts';
import { fmt12 } from '../today/derive.ts';

export interface SrvTask { id: string; title: string; starts_at: string | null; status: string; why: string | null; kind: string | null; contact_name: string | null; hidden_until: string | null }
export interface SrvPattern { id: string; text: string }

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const hhmm = (d: Date) => fmt12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);

/**
 * Plain rules, no model call, so nudges cost no tokens. `now` is the real instant, `local` the person's wall clock.
 * Titles are the short fact. Bodies are one line of why.
 */
export function buildCandidates(i: { now: Date; local: Date; day: string; tasks: SrvTask[]; patterns: SrvPattern[] }): Candidate[] {
  const out: Candidate[] = [];
  const open = i.tasks.filter((t) => t.status === 'open' && !(t.hidden_until && new Date(t.hidden_until) > i.now));
  const timed = open.filter((t) => t.starts_at).sort((a, b) => Date.parse(a.starts_at as string) - Date.parse(b.starts_at as string));

  // Orientation: once, in the morning, led by the first thing that matters.
  const h = i.local.getHours() + i.local.getMinutes() / 60;
  if (h >= 7.5 && h < 10 && open.length) {
    const first = timed.find((t) => Date.parse(t.starts_at as string) > i.now.getTime()) || open[0];
    const when = first.starts_at ? `At ${hhmm(new Date(first.starts_at))}. ` : '';
    out.push({ kind: 'orientation', key: `orientation:${i.day}`, title: `First up: ${clip(first.title, 60)}`, body: clip(`${when}${first.why || ''}`.trim() || 'Your day is ready.', 110), url: '/today', priority: 3 });
  }

  for (const t of timed) {
    const mins = Math.round((Date.parse(t.starts_at as string) - i.now.getTime()) / 60000);
    // Right moment: a planned thing is close and has not been started.
    if ((t.kind === 'due' || t.kind === 'free') && mins >= 10 && mins <= 60) {
      out.push({ kind: 'moment', key: `moment:${t.id}`, title: `${clip(t.title, 60)} in ${mins} minutes`, body: clip(t.why || 'Want this window for it?', 110), url: `/today?focus=${t.id}`, priority: 4 });
    }
    // People: someone is waiting and the time has come.
    if (t.kind === 'follow' && t.contact_name && mins <= 0 && mins > -360) {
      out.push({ kind: 'people', key: `people:${t.id}`, title: `${t.contact_name} is waiting on a reply`, body: clip(t.why || 'You said you would.', 110), url: `/today?focus=${t.id}`, priority: 5 });
    }
  }

  // Reflection: a guess, as a question. Off unless the person turned it on.
  const g = i.patterns[0];
  if (g) out.push({ kind: 'reflection', key: `reflection:${g.id}`, title: 'A guess about your week', body: clip(`${g.text} Does that feel true?`, 110), url: '/today', priority: 1 });

  return out;
}
