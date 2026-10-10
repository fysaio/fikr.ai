/** Pure helpers for Today. No React, no storage, so they are easy to test. */

export interface TodayTask {
  id: string | number;
  title: string;
  at?: string;
  dur?: number;
  duration_min?: number;
  why?: string;
  status?: 'open' | 'done' | 'moved';
  kind?: 'follow' | 'due' | 'free';
  tag_text?: string;
  contact_name?: string;
  contact_phone?: string;
  hidden_until?: string;
}

/** '10:15' -> '10:15 AM'. Anything unparseable is returned as is. */
export function fmt12(hhmm?: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return hhmm || '';
  let h = Number(m[1]);
  const min = m[2];
  if (h > 23) return hhmm || '';
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

export function minutesOfDay(hhmm?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Open, not done, not snoozed. Sorted by time of day; untimed tasks last. */
export function visibleTasks<T extends TodayTask>(tasks: T[], done: Record<string | number, boolean>, now: Date): T[] {
  return tasks
    .filter((t) => t.status !== 'done' && t.status !== 'moved' && !done[t.id])
    .filter((t) => !t.hidden_until || new Date(t.hidden_until).getTime() <= now.getTime())
    .sort((a, b) => (minutesOfDay(a.at) ?? 1e9) - (minutesOfDay(b.at) ?? 1e9));
}

/** One task that starts within the window (default 15 minutes, and not already 10 minutes past). */
export function soonTask<T extends TodayTask>(tasks: T[], now: Date, windowMin = 15): T | null {
  const n = nowMinutes(now);
  for (const t of tasks) {
    const at = minutesOfDay(t.at);
    if (at === null) continue;
    if (at - n <= windowMin && at - n >= -10) return t;
  }
  return null;
}

/** Digits only, for wa.me. Nigerian local numbers (080...) become 234... . */
export function waDigits(phone?: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : null;
}
export const waLink = (phone?: string) => { const d = waDigits(phone); return d ? `https://wa.me/${d}` : null; };
export const telLink = (phone?: string) => { const d = waDigits(phone); return d ? `tel:+${d}` : null; };

/** Evening card shows from eveningAt (minutes, default 8:30 PM) until the person closes the day. */
export function isEvening(now: Date, eveningAt = 20 * 60 + 30): boolean {
  return nowMinutes(now) >= eveningAt;
}

export function snoozeUntil(kind: 'evening' | 'tomorrow', now: Date): Date {
  const d = new Date(now);
  if (kind === 'evening') { d.setHours(18, 0, 0, 0); if (d <= now) d.setTime(now.getTime() + 60 * 60 * 1000); return d; }
  d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function firstName(name?: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/** Tidy a typed number. Returns digits for links and a spaced display form, or null if it is not a number. */
export function tidyPhone(input: string): { digits: string; display: string } | null {
  const d = waDigits(input);
  if (!d) return null;
  const display = d.startsWith('234') && d.length === 13 ? `+234 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : `+${d}`;
  return { digits: d, display };
}
