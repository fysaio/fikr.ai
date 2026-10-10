'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { tell, type TellContext, type TellReply } from '@/lib/outbox/tell';

interface Msg { id: string; role: 'user' | 'assistant'; text: string; queued?: boolean }

/** Tell Fikr. The thread lives in this component only. Close it and it is gone. */
export function ChatSheet({ open, onClose: close, getContext, onFacts }: {
  open: boolean;
  onClose: () => void;
  getContext: () => TellContext['facts'];
  onFacts: (r: TellReply) => void;
}) {
  const onClose = () => { setMsgs([]); setText(''); close(); };
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMsgs([]); setText(''); close(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, close]);

  if (!open) return null;

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    const id = `u_${Date.now()}`;
    const history = msgs.filter((m) => !m.queued).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { id, role: 'user', text: t }]);
    setText('');
    setBusy(true);
    const r = await tell(t, { history, facts: getContext() });
    setBusy(false);
    if (r.ok) {
      onFacts(r.data);
      setMsgs((m) => [...m, { id: `a_${Date.now()}`, role: 'assistant', text: r.data.reply }]);
    } else {
      setMsgs((m) => [
        ...m.map((x) => (x.id === id ? { ...x, queued: true } : x)),
        { id: `a_${Date.now()}`, role: 'assistant', text: "Saved. I'll send it when you're back online." },
      ]);
    }
  }

  return (
    <div className="fk-sheet-wrap" role="dialog" aria-modal="true" aria-label="Tell Fikr">
      <button className="fk-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="fk-sheet">
        <div className="fk-sheet-head">
          <b>Tell Fikr</b>
          <button className="fk-iconbtn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="fk-sheet-body">
          {msgs.length === 0 && <p className="fk-sheet-empty">Tell me what is on your mind. A time, a task, something to remember.</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`fk-bubble fk-bubble-${m.role}`}>
              {m.text}{m.queued && <small> · waiting to send</small>}
            </div>
          ))}
          {busy && <div className="fk-bubble fk-bubble-assistant fk-typing" aria-label="Fikr is thinking">…</div>}
          <div ref={end} />
        </div>
        <form className="fk-sheet-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea
            ref={input} value={text} rows={1} maxLength={2000} placeholder="Tell Fikr…" aria-label="Message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button type="submit" className="fk-send" aria-label="Send" disabled={!text.trim() || busy}><Icon name="send" /></button>
        </form>
      </div>
    </div>
  );
}
