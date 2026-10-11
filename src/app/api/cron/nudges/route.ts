import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runNudges } from '@/lib/nudges/send';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const NO_STORE = { 'Cache-Control': 'no-store' };

/** Scheduled job. Vercel cron sends `Authorization: Bearer $CRON_SECRET`. Returns counts only, never content. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured.' }, { status: 503, headers: NO_STORE });
  const got = Buffer.from(req.headers.get('authorization') || '');
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'No.' }, { status: 401, headers: NO_STORE });
  return NextResponse.json(await runNudges(), { headers: NO_STORE });
}
