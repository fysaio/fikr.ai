import { NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/ai/gateway/auth';
import { serviceClient } from '@/lib/ai/gateway/supabase-stores';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The person tapped a nudge. Marks it opened so it does not count as ignored. */
export async function POST(req: Request) {
  const user = await getAuthedUser();
  const body = await req.json().catch(() => null);
  if (!user || !UUID.test(String(body?.id))) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  const db = serviceClient();
  await db?.from('nudge_log').update({ opened_at: new Date().toISOString() }).eq('id', body.id).eq('user_id', user.id).is('opened_at', null);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
