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
