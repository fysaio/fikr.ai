export interface Settings {
  speak: { orientation: boolean; moment: boolean; reflection: boolean; people: boolean };
  quiet: { mornings: boolean; classes: boolean; prayer: boolean; evenings: boolean; weekends: boolean; late: boolean; lateFrom: string; lateTo: string };
  /** Local date (YYYY-MM-DD) the person chose to be left alone. */
  quietToday: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  speak: { orientation: true, moment: true, reflection: false, people: true },
  quiet: { mornings: false, classes: false, prayer: false, evenings: false, weekends: false, late: true, lateFrom: '22:00', lateTo: '07:00' },
  quietToday: null,
};

const KEY = 'fikr_settings_v1';

export function mergeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    speak: { ...DEFAULT_SETTINGS.speak, ...(r.speak || {}) },
    quiet: { ...DEFAULT_SETTINGS.quiet, ...(r.quiet || {}) },
    quietToday: typeof r.quietToday === 'string' ? r.quietToday : null,
  };
}

export function loadSettings(): Settings {
  try { return mergeSettings(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** True when Fikr must stay quiet right now. Late night may cross midnight. */
export function isQuiet(now: Date, s: Settings): boolean {
  if (s.quietToday === dayKey(now)) return true;
  const t = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  if (s.quiet.weekends && (day === 0 || day === 6)) return true;
  if (s.quiet.late) {
    const a = mins(s.quiet.lateFrom), b = mins(s.quiet.lateTo);
    if (a === b) return false;
    if (a < b ? t >= a && t < b : t >= a || t < b) return true;
  }
  if (s.quiet.mornings && t >= 5 * 60 && t < 9 * 60) return true;
  if (s.quiet.classes && day >= 1 && day <= 5 && t >= 9 * 60 && t < 15 * 60) return true;
  if (s.quiet.evenings && t >= 18 * 60 && t < 22 * 60) return true;
  return false;
}
