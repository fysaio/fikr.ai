'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Button, Screen } from '@/components/fk';
import { logFocus } from '@/lib/day/log';

export default function FocusEndPage() {
  const router = useRouter();
  const { state, setState, focusTimer, setFocusTimer, completeTask, showToast } = useApp();
  const task = focusTimer?.task;
  const minutes = focusTimer ? Math.round(focusTimer.total / 60) : 0;

  useEffect(() => { if (!focusTimer) router.replace('/today'); }, [focusTimer, router]);
  if (!task) return null;

  const close = (done: boolean) => {
    logFocus({ taskId: String(task.id), title: task.title, minutes });
    setFocusTimer(null);
    if (done) {
      completeTask(task.id);
      if (!state.firstDone) { setState((p) => ({ ...p, firstDone: true })); router.replace('/done?early=0'); return; }
      showToast('Done. Nice work.');
    }
    router.replace('/today');
  };
  const more = () => { setFocusTimer({ task, total: 600, left: 600, end: Date.now() + 600000, paused: false }); router.replace('/focus'); };

  return (
    <Screen>
      <h1 className="fk-display fk-life-h" style={{ marginTop: 60 }}>Time&apos;s up.</h1>
      <p className="fk-caption" style={{ fontSize: 16 }}>{minutes} minutes on {task.title}.</p>
      <h2 className="fk-h2" style={{ marginTop: 28 }}>How did it go?</h2>
      <p className="fk-caption">Where did you get to?</p>
      <div className="fk-stack" style={{ marginTop: 12 }}>
        <Button variant="primary" hero block onClick={() => close(true)}>I finished it</Button>
        <Button block onClick={() => close(false)}>Made progress</Button>
        <Button block onClick={() => { setFocusTimer(null); router.replace('/today'); }}>Didn&apos;t get to it</Button>
      </div>
      <div className="fk-item-foot"><button type="button" className="fk-link" onClick={more}>Keep going, +10 min</button><Link href="/today" className="fk-link">Today</Link></div>
    </Screen>
  );
}
