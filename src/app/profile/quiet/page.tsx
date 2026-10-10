'use client';

import React, { useState } from 'react';
import { BackLink, Screen, TabBar, TellSheet, Toggle } from '@/components/fk';
import { useSettings } from '@/lib/settings/useSettings';

const ROWS: Array<{ key: 'mornings' | 'classes' | 'prayer' | 'evenings' | 'weekends' | 'late'; label: string }> = [
  { key: 'mornings', label: 'Mornings' },
  { key: 'classes', label: 'During classes' },
  { key: 'prayer', label: 'Prayer times' },
  { key: 'evenings', label: 'Evenings' },
  { key: 'weekends', label: 'Weekends' },
  { key: 'late', label: 'Late night' },
];

export default function QuietPage() {
  const [s, update] = useSettings();
  const [talk, setTalk] = useState(false);
  const q = s.quiet;
  const set = (k: (typeof ROWS)[number]['key']) => (v: boolean) => update((p) => ({ ...p, quiet: { ...p.quiet, [k]: v } }));

  return (
    <Screen bottom={<TabBar active="memory" onTell={() => setTalk(true)} />} overlay={<TellSheet open={talk} onClose={() => setTalk(false)} />}>
      <BackLink href="/profile" label="Back to settings" />
      <h1 className="fk-display fk-life-h">Quiet times</h1>
      <p className="fk-caption">I won&apos;t interrupt during these.</p>
      <div className="fk-stack" style={{ marginTop: 16 }}>
        {ROWS.map((r) => <Toggle key={r.key} label={r.label} on={q[r.key]} onChange={set(r.key)} />)}
      </div>
      {q.late && (
        <div className="fk-times">
          <label>From<input className="fk-input" type="time" value={q.lateFrom} onChange={(e) => e.target.value && update((p) => ({ ...p, quiet: { ...p.quiet, lateFrom: e.target.value } }))} /></label>
          <label>To<input className="fk-input" type="time" value={q.lateTo} onChange={(e) => e.target.value && update((p) => ({ ...p, quiet: { ...p.quiet, lateTo: e.target.value } }))} /></label>
        </div>
      )}
    </Screen>
  );
}
