import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthedUser } from '@/lib/ai/gateway/auth';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_DEVICES = 5;

function validEndpoint(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 1000) return false;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}

/** Save this device's push subscription. Row level security keeps it to the signed-in person. */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Log in again.' }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  const keys = body?.keys;
  if (!validEndpoint(body?.endpoint) || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
    return NextResponse.json({ error: 'Bad subscription.' }, { status: 400, headers: NO_STORE });
  }
  const db = await createServerSupabaseClient();
  const { data: mine } = await db.from('push_subscriptions').select('id, endpoint, created_at').eq('user_id', user.id).order('created_at', { ascending: true });
  const rows = mine || [];
  if (!rows.some((r) => r.endpoint === body.endpoint) && rows.length >= MAX_DEVICES) {
    await db.from('push_subscriptions').delete().eq('id', rows[0].id); // drop the oldest device
  }
  const { error } = await db.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: body.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
    { onConflict: 'user_id,endpoint' }
  );
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

/** Remove this device. Called on logout and when nudges are turned off. */
export async function DELETE(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  const body = await req.json().catch(() => null);
  if (!validEndpoint(body?.endpoint)) return NextResponse.json({ error: 'Bad request.' }, { status: 400, headers: NO_STORE });
  const db = await createServerSupabaseClient();
  await db.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
