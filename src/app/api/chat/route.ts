import { NextResponse } from 'next/server';
import { runChatTurn } from '@/lib/ai/chat';
import { getAuthedUser } from '@/lib/ai/gateway/auth';
import { allow, ensureGateway } from '@/lib/ai/gateway/server';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Log in again.' }, { status: 401, headers: NO_STORE });

  ensureGateway();
  if (!(await allow(user.id, 'chat', 20))) {
    return NextResponse.json({ error: 'Slow down for a moment.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '30' } });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE }); }
  const { message, history, context_facts } = body ?? {};
  if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400, headers: NO_STORE });
  if (message.length > 2000) return NextResponse.json({ error: 'Message is too long.' }, { status: 400, headers: NO_STORE });

  const hist = (Array.isArray(history) ? history : []).filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string').slice(-12);
  const ctx = (Array.isArray(context_facts) ? context_facts : []).filter((c: any) => c && typeof c.text === 'string').slice(0, 30)
    .map((c: any) => ({ id: String(c.id ?? '').slice(0, 80), category: String(c.category ?? '').slice(0, 30), text: String(c.text).slice(0, 400) }));

  try {
    const result = await runChatTurn(user.id, message, hist, ctx);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch {
    // Never show a raw error. Nothing the person wrote is lost: the client keeps it in the outbox.
    return NextResponse.json({ intent: 'heard', reply: "I've saved that. I couldn't think it through just now.", outcome_line: '', extracted_facts: [], safety: false, source: 'fallback' }, { headers: NO_STORE });
  }
}
