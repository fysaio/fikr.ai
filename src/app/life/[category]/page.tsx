'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { FIXTURE_LIFE_DATA } from '@/fixtures';
import { Memory } from '@/types';
import { Button, Icon, Row, Screen, TabBar, TellSheet } from '@/components/fk';

const META: Record<string, { title: string; sub: string; cats: string[]; empty: string; emptyBody: string }> = {
  people: { title: 'People', sub: "Everyone you've told me about.", cats: ['people'], empty: 'Nobody yet', emptyBody: 'To add someone, tell me about them.' },
  projects: { title: 'Projects', sub: "What you're working toward.", cats: ['projects'], empty: 'Nothing yet', emptyBody: 'Tell me what you are working on.' },
  goals: { title: 'Goals', sub: 'Longer-term, not tasks yet.', cats: ['goals'], empty: 'Nothing yet', emptyBody: 'Tell me where you want to get to.' },
  commitments: { title: 'Commitments', sub: "What you've said you'll do.", cats: ['commitments'], empty: 'Nothing yet', emptyBody: 'Tell me what you promised.' },
  prefs: { title: 'Preferences', sub: 'How you like me to work.', cats: ['prefs', 'places'], empty: 'Nothing yet', emptyBody: 'Tell me how you like things done.' },
  history: { title: 'History', sub: 'Moments and decisions that matter.', cats: ['history'], empty: 'Nothing yet', emptyBody: 'Big events and decisions you tell me about will land here.' },
  patterns: { title: 'Patterns', sub: 'Things I might be noticing.', cats: ['patterns'], empty: 'Nothing yet', emptyBody: "I won't guess too early. If I notice something, I'll show you and ask if it's true." },
};
META.preferences = META.prefs;

const LABEL: Record<string, string> = { known: 'Known', stated: 'You told me', observed: 'I noticed', hypothesized: 'A guess' };
const live = (x: Memory) => !x.gone && !x.rejected && x.status !== 'deleted';

export default function LifeCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = use(params);
  const { state } = useApp();
  const [talk, setTalk] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t); }, []);
  const meta = META[category] || META.people;

  const items = useMemo(() => {
    const own = state.life || {};
    const hasOwn = Object.values(own).some((a) => a && a.length > 0);
    const src = hasOwn || !mounted ? own : FIXTURE_LIFE_DATA;
    return meta.cats.flatMap((c) => (src as Record<string, Memory[]>)[c] || []).filter(live);
  }, [state.life, mounted, meta]);

  return (
    <Screen
      bottom={<TabBar active="memory" onTell={() => setTalk(true)} />}
      overlay={<TellSheet open={talk} onClose={() => setTalk(false)} />}
    >
      <Link href="/life" className="fk-iconbtn" aria-label="Back to Life"><span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chev" size={20} /></span></Link>
      <h1 className="fk-display fk-life-h">{meta.title}</h1>
      <p className="fk-caption">{meta.sub}</p>
      {items.length > 0 ? (
        <div className="fk-stack" style={{ marginTop: 16 }}>
          {items.map((x) => (
            <Row key={x.id} small={LABEL[x.confidence] || x.confidence} href={`/life/item/${x.id}`}>
              {x.text}
              {(x.when_label || (x.source && !/^You told me/.test(x.source))) && <span className="fk-row-sub">{x.when_label ? `${x.when_label} · ` : ''}{x.source && !/^You told me/.test(x.source) ? x.source.replace(/^Learned from /, '') : ''}</span>}
            </Row>
          ))}
          {category === 'people' && <p className="fk-caption">To add someone, tell me about them.</p>}
        </div>
      ) : (
        <div className="fk-empty">
          <b>{meta.empty}</b>
          <p>{meta.emptyBody}</p>
          <Button variant="primary" hero onClick={() => setTalk(true)}>Tell Fikr</Button>
        </div>
      )}
    </Screen>
  );
}
