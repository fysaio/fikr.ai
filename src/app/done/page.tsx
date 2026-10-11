'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Button, Card, Screen } from '@/components/fk';

function DoneContent() {
  const searchParams = useSearchParams();
  const early = parseInt(searchParams.get('early') || '0', 10);
  const { state } = useApp();
  const nextUp = (state.tasks || []).find((t) => !state.done[t.id]);

  return (
    <Screen bottom={<div style={{ padding: '12px 24px calc(20px + env(safe-area-inset-bottom))' }}><Button href="/today" variant="primary" hero block>Back to today</Button></div>}>
      <h1 className="fk-h1" style={{ marginTop: 64 }}>Well done.<br />You’re starting well.</h1>
      <p className="fk-caption" style={{ fontSize: 17, marginTop: 14 }}>{early > 0 ? `Finished ${early} min early. ` : ''}One down.</p>
      {nextUp && (
        <div style={{ marginTop: 28 }}>
          <Card>
            <div className="fk-card-time">Next up{nextUp.at ? ` · ${nextUp.at}` : ''}</div>
            <div className="fk-card-title">{nextUp.title}</div>
          </Card>
        </div>
      )}
    </Screen>
  );
}

export default function DonePage() {
  return (
    <Suspense fallback={null}>
      <DoneContent />
    </Suspense>
  );
}
