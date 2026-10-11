'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Memory, Task } from '@/types';
import { Button } from '@/components/fk';
import { visibleTasks } from '@/lib/today/derive';
import { readDays, readFocusLog } from '@/lib/day/log';
import { buildYesterday, count, yesterdayOf, type YCard } from '@/lib/day/yesterday';

/** A short run of cards. Tap the right side to go on, the left to go back. Nothing here is a score. */
export default function YesterdayPage() {
  const router = useRouter();
  const { state, updateLifeItem, showToast } = useApp();
  const [now, setNow] = useState<Date | null>(null);
  const [i, setI] = useState(0);
  const [logs, setLogs] = useState<{ focus: ReturnType<typeof readFocusLog>; days: ReturnType<typeof readDays> }>({ focus: [], days: [] });
  useEffect(() => { const t = setTimeout(() => { setNow(new Date()); setLogs({ focus: readFocusLog(), days: readDays() }); }, 0); return () => clearTimeout(t); }, []);

  const cards: YCard[] = useMemo(() => {
    if (!now) return [];
    const tasks = (state.tasks || []) as Task[];
    const guess = Object.values(state.life || {}).flat().find((m: Memory) => m.confidence === 'hypothesized' && !m.rejected && !m.gone && !m.snooze && m.status !== 'deleted');
    return buildYesterday({
      now, tasks, done: state.done, doneAt: state.doneAt || {}, focus: logs.focus, days: logs.days,
      open: visibleTasks(tasks, state.done, now), guess: guess ? { id: guess.id, text: guess.text } : null,
    });
  }, [now, state.tasks, state.done, state.doneAt, state.life, logs]);

  const last = cards.length - 1;
  const go = useCallback((d: number) => setI((p) => Math.min(last, Math.max(0, p + d))), [last]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') router.push('/today'); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go, router]);

  if (!now || cards.length === 0) return <div className="fk-screen" />;
  const c = cards[i];
  const date = yesterdayOf(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fk-screen fk-story">
      <div className="fk-story-bars" aria-hidden="true">{cards.map((_, n) => <i key={n} className={n <= i ? 'on' : ''} />)}</div>
      <div className="fk-story-top"><span>{date}</span><Link href="/today" className="fk-link">Close</Link></div>
      <div className="fk-story-body" aria-live="polite">
        {c.kind === 'intro' && <><p className="fk-eyebrow">Your morning read</p><h1 className="fk-display fk-story-h">Yesterday, <span className="fk-mark">in short.</span></h1><p className="fk-caption" style={{ fontSize: 16 }}>A few quick screens. Nothing here is a score.</p><p className="fk-caption">Tap the right side to continue. Tap the left to go back.</p></>}
        {c.kind === 'done' && <><h1 className="fk-display fk-story-h">You got <span className="fk-mark">done</span></h1><ul className="fk-story-list">{c.items.map((t) => <li key={t}>{t}</li>)}</ul></>}
        {c.kind === 'focus' && <><p className="fk-eyebrow">With the timer, you focused for</p><h1 className="fk-display fk-story-big">{c.total}</h1><p className="fk-caption" style={{ fontSize: 16 }}>{c.line}</p><ul className="fk-story-list">{c.sessions.map((s) => <li key={s}>{s}</li>)}</ul></>}
        {c.kind === 'people' && <>
          {c.names.length > 0 && <><h1 className="fk-display fk-story-h">You reached <span className="fk-mark">{c.names.length} {c.names.length === 1 ? 'person' : 'people'}</span></h1><ul className="fk-story-list">{c.names.map((n) => <li key={n}>{n}</li>)}</ul></>}
          {c.waiting.length > 0 && <p className="fk-caption" style={{ fontSize: 16 }}>{c.waiting.join(' and ')} {c.waiting.length === 1 ? 'is' : 'are'} still waiting on a reply. {c.waiting.length === 1 ? 'That one is' : 'Those are'} on your list for today.</p>}
        </>}
        {c.kind === 'guess' && <><p className="fk-eyebrow">A guess</p><h1 className="fk-display fk-story-h" style={{ fontSize: 28 }}>{c.text}</h1><p className="fk-caption" style={{ fontSize: 16 }}>I might be wrong. You tell me.</p>
          <div className="fk-actions"><Button variant="primary" hero onClick={() => { updateLifeItem(c.id, { confidence: 'stated', source: 'You confirmed this', evidence: [] }); showToast('Saved as something you told me'); go(1); }}>Feels true</Button><Button onClick={() => { updateLifeItem(c.id, { rejected: true, status: 'rejected' }); showToast("Okay. I won't say that again."); go(1); }}>Not really</Button></div></>}
        {c.kind === 'open' && <><h1 className="fk-display fk-story-h">Still <span className="fk-mark">open</span></h1><div className="fk-stack">{c.items.map((t) => <div key={t.title} className="fk-card"><small className="fk-label">Carried to today</small><b>{t.title}</b><small className="fk-label">{t.when}</small></div>)}</div></>}
        {c.kind === 'close' && <><h1 className="fk-display fk-story-h">That was <span className="fk-mark">yesterday.</span></h1><p className="fk-caption" style={{ fontSize: 16 }}>{c.carry > 0 ? `${count(c.carry)} ${c.carry === 1 ? 'thing carries' : 'things carry'} over. The rest is behind you.` : 'Nothing carries over.'}</p><p className="fk-caption">Anything today should know?</p>
          <div className="fk-actions"><Button variant="primary" hero href="/today?talk=1">Plan today</Button></div></>}
      </div>
      {c.kind !== 'close' && (
        <>
          <button type="button" className="fk-story-tap fk-story-prev" aria-label="Previous" onClick={() => go(-1)} disabled={i === 0} />
          <button type="button" className="fk-story-tap fk-story-next" aria-label="Next" onClick={() => go(1)} />
        </>
      )}
    </div>
  );
}
