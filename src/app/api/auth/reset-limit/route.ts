import { NextResponse } from 'next/server';

// In-memory server cooldown map by client IP/identifier
const lastResetRequest = new Map<string, number>();

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local_user';
  const now = Date.now();
  const lastTime = lastResetRequest.get(ip);

  if (lastTime && now - lastTime < 30000) {
    const remaining = Math.ceil((30000 - (now - lastTime)) / 1000);
    return NextResponse.json(
      { error: 'Rate limit exceeded', remainingSeconds: remaining },
      { status: 429 }
    );
  }

  lastResetRequest.set(ip, now);
  return NextResponse.json({ ok: true });
}
