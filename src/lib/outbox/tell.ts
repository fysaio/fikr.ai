import { outboxAdd, outboxList, outboxRemove } from './outbox';

export interface TellFact { id: string; category: string; text: string }
export interface TellReply { intent: string; reply: string; outcome_line?: string; extracted_facts: TellFact[]; safety?: boolean }
export type TellOutcome = { ok: true; data: TellReply } | { ok: false; queued: boolean };

export interface TellContext { history: Array<{ role: 'user' | 'assistant'; text: string }>; facts: TellFact[] }

async function post(text: string, ctx: TellContext): Promise<TellReply | null> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: ctx.history.slice(-3), context_facts: ctx.facts.slice(0, 20) }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TellReply;
  } catch { return null; }
}

/** Send now, or park in the outbox if offline or the call fails. The text is never lost. */
export async function tell(text: string, ctx: TellContext): Promise<TellOutcome> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await outboxAdd(text).catch(() => {});
    return { ok: false, queued: true };
  }
  const data = await post(text, ctx);
  if (data) return { ok: true, data };
  await outboxAdd(text).catch(() => {});
  return { ok: false, queued: true };
}

let flushing = false;
/** Send everything waiting, oldest first. Stops at the first failure. Returns the number sent. */
export async function flushOutbox(ctx: TellContext, onReply: (r: TellReply) => void): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of await outboxList()) {
      const data = await post(item.text, ctx);
      if (!data) break;
      await outboxRemove(item.id);
      onReply(data);
      sent++;
    }
  } finally { flushing = false; }
  return sent;
}
