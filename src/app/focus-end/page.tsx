'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Illustration } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';

export default function FocusEndPage() {
  const router = useRouter();
  const { state, setState, focusTimer, setFocusTimer, showToast, completeTask } =
    useApp();

  const currentTask: Task =
    focusTimer?.task ||
    state.tasks?.[0] || {
      id: 1,
      title: 'Research proposal: write the intro',
      duration_min: 45,
      why: 'Due Friday. Untouched since Monday.',
      status: 'open',
      source: 'user',
    };

  const handleFinish = () => {
    completeTask(currentTask.id);
    if (!state.firstDone) {
      setState((prev) => ({ ...prev, firstDone: true }));
      router.push('/done?early=0');
    } else {
      showToast('Done. Nice work.');
      router.push('/today');
    }
  };

  const handleTenMore = () => {
    setFocusTimer({
      task: currentTask,
      total: 600,
      left: 600,
      end: Date.now() + 600 * 1000,
      paused: false,
    });
    router.push('/focus');
  };

  const handleMove = () => {
    showToast('Moved to later today');
    router.push('/today');
  };

  return (
    <PhoneShell>
      <div className="fill">
        <div className="grow">
          <Illustration type="clock" />
          <span className="pill o" style={{ fontSize: '15px', padding: '5px 16px' }}>
            Time’s up
          </span>
          <h1 style={{ marginTop: '12px' }}>Did you finish?</h1>
          <p className="m">{currentTask.title}</p>
        </div>
        <div className="foot">
          <button className="btn" id="y" type="button" onClick={handleFinish}>
            Yes, done
          </button>
          <button className="btn p" id="m" type="button" onClick={handleTenMore}>
            I need 10 more minutes
          </button>
          <button className="btn g" id="n" type="button" onClick={handleMove}>
            Not yet. Move it
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
