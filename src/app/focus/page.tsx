'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';

const mmss = (s: number) => {
  const safe = Math.max(0, s);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(
    safe % 60
  ).padStart(2, '0')}`;
};

export default function FocusPage() {
  const router = useRouter();
  const { state, setState, focusTimer, setFocusTimer, showToast, completeTask } =
    useApp();

  const currentTask: Task =
    focusTimer?.task ||
    state.tasks?.[0] || {
      id: 1,
      title: 'Research proposal: write the intro',
      at: '10:15',
      dur: 45,
      duration_min: 45,
      in: 25,
      why: 'Due Friday. Untouched since Monday.',
      status: 'open',
      source: 'user',
    };

  const initialTotal = focusTimer?.total || 2700;
  const [totalSeconds, setTotalSeconds] = useState(initialTotal);
  const [leftSeconds, setLeftSeconds] = useState(focusTimer?.left ?? initialTotal);
  const [isPaused, setIsPaused] = useState(focusTimer?.paused ?? false);

  const C = 2 * Math.PI * 90; // ~565.486

  useEffect(() => {
    const endTimestamp =
      focusTimer?.end && !isPaused
        ? focusTimer.end
        : Date.now() + leftSeconds * 1000;

    if (!isPaused && (!focusTimer || !focusTimer.end)) {
      setFocusTimer({
        task: currentTask,
        total: totalSeconds,
        left: leftSeconds,
        end: endTimestamp,
        paused: false,
      });
    }

    const interval = setInterval(() => {
      if (isPaused) return;

      const remaining = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
      setLeftSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        router.push('/focus-end');
      }
    }, 500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, router, currentTask, totalSeconds]);

  const handleFinish = () => {
    const early = Math.floor(leftSeconds / 60);
    completeTask(currentTask.id);

    if (!state.firstDone) {
      setState((prev) => ({ ...prev, firstDone: true }));
      router.push(`/done?early=${early}`);
    } else {
      showToast('Done. Nice work.');
      router.push('/today');
    }
  };

  const handlePlusTen = () => {
    setTotalSeconds((prev) => prev + 600);
    setLeftSeconds((prev) => prev + 600);
    if (!isPaused) {
      const newEnd = Date.now() + (leftSeconds + 600) * 1000;
      setFocusTimer((prev) =>
        prev
          ? {
              ...prev,
              total: prev.total + 600,
              left: prev.left + 600,
              end: newEnd,
            }
          : null
      );
    }
  };

  const handleTogglePause = () => {
    if (isPaused) {
      // Resume
      const newEnd = Date.now() + leftSeconds * 1000;
      setIsPaused(false);
      setFocusTimer((prev) =>
        prev
          ? {
              ...prev,
              end: newEnd,
              paused: false,
            }
          : null
      );
    } else {
      // Pause
      setIsPaused(true);
      setFocusTimer((prev) =>
        prev
          ? {
              ...prev,
              left: leftSeconds,
              paused: true,
            }
          : null
      );
    }
  };

  const dashoffset = C * (1 - (totalSeconds > 0 ? leftSeconds / totalSeconds : 0));

  return (
    <PhoneShell>
      <div className="fill">
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={() => router.back()}
        >
          <Arrow dir="l" />
        </button>

        <p className="m" style={{ textAlign: 'center', margin: 0 }}>
          Focus
        </p>
        <h1 style={{ textAlign: 'center', fontSize: '24px' }}>
          {currentTask.title}
        </h1>

        <div className="rw">
          <svg className="ring" width="220" height="220" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r="90"
              fill="none"
              stroke="var(--s2)"
              strokeWidth="16"
            />
            <circle
              id="rg"
              cx="110"
              cy="110"
              r="90"
              fill="none"
              stroke="var(--lime)"
              strokeWidth="16"
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              strokeDasharray={C}
              strokeDashoffset={dashoffset}
            />
          </svg>
          <div className="time" id="tm">
            {mmss(leftSeconds)}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: '24px' }} />

        <button className="btn" id="dn" type="button" onClick={handleFinish}>
          I’m done
        </button>
        <div className="row2">
          <button className="btn g" id="pl" type="button" onClick={handlePlusTen}>
            +10 min
          </button>
          <button
            className="btn g"
            id="ps"
            type="button"
            onClick={handleTogglePause}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <p
          className="m"
          id="jp"
          style={{ textAlign: 'center', marginTop: '16px', cursor: 'pointer' }}
          onClick={() => {
            setIsPaused(false);
            setLeftSeconds(5);
            const newEnd = Date.now() + 5000;
            setFocusTimer((prev) =>
              prev ? { ...prev, paused: false, left: 5, end: newEnd } : null
            );
          }}
        >
          Demo: jump to the last 5 seconds
        </p>
      </div>
    </PhoneShell>
  );
}
