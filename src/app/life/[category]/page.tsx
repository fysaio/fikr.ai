'use client';

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { Memory } from '@/types';
import { FIXTURE_LIFE_DATA } from '@/fixtures';

const CATEGORY_META: Record<string, [string, string[]]> = {
  people: ['People', ['people']],
  projects: ['Projects', ['projects']],
  goals: ['Goals', ['goals']],
  commitments: ['Open commitments', ['commitments']],
  prefs: ['Preferences', ['prefs', 'places']],
  preferences: ['Preferences', ['prefs', 'places']],
  places: ['Places', ['places']],
  history: ['Important history', ['history']],
  patterns: ['Patterns', ['patterns']],
  // Legacy aliases
  work: ['Projects & goals', ['projects', 'goals']],
  how: ['How I work', ['prefs', 'places']],
  time: ['Over time', ['history', 'patterns']],
};

const CF_LABELS: Record<string, string> = {
  known: 'Known',
  stated: 'You told me',
  observed: 'I noticed',
  hypothesized: 'A guess',
};

export default function LifeCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = use(params);
  const router = useRouter();
  const { state, addLifeItem, showToast } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState('');

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const meta = CATEGORY_META[category] || CATEGORY_META.people;
  const title = meta[0];
  const targetCats = meta[1];
  const primaryCat = targetCats[0] || 'projects';

  const lifeData = state.life || {};
  let items: Memory[] = targetCats.flatMap((cat) =>
    (lifeData[cat] || []).filter(
      (x) => !x.gone && !x.rejected && x.status !== 'deleted'
    )
  );

  if (items.length === 0 && (!state.life || Object.keys(state.life).length === 0)) {
    items = targetCats.flatMap((cat) =>
      (FIXTURE_LIFE_DATA[cat] || []).filter(
        (x) => !x.gone && !x.rejected && x.status !== 'deleted'
      )
    );
  }

  const filteredItems = searchQuery
    ? items.filter((x) =>
        x.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;
    addLifeItem(trimmed, primaryCat, `Manually added to ${title}`);
    setNewText('');
    setShowAdd(false);
    showToast('Saved');
  };

  if (!isMounted) {
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
        <h1>{title}</h1>
        <p className="m" style={{ color: 'var(--mute)' }}>Loading...</p>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={() => router.push('/life')}
          style={{ margin: 0 }}
        >
          <Arrow dir="l" />
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          style={{ margin: 0, cursor: 'pointer' }}
        >
          {showAdd ? 'Close' : '+ Add'}
        </button>
      </div>

      <h1 style={{ marginTop: '16px' }}>{title}</h1>
      <p className="m">Tap any item to see confidence, provenance, or edit.</p>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="card"
          style={{ border: '1px solid var(--lime)', marginTop: '8px' }}
        >
          <b style={{ display: 'block', marginBottom: '6px' }}>Add to {title}</b>
          <input
            placeholder={`Add a new ${title.toLowerCase().replace(/s$/, '')}...`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            autoFocus
            style={{ marginBottom: '8px' }}
          />
          <div className="row2">
            <button className="btn" type="submit" style={{ margin: 0 }}>
              Save
            </button>
            <button
              className="btn g"
              type="button"
              style={{ margin: 0 }}
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length > 2 && (
        <input
          placeholder={`Search ${title.toLowerCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginTop: '8px', marginBottom: '12px' }}
        />
      )}

      {filteredItems.length > 0 ? (
        filteredItems.map((x) => (
          <Link
            key={x.id}
            className="card il"
            href={`/life/item/${x.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            {category === 'people' && (
              <span className="av">{x.text[0]}</span>
            )}
            <span className="tx" style={{ flex: 1 }}>
              {x.text}
              {(x.when_label || x.source) && (
                <small style={{ display: 'block', marginTop: '2px', color: 'var(--mute)' }}>
                  {x.when_label ? `${x.when_label} · ` : ''}
                  {x.source ? x.source.replace(/^Learned from /, '') : ''}
                </small>
              )}
            </span>
            <span className={`cf ${x.confidence}`} style={{ whiteSpace: 'nowrap' }}>
              {CF_LABELS[x.confidence] || x.confidence}
            </span>
          </Link>
        ))
      ) : (
        <p className="m" style={{ marginTop: '16px' }}>
          {searchQuery ? 'No matching items.' : 'Nothing here yet. This fills in as we talk.'}
        </p>
      )}
    </PhoneShell>
  );
}
