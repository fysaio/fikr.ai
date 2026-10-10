'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow, Mark } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';

export default function LockPage() {
  const router = useRouter();
  const { state } = useApp();

  return (
    <PhoneShell>
      <button
        className="back"
        aria-label="Back"
        type="button"
        onClick={() => router.back()}
      >
        <Arrow dir="l" />
      </button>

      <div className="lock">
        <div className="clk">9:41</div>
        <p className="m" style={{ textAlign: 'center', color: '#fff', opacity: 0.7 }}>
          Notifications, in the order they’d arrive
        </p>

        <div className="nt">
          <div className="ap">
            <Mark size={18} />
            <small>fikr · Morning · 8:00</small>
          </div>
          <b suppressHydrationWarning>Good morning, {state.name || 'there'}.</b> Four things today. The
          proposal is the one that counts.
          <span className="why">
            Why: you asked me to orient you each morning.
          </span>
        </div>

        <div className="nt">
          <div className="ap">
            <Mark size={18} />
            <small>fikr · Late · 10:25</small>
          </div>
          <b>10 min behind on “Research proposal”.</b> Start now, or move it?
          <span className="why">
            Why: it was due to start at 10:15. I only nudge once.
          </span>
        </div>

        <div className="nt">
          <div className="ap">
            <Mark size={18} />
            <small>fikr · Relationship · 12:00</small>
          </div>
          <b>You said you’d reply to Aisha.</b> You’re free now.
          <span className="why">
            Why: you promised after Monday’s meeting, and this window is open.
          </span>
        </div>

        <p className="m" style={{ marginTop: '22px', color: '#fff', opacity: 0.7 }}>
          Late nudge: once per task, only after 10 minutes, never in quiet
          hours. Each says why. If you ignore them, I send fewer.
        </p>
      </div>
    </PhoneShell>
  );
}
