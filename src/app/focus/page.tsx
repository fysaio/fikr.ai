'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { Button, Modal, Screen } from '@/components/fk';
import { mmss } from '@/lib/today/derive';
import { logFocus } from '@/lib/day/log';

const R = 90;
const C = 2 * Math.PI * R;

function Pick({ task }: { task: Task }) {
  const router = useRouter();
  const { setFocusTimer } = useApp();
  const suggested = Math.max(5, Math.round((task.duration_min || task.dur || 25) / 5) * 5);
  const [mins, setMins] = useState(suggested);
  const step = (d: number) => setMins((m) => Math.min(180, Math.max(5, m + d)));
  const start = () => {
    const total = mins * 60;
    setFocusTimer({ task, total, left: total, end: Date.now() + total * 1000, paused: false });
    router.replace('/focus');
  };
  return (
    <Screen>
      <Link href="/today" className="fk-link">Today</Link>
      <h1 className="fk-display fk-item-h">How long?</h1>
      <p className="fk-caption">{task.title}</p>
      <div className="fk-pick">
        <button type="button" className="fk-iconbtn" aria-label="5 minutes less" onClick={() => step(-5)}>−</button>
        <input className="fk-pick-n" inputMode="numeric" aria-label="Minutes" value={mins} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setMins(Number.isNaN(n) ? 5 : Math.min(180, n)); }} />
        <button type="button" className="fk-iconbtn" aria-label="5 minutes more" onClick={() => step(5)}>+</button>
      </div>
      <p className="fk-caption" style={{ textAlign: 'center' }}>min. Type a number, or tap − and + for 5 minutes.</p>
      <div className="fk-actions" style={{ marginTop: 24 }}><Button variant="primary" hero block onClick={start}>Start {mins} minutes</Button></div>
    </Screen>
  );
}

function Running() {
  const router = useRouter();
  const { focusTimer, setFocusTimer } = useApp();
  const [nowMs, setNowMs] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!focusTimer || focusTimer.paused) return;
    const t0 = setTimeout(() => setNowMs(Date.now()), 0);
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [focusTimer]);

  const left = !focusTimer ? 0 : focusTimer.paused || !nowMs ? focusTimer.left : Math.max(0, Math.ceil((focusTimer.end - nowMs) / 1000));

  useEffect(() => { if (focusTimer && !focusTimer.paused && nowMs && left <= 0) router.replace('/focus-end'); }, [left, nowMs, focusTimer, router]);

  if (!focusTimer) return null;
  const paused = focusTimer.paused;
  const done = Math.round((focusTimer.total - left) / 60);

  const toggle = () => setFocusTimer((p) => (p ? (p.paused ? { ...p, paused: false, end: Date.now() + p.left * 1000 } : { ...p, paused: true, left }) : p));
  const endNow = () => { logFocus({ taskId: String(focusTimer.task.id), title: focusTimer.task.title, minutes: done }); setFocusTimer(null); router.replace('/today'); };

  return (
    <Screen overlay={confirmEnd ? (
      <Modal title="End this timer?" onClose={() => setConfirmEnd(false)}>
        <p>You&apos;ve focused {done} {done === 1 ? 'minute' : 'minutes'}. I&apos;ll keep that.</p>
        <div className="fk-actions"><Button variant="primary" hero onClick={endNow}>End and keep {done} min</Button><Button onClick={() => setConfirmEnd(false)}>Keep going</Button></div>
      </Modal>
    ) : undefined}>
      <div className="fk-item-foot" style={{ marginTop: 0 }}>
        <Link href="/today" className="fk-link">Today</Link>
        <button type="button" className="fk-link" onClick={() => setConfirmEnd(true)}>End</button>
      </div>
      <p className="fk-eyebrow" style={{ textAlign: 'center' }}>{paused ? 'Paused on' : 'Focusing on'}</p>
      <h1 className="fk-display fk-item-h" style={{ textAlign: 'center', fontSize: 28 }}>{focusTimer.task.title}</h1>
      <div className="fk-ring" role="timer" aria-label={`${mmss(left)} left`}>
        <svg width="240" height="240" viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--fk-tint)" strokeWidth="16" />
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--fk-lime)" strokeWidth="16" strokeLinecap="round" transform="rotate(-90 110 110)" strokeDasharray={C} strokeDashoffset={C * (1 - (focusTimer.total > 0 ? left / focusTimer.total : 0))} />
        </svg>
        <div className="fk-ring-t"><b>{mmss(left)}</b><small>{paused ? 'paused' : `of ${Math.round(focusTimer.total / 60)} min`}</small></div>
      </div>
      <div className="fk-actions" style={{ justifyContent: 'center', marginTop: 20 }}><Button variant="primary" hero onClick={toggle}>{paused ? 'Resume' : 'Pause'}</Button></div>
      <p className="fk-caption" style={{ textAlign: 'center', marginTop: 16 }}>Go to Today. It keeps running.</p>
    </Screen>
  );
}

function FocusContent() {
  const params = useSearchParams();
  const { state, focusTimer } = useApp();
  const pickId = params.get('task');
  const title = params.get('title');
  const task = useMemo<Task | undefined>(() => {
    if (pickId) return (state.tasks || []).find((t) => String(t.id) === pickId);
    if (title) return { id: `t_${title.slice(0, 24)}`, title, why: '', status: 'open', duration_min: 25, source: 'user' } as unknown as Task;
    return undefined;
  }, [pickId, title, state.tasks]);
  if (task && !focusTimer) return <Pick task={task} />;
  if (!focusTimer) return <Screen><Link href="/today" className="fk-link">Today</Link><p className="fk-caption" style={{ marginTop: 20 }}>No timer is running.</p></Screen>;
  return <Running />;
}

export default function FocusPage() {
  return <Suspense fallback={null}><FocusContent /></Suspense>;
}
