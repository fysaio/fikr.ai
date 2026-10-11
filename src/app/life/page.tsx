'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { FIXTURE_LIFE_DATA } from '@/fixtures';
import { Memory } from '@/types';
import { Row, Screen, TabBar, TellSheet } from '@/components/fk';

const CATEGORIES: Array<{ key: string; title: string; empty: string }> = [
  { key: 'people', title: 'People', empty: 'Nobody yet' },
  { key: 'projects', title: 'Projects', empty: 'Nothing yet' },
  { key: 'goals', title: 'Goals', empty: 'Nothing yet' },
  { key: 'commitments', title: 'Commitments', empty: 'Nothing yet' },
  { key: 'prefs', title: 'Preferences', empty: 'Nothing yet' },
  { key: 'history', title: 'History', empty: 'Nothing yet' },
  { key: 'patterns', title: 'Patterns', empty: "Nothing yet. I won't guess too early." },
];

const live = (x: Memory) => !x.gone && !x.rejected && x.status !== 'deleted';

export default function LifePage() {
  const { state } = useApp();
  const [talk, setTalk] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);

  const data = useMemo(() => {
    const own = state.life || {};
    const hasOwn = Object.values(own).some((a) => a && a.length > 0);
    return hasOwn || !mounted ? own : FIXTURE_LIFE_DATA;
  }, [state.life, mounted]);

  return (
    <Screen
      bottom={<TabBar active="memory" onTell={() => setTalk(true)} />}
      overlay={<TellSheet open={talk} onClose={() => setTalk(false)} />}
    >
      <div className="fk-life-head">
        <h1 className="fk-display fk-life-h">Life</h1>
        <Link href="/profile" className="fk-iconbtn" aria-label="Profile and settings">{(state.name || 'M').charAt(0).toUpperCase()}</Link>
      </div>
      <p className="fk-caption">Everything here is yours to fix.</p>
      <div className="fk-stack" style={{ marginTop: 16 }}>
        {CATEGORIES.map((c) => {
          const items = ((data as Record<string, Memory[]>)[c.key] || []).filter(live);
          const preview = items.length ? items.slice(0, 2).map((x) => x.text).join(', ') + (items.length > 2 ? `, +${items.length - 2}` : '') : c.empty;
          return (
            <Row key={c.key} small={`${c.title}${items.length ? ` · ${items.length}` : ''}`} href={`/life/${c.key}`}>{preview}</Row>
          );
        })}
      </div>
    </Screen>
  );
}
