'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow, Checkmark, ClockIcon } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';

export default function OfflinePage() {
  const router = useRouter();
  const { state, showToast } = useApp();

  const isOffline = state.net === 'offline' || state.net === 'error';

  const handleCheckConnection = () => {
    if (isOffline) {
      showToast('Still offline');
    } else {
      showToast('You’re connected');
      router.back();
    }
  };

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

      <h1 className="ah" style={{ fontSize: '40px' }}>
        Without
        <br />
        <span>a connection.</span>
      </h1>
      <p className="as">Your day stays with you. Here’s what changes.</p>

      <h4 className="sh">Still works</h4>
      <div className="okl">
        <i className="y">
          <Checkmark />
        </i>
        <span>See today and what’s next</span>
      </div>
      <div className="okl">
        <i className="y">
          <Checkmark />
        </i>
        <span>Write thoughts and queue for processing</span>
      </div>
      <div className="okl">
        <i className="y">
          <Checkmark />
        </i>
        <span>Read, edit, and add Life memories</span>
      </div>
      <div className="okl">
        <i className="y">
          <Checkmark />
        </i>
        <span>Evening reflection drafts</span>
      </div>

      <h4 className="sh">Waits for a connection</h4>
      <div className="okl">
        <i className="w">
          <ClockIcon />
        </i>
        <span>My replies and questions</span>
      </div>
      <div className="okl">
        <i className="w">
          <ClockIcon />
        </i>
        <span>Understanding what you write</span>
      </div>
      <div className="okl">
        <i className="w">
          <ClockIcon />
        </i>
        <span>Signing up and logging in</span>
      </div>
      <div className="okl">
        <i className="w">
          <ClockIcon />
        </i>
        <span>The onboarding questions</span>
      </div>

      <p className="m" style={{ marginTop: '16px' }}>
        Anything you write is saved on this phone and syncs when you’re back.
      </p>

      <button
        className="btn g"
        id="ck"
        type="button"
        style={{ marginTop: '6px' }}
        onClick={handleCheckConnection}
      >
        Check connection
      </button>
    </PhoneShell>
  );
}
