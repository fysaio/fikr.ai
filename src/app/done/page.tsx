'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Illustration } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';

function DoneContent() {
  const searchParams = useSearchParams();
  const early = parseInt(searchParams.get('early') || '0', 10);
  const { state } = useApp();

  const allTasks = state.tasks || [];
  const nextUp = allTasks.find((t) => !state.done[t.id]);

  return (
    <PhoneShell>
      <div className="fill">
        <div className="grow">
          <Illustration type="win" />
          <h1>
            Well done.
            <br />
            You’re starting well.
          </h1>
          <p className="m" style={{ maxWidth: '270px' }}>
            {early > 0 ? `Finished ${early} min early. ` : ''}One down.
          </p>
          {nextUp && (
            <div className="nx">
              <span className="m">Next up</span>
              <br />
              <b>{nextUp.title}</b> <span className="m">· {nextUp.at}</span>
            </div>
          )}
        </div>
        <div className="foot">
          <Link className="btn" href="/today">
            Back to today
          </Link>
        </div>
      </div>
    </PhoneShell>
  );
}

export default function DonePage() {
  return (
    <Suspense fallback={null}>
      <DoneContent />
    </Suspense>
  );
}
