'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { useApp } from '@/context/AppContext';
import { Memory } from '@/types';
import { InAppIntervention } from '@/components/interventions/InAppIntervention';
import { DeciderResult } from '@/lib/ai';
import { InterventionOutcome } from '@/lib/models/schema';
import { Mark, Checkmark, Arrow } from '@/components/icons/Icons';

interface PriorityItem {
  id: string;
  text: string;
  sourceMemoryId?: string;
  done: boolean;
  contextNote?: string;
}

function TodayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eveParam = searchParams.get('eve') === '1';

  const {
    state,
    setState,
    showToast,
    addLifeItem,
    updateLifeItem,
  } = useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [yesterdayOpen, setYesterdayOpen] = useState(false);
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [addingContextId, setAddingContextId] = useState<string | null>(null);
  const [contextInput, setContextInput] = useState('');

  // Extract living memory items
  const commitments: Memory[] = (state.life?.commitments || []).filter((m) => m.status !== 'deleted');
  const projects: Memory[] = (state.life?.projects || []).filter((m) => m.status !== 'deleted');
  const people: Memory[] = (state.life?.people || []).filter((m) => m.status !== 'deleted');
  const prefs: Memory[] = (state.life?.prefs || []).filter((m) => m.status !== 'deleted');
  const patterns: Memory[] = (state.life?.patterns || []).filter((m) => m.status !== 'deleted');

  // Derive Proposed Priorities from commitments and projects
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);

  useEffect(() => {
    const derived: PriorityItem[] = [];

    commitments.slice(0, 3).forEach((c, idx) => {
      derived.push({
        id: `prio_${c.id || idx}`,
        text: c.text,
        sourceMemoryId: c.id,
        done: Boolean(c.when_label === 'Done'),
      });
    });

    if (derived.length < 3 && projects.length > 0) {
      projects.slice(0, 3 - derived.length).forEach((p, idx) => {
        derived.push({
          id: `prio_proj_${p.id || idx}`,
          text: `Move forward: ${p.text}`,
          sourceMemoryId: p.id,
          done: false,
        });
      });
    }

    setPriorities(derived);
  }, [commitments.length, projects.length]);

  // Morning interpretation synthesis (Cold start on Day 1 vs Returning)
  const isColdStart = Boolean(state.fresh || (!state.hist || state.hist.length === 0));

  let morningInterpretation = '';
  if (isColdStart) {
    if (projects.length > 0 && commitments.length > 0) {
      morningInterpretation = `Good morning. Based on onboarding, your main focus is on "${projects[0].text}". You also have an open commitment: "${commitments[0].text}".`;
    } else if (projects.length > 0) {
      morningInterpretation = `Good morning. You are focused on "${projects[0].text}". Nothing else is pressing today.`;
    } else {
      morningInterpretation = 'Good morning. Your day is completely clear. Say what is on your mind and we will build from there.';
    }
  } else {
    morningInterpretation = 'Good morning. Yesterday is reviewed. The priorities below are proposed for today, ready for your adjustments.';
  }

  // Evening time check (after 18:00 or triggered)
  const isEvening =
    eveParam ||
    (!state.eveDone && (Boolean(state.eve1) || (typeof window !== 'undefined' && new Date().getHours() >= 18)));

  const handleToggleDone = (priority: PriorityItem) => {
    const nextDone = !priority.done;
    setPriorities((prev) =>
      prev.map((p) => (p.id === priority.id ? { ...p, done: nextDone } : p))
    );
    if (priority.sourceMemoryId) {
      updateLifeItem(priority.sourceMemoryId, { when_label: nextDone ? 'Done' : 'Open' });
    }
    showToast(nextDone ? 'Marked complete' : 'Reopened');
  };

  const handleSaveEdit = (priorityId: string) => {
    if (!editingText.trim()) return;
    setPriorities((prev) =>
      prev.map((p) => (p.id === priorityId ? { ...p, text: editingText.trim() } : p))
    );
    const target = priorities.find((p) => p.id === priorityId);
    if (target?.sourceMemoryId) {
      updateLifeItem(target.sourceMemoryId, { text: editingText.trim() });
    }
    setEditingPriorityId(null);
    showToast('Updated');
  };

  const handleSaveContext = (priorityId: string) => {
    if (!contextInput.trim()) return;
    setPriorities((prev) =>
      prev.map((p) => (p.id === priorityId ? { ...p, contextNote: contextInput.trim() } : p))
    );
    setAddingContextId(null);
    setContextInput('');
    showToast('Context added');
  };

  const [activeIntervention, setActiveIntervention] = useState<(DeciderResult & { id?: string }) | null>(null);

  useEffect(() => {
    async function evaluateIntervention() {
      try {
        const todayHistory = JSON.parse(
          localStorage.getItem('fikr_interventions_today_v1') || '[]'
        );
        const recentOutcomes = JSON.parse(
          localStorage.getItem('fikr_intervention_outcomes_v1') || '[]'
        );

        const allActiveMemories: Memory[] = [];
        if (state.life) {
          Object.values(state.life).forEach((arr) => {
            if (Array.isArray(arr)) {
              arr.forEach((m) => {
                if (!m.gone && !m.rejected && m.status !== 'deleted') {
                  allActiveMemories.push(m);
                }
              });
            }
          });
        }

        const res = await fetch('/api/interventions/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_profile: {
              quiet_start: state.quiet_start || '22:00',
              quiet_end: state.quiet_end || '07:00',
              nudge_level: state.nudge || 'morning_and_when_helps',
            },
            memories: allActiveMemories,
            interventions_today: todayHistory,
            recent_outcomes: recentOutcomes,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.decision !== 'silent' && data.text) {
            setActiveIntervention(data);
          } else {
            setActiveIntervention(null);
          }
        }
      } catch (e) {
        setActiveIntervention(null);
      }
    }

    evaluateIntervention();
  }, [commitments.length, projects.length]);

  const handleInterventionOutcome = async (outcome: InterventionOutcome) => {
    if (!activeIntervention) return;
    const invId = activeIntervention.id;
    const invKind = activeIntervention.kind;

    // Record outcome locally
    const outcomes = JSON.parse(
      localStorage.getItem('fikr_intervention_outcomes_v1') || '[]'
    );
    outcomes.push({ kind: invKind, outcome, at: new Date().toISOString() });
    localStorage.setItem('fikr_intervention_outcomes_v1', JSON.stringify(outcomes));

    // Record to today served history
    const todayHistory = JSON.parse(
      localStorage.getItem('fikr_interventions_today_v1') || '[]'
    );
    todayHistory.push({
      id: invId,
      kind: invKind,
      decision: activeIntervention.decision,
      shown_at: new Date().toISOString(),
      outcome,
    });
    localStorage.setItem('fikr_interventions_today_v1', JSON.stringify(todayHistory));

    // Sync to API
    if (invId) {
      fetch('/api/interventions/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervention_id: invId, outcome }),
      }).catch(() => {});
    }

    if (outcome === 'acted') {
      showToast('Noted.');
    } else if (outcome === 'snoozed') {
      showToast('Snoozed.');
    } else if (outcome === 'dismissed') {
      showToast('Dismissed.');
    }

    setActiveIntervention(null);
  };

  return (
    <PhoneShell dock="today">
      <div style={{ padding: '0 4px 32px' }}>
        {/* Header Greeting */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '16px',
            paddingTop: '8px',
          }}
        >
          <div>
            <span suppressHydrationWarning style={{ fontSize: '13px', fontWeight: 700, color: 'var(--mute)' }}>
              {mounted
                ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
                : ''}
            </span>
            <h1 suppressHydrationWarning style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 900 }}>
              {mounted && state.name ? `Hello, ${state.name}.` : 'Hello.'}
            </h1>
          </div>
          <Link href="/profile" aria-label="Profile and settings" style={{ color: 'var(--ink)' }}>
            <Mark size={32} />
          </Link>
        </div>

        {/* 1. WHAT HAPPENED: Morning Interpretation & Expandable Yesterday Panel */}
        <div
          style={{
            background: 'var(--s1)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '20px',
            border: '1px solid var(--s2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mute)' }}>
              What happened
            </span>
            <button
              type="button"
              onClick={() => setYesterdayOpen((prev) => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--lime)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              {yesterdayOpen ? 'Hide yesterday' : 'Yesterday'}
            </button>
          </div>

          <p style={{ margin: '0 0 10px', fontSize: '15px', lineHeight: 1.45, color: 'var(--ink)' }}>
            {morningInterpretation}
          </p>

          {/* IN-PLACE YESTERDAY PANEL per Section 2 & 5 (No separate route, no story/swipe) */}
          {yesterdayOpen && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--mute)' }}>
                Yesterday in summary
              </div>
              {state.tomorrow && state.tomorrow.length > 0 ? (
                <div style={{ fontSize: '14px', color: 'var(--ink)' }}>
                  <b>From last evening:</b> {state.tomorrow.join(' · ')}
                </div>
              ) : null}
              {state.hist && state.hist.length > 0 ? (
                state.hist[0]?.items?.map((item, i) => (
                  <div key={i} style={{ fontSize: '13px', color: 'var(--ink)' }}>
                    <div>&bull; &ldquo;{item.msg}&rdquo;</div>
                    <div style={{ color: 'var(--mute)', fontSize: '12px', marginLeft: '12px' }}>
                      {item.outcome}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--mute)' }}>
                  {isColdStart
                    ? 'No prior history. Yesterday was your first setup.'
                    : 'Held in your thoughts yesterday. Nothing became an open task.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* IN-APP INTERVENTION per Section 8 */}
        {activeIntervention && (
          <InAppIntervention
            intervention={activeIntervention}
            onOutcome={handleInterventionOutcome}
          />
        )}

        {/* 2. WHAT MATTERS NOW: Proposed Priorities & Open Commitments */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>
              What matters now
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--mute)' }}>
              Proposed · You can edit
            </span>
          </div>

          {priorities.length === 0 ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'var(--bg)',
                border: '1px dashed var(--s2)',
                color: 'var(--mute)',
                fontSize: '14px',
              }}
            >
              Nothing pressing. You have a clean start.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {priorities.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: item.done ? 'var(--bg)' : 'var(--s1)',
                    border: '1px solid var(--s2)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    opacity: item.done ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <button
                      type="button"
                      aria-label="Toggle status"
                      onClick={() => handleToggleDone(item)}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--line)',
                        background: item.done ? 'var(--lime)' : 'transparent',
                        color: 'var(--cink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      {item.done && <Checkmark size={14} />}
                    </button>

                    <div style={{ flex: 1 }}>
                      {editingPriorityId === item.id ? (
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 8px',
                              background: 'var(--bg)',
                              border: '1px solid var(--line)',
                              borderRadius: '6px',
                              color: 'var(--ink)',
                              fontSize: '14px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            style={{
                              background: 'var(--lime)',
                              border: 'none',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '12px',
                              padding: '6px 10px',
                              cursor: 'pointer',
                            }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: 'var(--ink)',
                            textDecoration: item.done ? 'line-through' : 'none',
                            lineHeight: 1.4,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setEditingPriorityId(item.id);
                            setEditingText(item.text);
                          }}
                        >
                          {item.text}
                        </div>
                      )}

                      {/* User Added Context Note */}
                      {item.contextNote && (
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--mute)', fontStyle: 'italic' }}>
                          Context: {item.contextNote}
                        </p>
                      )}

                      {/* Provenance Link and Context Action */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                        {item.sourceMemoryId && (
                          <Link
                            href={`/life/item/${item.sourceMemoryId}`}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--mute)',
                              textDecoration: 'underline',
                            }}
                          >
                            Why am I seeing this?
                          </Link>
                        )}

                        {addingContextId === item.id ? (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                            <input
                              type="text"
                              placeholder="Add context note…"
                              value={contextInput}
                              onChange={(e) => setContextInput(e.target.value)}
                              style={{
                                padding: '4px 8px',
                                background: 'var(--bg)',
                                border: '1px solid var(--line)',
                                borderRadius: '6px',
                                color: 'var(--ink)',
                                fontSize: '12px',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveContext(item.id)}
                              style={{
                                background: 'var(--s2)',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '4px 8px',
                                cursor: 'pointer',
                              }}
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingContextId(item.id);
                              setContextInput('');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--mute)',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            + Add context
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. RELATIONSHIPS & COMMITMENTS FOLLOW-UPS */}
        {people.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 10px', color: 'var(--ink)' }}>
              People
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {people.slice(0, 2).map((person) => (
                <div
                  key={person.id}
                  style={{
                    background: 'var(--s1)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <div>
                    <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{person.text}</b>
                    <div style={{ marginTop: '2px' }}>
                      <Link
                        href={`/life/item/${person.id}`}
                        style={{ fontSize: '11px', color: 'var(--mute)', textDecoration: 'underline' }}
                      >
                        Why am I seeing this?
                      </Link>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--lime)' }}>
                    Relationship
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. WHAT SHOULD I CONSIDER: Constraints & Preferences */}
        {prefs.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px', color: 'var(--ink)' }}>
              What should I consider
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {prefs.slice(0, 2).map((pref) => (
                <div
                  key={pref.id}
                  style={{
                    background: 'var(--s1)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    border: '1px solid var(--line)',
                  }}
                >
                  <p style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--ink)' }}>
                    {pref.text}
                  </p>
                  <Link
                    href={`/life/item/${pref.id}`}
                    style={{ fontSize: '11px', color: 'var(--mute)', textDecoration: 'underline' }}
                  >
                    Why am I seeing this?
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. EVENING CHECK-IN CARD (when relevant) */}
        {isEvening && (
          <Link
            href="/evening"
            className="glow"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
            }}
          >
            <span>
              Evening check-in
              <br />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mute)' }}>
                A quiet conversation, not a report. What happened, what changed, what tomorrow should know.
              </span>
            </span>
            <Arrow dir="r" />
          </Link>
        )}
      </div>
    </PhoneShell>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayContent />
    </Suspense>
  );
}
