import webpush from 'web-push';
import { serviceClient } from '../ai/gateway/supabase-stores.ts';
import { mergeSettings } from '../settings/settings.ts';
import { decide, zonedNow, localDay, type Context, type NudgeKind } from './decide.ts';
import { buildCandidates, type SrvPattern, type SrvTask } from './candidates.ts';

export interface RunSummary { users: number; sent: number; silent: Record<string, number>; removedSubscriptions: number; skipped?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IGNORED_AFTER_MS = 3 * 3600_000;

/** One pass of the sender. Called by the scheduled job. Server only. */
export async function runNudges(now = new Date()): Promise<RunSummary> {
  const out: RunSummary = { users: 0, sent: 0, silent: {}, removedSubscriptions: 0 };
  const db = serviceClient();
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!db) return { ...out, skipped: 'database not configured' };
  if (!pub || !priv) return { ...out, skipped: 'push keys not configured' };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@fikr.app', pub, priv);

  const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, keys').limit(2000);
  const byUser = new Map<string, NonNullable<typeof subs>>();
  for (const s of subs || []) byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]);

  for (const [userId, userSubs] of byUser) {
    out.users++;
    const { data: p } = await db.from('profiles').select('timezone, speak, quiet, quiet_today, focus_until').eq('id', userId).maybeSingle();
    if (!p) continue;
    const local = zonedNow(now, p.timezone || 'UTC');
    const day = localDay(local);

    const since = new Date(now.getTime() - 14 * 86400_000).toISOString();
    const { data: logs } = await db.from('nudge_log').select('type, key, sent_at, opened_at, local_day').eq('user_id', userId).gte('sent_at', since).order('sent_at', { ascending: false });
    const rows = logs || [];
    const ignoredRun: Partial<Record<NudgeKind, number>> = {};
    const done = new Set<string>();
    for (const r of rows) {
      const k = r.type as NudgeKind;
      if (done.has(k)) continue;
      if (r.opened_at) { done.add(k); continue; }
      if (now.getTime() - Date.parse(r.sent_at) >= IGNORED_AFTER_MS) ignoredRun[k] = (ignoredRun[k] || 0) + 1;
    }

    const ctx: Context = {
      now: local,
      settings: mergeSettings({ speak: p.speak, quiet: p.quiet, quietToday: p.quiet_today }),
      sentToday: rows.filter((r) => r.local_day === day).length,
      lastSentAt: rows[0] ? zonedNow(new Date(rows[0].sent_at), p.timezone || 'UTC') : null,
      timerRunning: Boolean(p.focus_until && Date.parse(p.focus_until) > now.getTime()),
      ignoredRun,
      sentKeys: new Set(rows.map((r) => r.key).filter((k): k is string => Boolean(k))),
    };

    const [{ data: tasks }, { data: pats }] = await Promise.all([
      db.from('tasks').select('id, title, starts_at, status, why, kind, contact_name, hidden_until').eq('user_id', userId).eq('status', 'open'),
      db.from('memories').select('id, text').eq('user_id', userId).eq('category', 'patterns').eq('confidence', 'hypothesized').eq('status', 'active').limit(1),
    ]);
    const candidates = buildCandidates({ now, local, day, tasks: (tasks || []) as SrvTask[], patterns: (pats || []) as SrvPattern[] });
    const d = decide(candidates, ctx);
    if ('silence' in d) { out.silent[d.silence] = (out.silent[d.silence] || 0) + 1; continue; }

    const n = d.send;
    const taskId = n.url.includes('focus=') ? n.url.split('focus=')[1] : null;
    const { data: logged, error } = await db.from('nudge_log').insert({ user_id: userId, type: n.kind, key: n.key, title: n.title, local_day: day, task_id: taskId && UUID.test(taskId) ? taskId : null }).select('id').single();
    if (error || !logged) { out.silent['already sent'] = (out.silent['already sent'] || 0) + 1; continue; }

    let delivered = 0;
    for (const s of userSubs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.key, nudge: logged.id }), { TTL: 3600 });
        delivered++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('id', s.id); out.removedSubscriptions++; }
      }
    }
    if (delivered) out.sent++;
    else await db.from('nudge_log').delete().eq('id', logged.id); // nothing arrived, so it does not count against the cap
  }
  return out;
}
