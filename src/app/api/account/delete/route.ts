import { NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/ai/gateway/auth';
import { serviceClient } from '@/lib/ai/gateway/supabase-stores';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

/** Every table that holds rows keyed by user_id. The login itself is removed last. */
const USER_TABLES = [
  'memories', 'tasks', 'entries', 'focus_sessions', 'checkins', 'push_subscriptions', 'nudge_log',
  'entities', 'facts', 'suppressions', 'think_entries', 'interventions', 'onboarding_state', 'events',
  'ai_cache', 'ai_usage', 'ai_budget', 'ai_rate',
];

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Log in again.' }, { status: 401, headers: NO_STORE });

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (body.confirm !== 'delete') return NextResponse.json({ error: 'Type delete to confirm.' }, { status: 400, headers: NO_STORE });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: 'Deleting is not available right now.' }, { status: 503, headers: NO_STORE });

  // A missing table is fine. A failed delete on a real table is not, so report it and stop before removing the login.
  const failed: string[] = [];
  for (const table of USER_TABLES) {
    const { error } = await db.from(table).delete().eq('user_id', user.id);
    if (error && !/does not exist|schema cache/i.test(error.message)) failed.push(table);
  }
  const { error: pErr } = await db.from('profiles').delete().eq('id', user.id);
  if (pErr) failed.push('profiles');
  if (failed.length) return NextResponse.json({ error: 'Some of your data could not be deleted. Nothing was removed from your account. Try again.', failed }, { status: 500, headers: NO_STORE });

  const { error: aErr } = await db.auth.admin.deleteUser(user.id);
  if (aErr) return NextResponse.json({ error: 'Your data is deleted but the login could not be removed. Try again.' }, { status: 500, headers: NO_STORE });

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
