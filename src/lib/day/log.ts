// Small on-device log of finished focus sessions. Yesterday reads it. Cleared on logout (fikr_ prefix).
export interface FocusEntry { taskId: string; title: string; minutes: number; at: string }
const KEY = 'fikr_focus_log_v1';

export function readFocusLog(): FocusEntry[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function logFocus(e: Omit<FocusEntry, 'at'>): void {
  if (e.minutes < 1) return;
  try {
    const keep = readFocusLog().filter((x) => Date.now() - Date.parse(x.at) < 14 * 86400000);
    keep.push({ ...e, at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(keep));
  } catch { /* private mode */ }
}

/** What the person closed the day with. Yesterday reads it the next morning. */
export interface DaySummary { date: string; done: string[]; carried: string[]; letGo: string[]; note: string }
const DAY_KEY = 'fikr_day_log_v1';

export function readDays(): DaySummary[] {
  try { const v = JSON.parse(localStorage.getItem(DAY_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function writeDay(d: DaySummary): void {
  try {
    const keep = readDays().filter((x) => x.date !== d.date).slice(-13);
    keep.push(d);
    localStorage.setItem(DAY_KEY, JSON.stringify(keep));
  } catch { /* private mode */ }
}
