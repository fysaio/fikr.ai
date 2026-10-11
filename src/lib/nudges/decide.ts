import { isQuiet, dayKey, type Settings } from '../settings/settings.ts';

/** The four kinds Fikr may start on its own. A reminder the person sets themselves is a different lane. */
export type NudgeKind = 'orientation' | 'moment' | 'reflection' | 'people';

export interface Candidate {
  kind: NudgeKind;
  /** Stable per thing, so the same thing is never sent twice. */
  key: string;
  /** The short fact. No emoji, no counts. */
  title: string;
  /** One line of why. */
  body: string;
  url: string;
  /** Higher goes first. */
  priority: number;
}

export interface Context {
  /** A Date whose local fields are the person's wall clock. See zonedNow. */
  now: Date;
  settings: Settings;
  /** Fikr-started nudges already sent on the person's local day. */
  sentToday: number;
  lastSentAt: Date | null;
  timerRunning: boolean;
  /** Nudges of each kind sent in the last 14 days that were never opened, counted from the newest back. */
  ignoredRun: Partial<Record<NudgeKind, number>>;
  sentKeys: Set<string>;
}

export const DAILY_CAP = 2;
export const MIN_GAP_MIN = 120;
export const IGNORE_LIMIT = 3;

export type Decision = { send: Candidate } | { silence: string };

/** Silence is the default. A nudge goes out only if every rule lets it. */
export function decide(candidates: Candidate[], ctx: Context): Decision {
  if (ctx.sentToday >= DAILY_CAP) return { silence: 'daily cap' };
  if (isQuiet(ctx.now, ctx.settings)) return { silence: 'quiet time' };
  if (ctx.timerRunning) return { silence: 'timer running' };
  if (ctx.lastSentAt && ctx.now.getTime() - ctx.lastSentAt.getTime() < MIN_GAP_MIN * 60000) return { silence: 'too soon after the last one' };

  const allowed = candidates
    .filter((c) => ctx.settings.speak[c.kind])
    .filter((c) => (ctx.ignoredRun[c.kind] || 0) < IGNORE_LIMIT)
    .filter((c) => !ctx.sentKeys.has(c.key))
    .sort((a, b) => b.priority - a.priority);
  return allowed.length ? { send: allowed[0] } : { silence: 'nothing worth it' };
}

/** A Date whose local fields match the wall clock in `tz`. Lets the same quiet-time code run on a server. */
export function zonedNow(now: Date, tz: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
  } catch { return now; }
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
}

export const localDay = (zoned: Date) => dayKey(zoned);
