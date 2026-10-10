'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { useApp } from '@/context/AppContext';
import { Memory } from '@/types';
import { FIXTURE_LIFE_DATA } from '@/fixtures';

const CF_LABELS: Record<string, string> = {
  known: 'Known',
  stated: 'You told me',
  observed: 'I noticed',
  hypothesized: 'A guess',
};

const CATEGORIES: Array<{ key: string; title: string; routeKey: string }> = [
  { key: 'people', title: 'People', routeKey: 'people' },
  { key: 'projects', title: 'Projects', routeKey: 'projects' },
  { key: 'goals', title: 'Goals', routeKey: 'goals' },
  { key: 'commitments', title: 'Open commitments', routeKey: 'commitments' },
  { key: 'prefs', title: 'Preferences', routeKey: 'prefs' },
  { key: 'history', title: 'Important history', routeKey: 'history' },
  { key: 'patterns', title: 'Patterns', routeKey: 'patterns' },
];

export default function LifePage() {
  const { state, updateLifeItem, addLifeItem, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('projects');

  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasUserData =
    isMounted &&
    state.life &&
    Object.values(state.life).some((arr) => arr && arr.length > 0);

  const lifeData = hasUserData ? state.life! : FIXTURE_LIFE_DATA;

  const liveItems = (cat: string): Memory[] =>
    (lifeData[cat] || []).filter((x) => !x.gone && !x.rejected && x.status !== 'deleted');

  const needsList = (lifeData.patterns || []).filter(
    (x) =>
      x.confidence === 'hypothesized' &&
      !x.gone &&
      !x.rejected &&
      x.status !== 'deleted' &&
      !x.snooze
  );

  const toggleWhy = (id: string) => {
    setExpandedWhy((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFeelsTrue = (x: Memory) => {
    updateLifeItem(x.id, {
      confidence: 'stated',
      source: 'You confirmed this',
      evidence: [],
    });
    showToast('Saved as something you told me');
  };

  const handleNotReally = (x: Memory) => {
    updateLifeItem(x.id, { rejected: true, status: 'rejected' });
    showToast('Okay. I won’t say that again.');
  };

  const handleNotSure = (x: Memory) => {
    updateLifeItem(x.id, { snooze: true });
    showToast('No problem. I’ll keep it as a guess.');
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;
    addLifeItem(trimmed, newCategory, 'Manually added in Life');
    setNewText('');
    setShowAddModal(false);
    showToast('Saved to Life');
  };

  const renderSection = (
    title: string,
    routeKey: string,
    items: Memory[]
  ) => {
    const q = searchQuery.toLowerCase();
    const filtered = q
      ? items.filter((x) => x.text.toLowerCase().includes(q))
      : items;

    const visibleItems = q ? filtered : filtered.slice(0, 3);

    return (
      <div key={title} style={{ marginBottom: '16px' }}>
        <div className="sec">
          <h2>{title}</h2>
          {items.length > 3 && !q && (
            <Link href={`/life/${routeKey}`}>See all {items.length}</Link>
          )}
        </div>
        {visibleItems.length > 0 ? (
          visibleItems.map((x) => (
            <Link
              key={x.id}
              className="lr"
              href={`/life/item/${x.id}`}
            >
              <span className="tx">
                {x.text}
                {(x.when_label || x.source) && (
                  <small>
                    {x.when_label ? `${x.when_label} · ` : ''}
                    {x.source ? x.source.replace(/^Learned from /, '') : ''}
                  </small>
                )}
              </span>
              <span className={`cf ${x.confidence}`}>
                {CF_LABELS[x.confidence] || x.confidence}
              </span>
            </Link>
          ))
        ) : (
          <p className="m" style={{ margin: '6px 0 0' }}>Nothing yet. This fills in as we talk.</p>
        )}
      </div>
    );
  };

  const initialLetter = (state.name || 'A')[0].toUpperCase();

  return (
    <PhoneShell dock="life">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0 }}>Life</h1>
        <button
          className="chip"
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{ margin: '0 10px 0 auto', cursor: 'pointer' }}
        >
          + Add
        </button>
        <Link
          href="/profile"
          className="back"
          style={{
            display: 'grid',
            placeItems: 'center',
            margin: 0,
            background: 'var(--lime)',
            color: 'var(--cink)',
            fontWeight: 900,
          }}
          aria-label="Settings"
          suppressHydrationWarning
        >
          {initialLetter}
        </Link>
      </div>

      <p className="m" style={{ margin: '6px 0 12px' }}>
        Everything here is yours to fix.
      </p>

      <input
        id="sq"
        placeholder="Search what I know"
        aria-label="Search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="card" style={{ marginTop: '12px', border: '1px solid var(--lime)' }}>
          <b style={{ display: 'block', marginBottom: '8px' }}>Add something to Life</b>
          <form onSubmit={handleCreateMemory}>
            <label style={{ fontSize: '13px', color: 'var(--mute)', display: 'block', marginBottom: '4px' }}>
              Category
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--cink)',
                marginBottom: '10px',
                fontSize: '14px',
              }}
            >
              <option value="people">People</option>
              <option value="projects">Projects</option>
              <option value="goals">Goals</option>
              <option value="commitments">Open commitments</option>
              <option value="prefs">Preferences</option>
              <option value="history">Important history</option>
              <option value="patterns">Patterns</option>
            </select>

            <label style={{ fontSize: '13px', color: 'var(--mute)', display: 'block', marginBottom: '4px' }}>
              What should I know?
            </label>
            <input
              placeholder="e.g. My research proposal is due Friday"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              autoFocus
              style={{ marginBottom: '10px' }}
            />

            <div className="row2" style={{ marginTop: '8px' }}>
              <button className="btn" type="submit" style={{ margin: 0 }}>
                Save
              </button>
              <button
                className="btn g"
                type="button"
                style={{ margin: 0 }}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Needs you section */}
      {needsList.length > 0 && !searchQuery && (
        <div style={{ marginTop: '12px' }}>
          <div className="sec">
            <h2>Needs you</h2>
          </div>
          <p className="m" style={{ margin: '0 0 8px' }}>
            A guess is something I worked out. You never told me. I won’t treat
            it as fact unless you say so.
          </p>
          {needsList.map((x) => (
            <div key={x.id} className="nc">
              <span className="cf hypothesized">A guess</span>
              <h3>{x.text}</h3>
              <button
                className="lnk why"
                type="button"
                style={{ padding: '0 0 8px' }}
                onClick={() => toggleWhy(x.id)}
              >
                Why I think this
              </button>
              {expandedWhy[x.id] && x.evidence && (
                <div className="ev">
                  {x.evidence.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
              <div className="row2">
                <button
                  className="btn y"
                  type="button"
                  style={{ margin: 0 }}
                  onClick={() => handleFeelsTrue(x)}
                >
                  Feels true
                </button>
                <button
                  className="btn g n"
                  type="button"
                  style={{ margin: 0 }}
                  onClick={() => handleNotReally(x)}
                >
                  Reject pattern
                </button>
              </div>
              <button
                className="lnk u"
                type="button"
                style={{ marginTop: '6px' }}
                onClick={() => handleNotSure(x)}
              >
                Not sure
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 7 Canonical Categories */}
      {CATEGORIES.map((cat) =>
        renderSection(cat.title, cat.routeKey, liveItems(cat.key))
      )}
    </PhoneShell>
  );
}
