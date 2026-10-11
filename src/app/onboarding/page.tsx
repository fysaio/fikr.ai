'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/fk';
import { useApp } from '@/context/AppContext';
import { OnboardingFact, FactCategory, Slot, TargetSlot, ChoiceOption, UISpec } from '@/lib/onboarding/types';
import { sanitizeText, PRODUCT_NAME, FIXED_LISTS } from '@/config/onboarding-prompts';
import { syncProfileWithSupabase } from '@/lib/data/data-access';
import { trackOnboardingEvent } from '@/lib/telemetry/events';
import '@/app/onboarding.css';

const STORAGE_KEY = 'fikr_onboarding_v2';

interface OnboardingPersistedState {
  conversation: { q: string; a: string }[];
  currentQuestion: string;
  currentSpec: UISpec;
  reflection?: string;
  helperText?: string;
  allFacts: OnboardingFact[];
  lastTurnFacts: OnboardingFact[];
  isReady: boolean;
}

function loadSaved(): OnboardingPersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const CATEGORY_TITLES: Record<FactCategory, string> = {
  projects: 'Projects',
  people: 'People',
  commitments: 'Commitments',
  how_i_work: 'How I work',
  history: 'History',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { addLifeItem, updateLifeItem, removeLifeItem, showToast } = useApp();

  const [isHydrated, setIsHydrated] = useState(false);
  const [conversation, setConversation] = useState<{ q: string; a: string }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    'What is taking up most of your mind these days?'
  );
  const [reflection, setReflection] = useState<string | undefined>(undefined);
  const [helperText, setHelperText] = useState<string | undefined>(undefined);
  const [currentSpec, setCurrentSpec] = useState<UISpec>({
    type: 'text',
    ph: 'A project, a worry, anything',
    multiline: true,
  });

  const [isThinking, setIsThinking] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>('');
  const [lastQuestionDimmed, setLastQuestionDimmed] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  // Stored facts adhering strictly to schema (single source of truth)
  const [allFacts, setAllFacts] = useState<OnboardingFact[]>([]);
  // Facts from the immediate last turn for the "Just now" card
  const [lastTurnFacts, setLastTurnFacts] = useState<OnboardingFact[]>([]);

  // Input state
  const [textInput, setTextInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [rankItems, setRankItems] = useState<string[]>([]);
  const [timeChips, setTimeChips] = useState<string[]>([]);
  const [timeFrom, setTimeFrom] = useState('22:00');
  const [timeTo, setTimeTo] = useState('06:30');
  const [optionalDetailText, setOptionalDetailText] = useState('');

  // Live announcer for rank
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  // Memory Sheet Overlay
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmForgetId, setConfirmForgetId] = useState<string | null>(null);

  // Connectivity & Resilience
  const [isOffline, setIsOffline] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Focus preservation
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Guard: if already completed onboarding, redirect to /today
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('fikr_onboarding_done') === 'true') {
      router.replace('/today');
    }
  }, [router]);

  // Rehydrate state
  useEffect(() => {
    const t = setTimeout(() => {
    setIsHydrated(true);
    const saved = loadSaved();
    if (saved) {
      if (saved.conversation) setConversation(saved.conversation);
      if (saved.currentQuestion) setCurrentQuestion(saved.currentQuestion);
      if (saved.currentSpec) {
        setCurrentSpec(saved.currentSpec);
        if (saved.currentSpec.type === 'rank' && saved.currentSpec.items) {
          setRankItems(saved.currentSpec.items);
        }
      }
      if (saved.reflection) setReflection(saved.reflection);
      if (saved.helperText) setHelperText(saved.helperText);
      if (saved.allFacts) setAllFacts(saved.allFacts);
      if (saved.lastTurnFacts) setLastTurnFacts(saved.lastTurnFacts);
      if (saved.isReady) setIsReady(saved.isReady);
    } else {
      trackOnboardingEvent('onboarding_started');
    }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Sync rank items when spec changes
  useEffect(() => {
    const t = setTimeout(() => {
    if (currentSpec.type === 'rank' && currentSpec.items) {
      setRankItems(currentSpec.items);
    }
    // Reset selections on spec change
    setSelectedChoice(null);
    setSelectedChips([]);
    setTimeChips([]);
    setOptionalDetailText('');
    setTextInput('');
    setRetryError(null);
    }, 0);
    return () => clearTimeout(t);
  }, [currentSpec]);

  // Persist state to localStorage after turn
  const persist = useCallback((patch: Partial<OnboardingPersistedState>) => {
    try {
      const current = loadSaved() ?? {
        conversation: [],
        currentQuestion: 'What is taking up most of your mind these days?',
        currentSpec: { type: 'text', ph: 'A project, a worry, anything', multiline: true },
        allFacts: [],
        lastTurnFacts: [],
        isReady: false,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
    } catch {}
  }, []);

  // Trap back navigation
  useEffect(() => {
    try {
      localStorage.setItem('fikr_onboarding_reached', 'true');
    } catch {}
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Online / offline listeners

  // Single source of truth: Active facts count (Section 7)
  const activeFacts = isHydrated ? allFacts.filter((f) => f.status === 'active') : [];
  const activeCount = activeFacts.length;

  // Submit Answer to /api/onboarding
  const handleSubmitAnswer = async (answerPayload: string) => {
    const cleanedAnswer = sanitizeText(answerPayload);
    if (!cleanedAnswer) return;

    // Check offline status
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setPendingMessage(cleanedAnswer);
      showToast('Waiting for connection');
      return;
    }

    // Set UI to listening state
    setLastUserMessage(cleanedAnswer);
    setLastQuestionDimmed(currentQuestion);
    setIsThinking(true);
    setRetryError(null);

    const updatedHistory = [...conversation, { q: currentQuestion, a: cleanedAnswer }];
    setConversation(updatedHistory);

    const startTs = Date.now();

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: updatedHistory,
          existing_facts: allFacts,
        }),
      });

      const data = await res.json();
      const latencyMs = Date.now() - startTs;

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to connect');
      }

      const returnedAllFacts: OnboardingFact[] = Array.isArray(data.all_facts) ? data.all_facts : allFacts;
      const returnedNewFacts: OnboardingFact[] = Array.isArray(data.new_facts) ? data.new_facts : [];

      setAllFacts(returnedAllFacts);
      setLastTurnFacts(returnedNewFacts.filter((f) => f.status === 'active'));

      // Forward stated facts to Life store
      returnedNewFacts
        .filter((f) => f.status === 'active' && f.epistemic_state === 'stated')
        .forEach((f) => {
          addLifeItem(f.value, f.category, 'Onboarding');
        });

      // Track facts extracted
      if (returnedNewFacts.length > 0) {
        trackOnboardingEvent('facts_extracted', {
          factsCount: returnedNewFacts.length,
          categories: Array.from(new Set(returnedNewFacts.map((f) => f.category))),
        });
      }

      // Check Readiness
      if (data.is_complete) {
        setIsReady(true);
        persist({
          conversation: updatedHistory,
          allFacts: returnedAllFacts,
          lastTurnFacts: returnedNewFacts.filter((f) => f.status === 'active'),
          isReady: true,
        });
        trackOnboardingEvent('onboarding_ready', {
          turnCount: updatedHistory.length,
          factsCount: returnedAllFacts.filter((f) => f.status === 'active').length,
        });
        setIsThinking(false);
        return;
      }

      // Set next turn
      const nextQ = sanitizeText(data.next_question || 'What is taking up most of your mind?');
      const nextSpec: UISpec = data.ui_spec || { type: 'text', ph: 'A project, a worry, anything', multiline: true };
      const nextReflect: string | undefined = data.reflection ? sanitizeText(data.reflection) : undefined;

      setCurrentQuestion(nextQ);
      setCurrentSpec(nextSpec);
      setReflection(nextReflect);

      persist({
        conversation: updatedHistory,
        currentQuestion: nextQ,
        currentSpec: nextSpec,
        reflection: nextReflect,
        allFacts: returnedAllFacts,
        lastTurnFacts: returnedNewFacts.filter((f) => f.status === 'active'),
        isReady: false,
      });

      trackOnboardingEvent('turn_submitted', {
        uiType: nextSpec.type,
        slotTarget: data.target,
        latencyMs,
        modelUsed: data.metadata?.model,
        fallbackUsed: data.metadata?.fallbackUsed,
      });

      setIsThinking(false);
    } catch (err: any) {
      console.error('Onboarding turn error:', err);
      setIsThinking(false);
      setRetryError('That took too long. Check your connection and try again.');
      trackOnboardingEvent('model_error', { errorType: 'turn_submission_failed' });
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      showToast('Back online');
      if (pendingMessage) {
        const msg = pendingMessage;
        setPendingMessage(null);
        handleSubmitAnswer(msg);
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      showToast('Waiting for connection');
    };

    const initial = setTimeout(() => {
      if (typeof window !== 'undefined' && !navigator.onLine) setIsOffline(true);
    }, 0);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      clearTimeout(initial);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingMessage]);

  // Helper to construct submission text per UI spec
  const handlePrimaryAction = () => {
    if (isThinking) return;

    if (conversation.length === 0) {
      // Opening screen
      if (!textInput.trim()) return;
      handleSubmitAnswer(textInput.trim());
      return;
    }

    if (currentSpec.type === 'text') {
      if (!textInput.trim()) return;
      handleSubmitAnswer(textInput.trim());
      return;
    }

    if (currentSpec.type === 'choice') {
      if (!selectedChoice && !optionalDetailText.trim()) return;
      let text = selectedChoice || '';
      if (optionalDetailText.trim()) {
        text = text ? `${text}. ${optionalDetailText.trim()}` : optionalDetailText.trim();
      }
      handleSubmitAnswer(text);
      return;
    }

    if (currentSpec.type === 'chips') {
      if (selectedChips.length === 0 && !optionalDetailText.trim()) return;
      let text = selectedChips.length > 0 ? selectedChips.join(', ') : '';
      if (optionalDetailText.trim()) {
        text = text ? `${text}. ${optionalDetailText.trim()}` : optionalDetailText.trim();
      }
      handleSubmitAnswer(text);
      return;
    }

    if (currentSpec.type === 'rank') {
      if (rankItems.length === 0 && !optionalDetailText.trim()) return;
      let text = rankItems.length > 0 ? `Priority order: ${rankItems.join(', then ')}` : '';
      if (optionalDetailText.trim()) {
        text = text ? `${text}. ${optionalDetailText.trim()}` : optionalDetailText.trim();
      }
      handleSubmitAnswer(text);
      return;
    }

    if (currentSpec.type === 'time') {
      const parts = [...timeChips];
      if (timeFrom && timeTo) {
        parts.push(`Quiet from ${formatTime12h(timeFrom)} to ${formatTime12h(timeTo)}`);
      }
      if (parts.length === 0 && !optionalDetailText.trim()) return;
      let text = parts.length > 0 ? parts.join('. ') : '';
      if (optionalDetailText.trim()) {
        text = text ? `${text}. ${optionalDetailText.trim()}` : optionalDetailText.trim();
      }
      handleSubmitAnswer(text);
      return;
    }

    if (optionalDetailText.trim()) {
      handleSubmitAnswer(optionalDetailText.trim());
    }
  };

  // Choice tap handler (handles submit_on_tap)
  const handleSelectChoice = (option: ChoiceOption) => {
    const label = typeof option === 'string' ? option : option.label;
    setSelectedChoice(label);

    if (currentSpec.type === 'choice' && currentSpec.submit_on_tap) {
      trackOnboardingEvent('vent_branch_chosen', { chosenOption: label });
      handleSubmitAnswer(label);
    }
  };

  // Chip toggle handler
  const handleToggleChip = (chip: string) => {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  // Time chip toggle handler
  const handleToggleTimeChip = (chip: string) => {
    setTimeChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  // Rank reordering
  const handleMoveRank = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= rankItems.length) return;

    const next = [...rankItems];
    const item = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = item;
    setRankItems(next);

    setLiveAnnouncement(`${item} moved to position ${targetIdx + 1}`);
  };

  // "Skip for now" on opening screen
  const handleSkipForNow = async () => {
    trackOnboardingEvent('onboarding_skipped');
    try {
      localStorage.setItem('fikr_onboarding_done', 'true');
      await syncProfileWithSupabase({ onboarding_status: 'skipped' });
    } catch {}
    clearSaved();
    router.replace('/today');
  };

  // "Enough for now" link handler
  const handleEnoughForNow = () => {
    trackOnboardingEvent('enough_for_now', { factsCount: activeCount });
    if (activeCount === 0) {
      try {
        localStorage.setItem('fikr_onboarding_done', 'true');
        syncProfileWithSupabase({ onboarding_status: 'complete' });
      } catch {}
      clearSaved();
      router.replace('/today');
    } else {
      setIsReady(true);
      persist({ isReady: true });
    }
  };

  // "See my Today" in Ready State
  const handleCompleteOnboarding = async () => {
    trackOnboardingEvent('onboarding_completed', { factsCount: activeCount });
    try {
      localStorage.setItem('fikr_onboarding_done', 'true');
      await syncProfileWithSupabase({ onboarding_status: 'complete' });
    } catch {}
    clearSaved();
    router.replace('/today');
  };

  // Memory Sheet Fact Actions
  const handleSaveEditFact = (factId: string) => {
    if (!editValue.trim()) return;
    const nextVal = editValue.trim();

    setAllFacts((prev) =>
      prev.map((f) => (f.id === factId ? { ...f, value: nextVal } : f))
    );

    const fact = allFacts.find((f) => f.id === factId);
    if (fact) {
      updateLifeItem(fact.id, { text: nextVal });
    }

    persist({
      allFacts: allFacts.map((f) => (f.id === factId ? { ...f, value: nextVal } : f)),
    });

    trackOnboardingEvent('fact_edited');
    setEditingFactId(null);
    setEditValue('');
    showToast('Updated');
  };

  const handleForgetFact = (factId: string) => {
    // Hard delete from database and active list per Section 7 & 11
    setAllFacts((prev) => prev.filter((f) => f.id !== factId));
    setLastTurnFacts((prev) => prev.filter((f) => f.id !== factId));
    removeLifeItem(factId);

    persist({
      allFacts: allFacts.filter((f) => f.id !== factId),
      lastTurnFacts: lastTurnFacts.filter((f) => f.id !== factId),
    });

    trackOnboardingEvent('fact_forgotten');
    setConfirmForgetId(null);
    showToast('Forgotten');
  };

  // Format 24h to 12h display
  const formatTime12h = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Compute disabled state for primary button
  const isPrimaryDisabled = (): boolean => {
    if (isThinking) return true;
    if (conversation.length === 0) return !textInput.trim();
    if (currentSpec.type === 'text') return !textInput.trim();
    if (currentSpec.type === 'choice') return !selectedChoice && !optionalDetailText.trim();
    if (currentSpec.type === 'chips') return selectedChips.length === 0 && !optionalDetailText.trim();
    if (currentSpec.type === 'rank') return rankItems.length < 2 && !optionalDetailText.trim();
    if (currentSpec.type === 'time') return timeChips.length === 0 && (!timeFrom || !timeTo) && !optionalDetailText.trim();
    return false;
  };

  // Ready state previews derived from stated facts
  const projectFact = activeFacts.find((f) => f.category === 'projects' || f.category === 'commitments');
  const personFact = activeFacts.find((f) => f.category === 'people' || (f.category === 'commitments' && f.id !== projectFact?.id));

  return (
    <div className="ob-viewport">
      <main className="ob-shell">
        {/* Offline Banner */}
        {isOffline && (
          <div className="ob-offline-banner" role="alert">
            <span>&#9888;</span> Waiting for connection…
          </div>
        )}

        {/* Retry Error Banner */}
        {retryError && (
          <div className="ob-offline-banner" role="alert">
            {retryError}
          </div>
        )}

        {/* Header */}
        <header className="ob-header">
          <div className="ob-logo-mark" aria-label="Fikr logo">
            f
          </div>

          {/* Remembered Pill: Hide when count is 0 (Section 3 & 7) */}
          {activeCount > 0 && !isReady && (
            <button
              type="button"
              className="ob-pill-remembered"
              onClick={() => setSheetOpen(true)}
              aria-label={`${activeCount} remembered, open memory sheet`}
            >
              <span className="ob-pill-badge" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3A0E1A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              {activeCount} remembered
            </button>
          )}
        </header>

        {/* READY STATE SCREEN (Section 9) */}
        {isReady ? (
          <div className="ob-stage">
            <h1 className="ob-ready-hero">
              That&apos;s enough
              <br />
              <span className="ob-ready-pill">to start.</span>
            </h1>
            <p className="ob-helper" style={{ margin: '20px 0 0' }}>
              Here&apos;s a first look at your Today. If I got anything wrong, tap it and fix it.
            </p>

            {/* Preview Cards Container */}
            <div className="ob-cards-container" aria-label="Today Preview">
              {projectFact && (
                <div
                  className="ob-card-today"
                  onClick={() => setSheetOpen(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>Today</div>
                  <div style={{ marginTop: '4px', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '20px', lineHeight: 1.15 }}>
                    {projectFact.value}
                  </div>
                  {projectFact.due_text && (
                    <div style={{ marginTop: '6px', fontSize: '14px', opacity: 0.9 }}>
                      Due {projectFact.due_text}
                    </div>
                  )}
                </div>
              )}

              {personFact && (
                <div
                  className="ob-card-followup"
                  onClick={() => setSheetOpen(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>Follow-up</div>
                  <div style={{ marginTop: '4px', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '20px', lineHeight: 1.15 }}>
                    {personFact.value}
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '2px solid var(--ob-line)', fontSize: '14px' }}>
                    <span style={{ fontWeight: 700 }}>Why:</span> you told me just now.
                  </div>
                </div>
              )}
            </div>

            <div className="ob-bottom-block">
              <button
                type="button"
                className="ob-primary-btn"
                onClick={handleCompleteOnboarding}
              >
                See my Today
              </button>
              <button
                type="button"
                className="ob-quiet-link"
                onClick={() => setSheetOpen(true)}
              >
                Review what I remembered
              </button>
            </div>
          </div>
        ) : (
          /* CONVERSATIONAL STAGE */
          <div className="ob-stage">
            {/* "Just now" card (Section 3) */}
            {lastTurnFacts.length > 0 && !isThinking && (
              <div
                className="ob-just-now"
                onClick={() => setSheetOpen(true)}
                role="region"
                aria-label="Recently remembered facts"
              >
                <div className="ob-just-now-header">
                  <span>Just now</span>
                  <span>You said &middot; tap to fix</span>
                </div>
                <div className="ob-just-now-list">
                  {lastTurnFacts.slice(0, 3).map((f) => (
                    <div key={f.id} className="ob-just-now-item">
                      <span className="ob-check-circle" aria-hidden="true">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3A0E1A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                      <span>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LISTENING STATE (Section 3) */}
            {isThinking ? (
              <div style={{ marginTop: '20px' }}>
                <p className="ob-dimmed-question">{lastQuestionDimmed}</p>
                <div className="ob-user-bubble">{lastUserMessage}</div>
                <div className="ob-listening-pill" role="status" aria-live="polite">
                  <span>Listening</span>
                  <div className="ob-dots-wrapper" aria-hidden="true">
                    <span className="ob-dot" />
                    <span className="ob-dot" />
                    <span className="ob-dot" />
                  </div>
                </div>
              </div>
            ) : conversation.length === 0 ? (
              /* OPENING SCREEN (Section 3) */
              <>
                <p className="ob-reflection">
                  You don&apos;t have to explain your whole life to me. I&apos;ll learn it over time.
                </p>
                <h1 className="ob-hero-question">
                  What is taking up most of your mind these days?
                </h1>

                <div style={{ marginTop: '18px' }}>
                  <label htmlFor="mind-input" className="ob-input-label">
                    Write it however it comes
                  </label>
                  <textarea
                    id="mind-input"
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    className="ob-textarea"
                    placeholder="A project, a worry, anything"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '14px' }}>
                  <span className="ob-input-label">Not sure where to start?</span>
                  <div className="ob-chips-group">
                    {['A deadline', 'Someone I owe a reply', 'A decision', 'Just a lot'].map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        className="ob-starter-chip"
                        onClick={() => {
                          setTextInput((prev) => (prev ? `${prev} ${starter}` : starter));
                          inputRef.current?.focus();
                        }}
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="ob-privacy-line">
                  What you write is sent to an AI provider so I can understand it. You can see, edit or delete everything I remember.
                </p>

                <div className="ob-bottom-block">
                  <button
                    type="button"
                    className="ob-primary-btn"
                    disabled={isPrimaryDisabled()}
                    onClick={handlePrimaryAction}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    className="ob-quiet-link"
                    onClick={handleSkipForNow}
                  >
                    Skip for now
                  </button>
                </div>
              </>
            ) : (
              /* PROGRESSIVE TURNS (Section 4 & 5) */
              <>
                {reflection && <p className="ob-reflection">{reflection}</p>}
                <h1 className="ob-hero-question">{currentQuestion}</h1>
                {helperText && <p className="ob-helper">{helperText}</p>}

                {/* TEXT SPEC */}
                {currentSpec.type === 'text' && (
                  <div style={{ marginTop: '18px' }}>
                    {currentSpec.label && <span className="ob-input-label">{currentSpec.label}</span>}
                    <textarea
                      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                      className="ob-textarea"
                      placeholder={currentSpec.ph || 'A project, a worry, anything'}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                    />
                  </div>
                )}

                {/* CHOICE SPEC */}
                {currentSpec.type === 'choice' && (
                  <div className="ob-choice-group">
                    {currentSpec.options.map((opt, idx) => {
                      const label = typeof opt === 'string' ? opt : opt.label;
                      const sub = typeof opt === 'object' ? opt.sub : undefined;
                      const isSelected = selectedChoice === label;
                      const isLg = Boolean(sub);

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`ob-choice-btn ${isLg ? 'ob-choice-btn-lg' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectChoice(opt)}
                          aria-pressed={isSelected}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: isLg ? '17px' : '16px', fontWeight: 600 }}>{label}</span>
                            {sub && <span style={{ fontSize: '13px', fontWeight: 400, opacity: 0.9 }}>{sub}</span>}
                          </div>
                          <span className="ob-choice-radio-circle" aria-hidden="true">
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4F25A" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                              </svg>
                            )}
                          </span>
                        </button>
                      );
                    })}

                    {/* Optional Detail Field (Section 4) */}
                    {currentSpec.allow_text && !currentSpec.submit_on_tap && (
                      <div style={{ marginTop: '12px' }}>
                        <label htmlFor="choice-detail" className="ob-input-label">
                          {currentSpec.text_label || 'Anything to add? (optional)'}
                        </label>
                        <input
                          id="choice-detail"
                          type="text"
                          className="ob-text-input"
                          placeholder={currentSpec.text_ph || 'Add a detail, in your own words'}
                          value={optionalDetailText}
                          onChange={(e) => setOptionalDetailText(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* CHIPS SPEC */}
                {currentSpec.type === 'chips' && (
                  <div style={{ marginTop: '20px' }}>
                    <div className="ob-chips-group">
                      {currentSpec.options.map((chip, idx) => {
                        const isSelected = selectedChips.includes(chip);
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`ob-multichip ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggleChip(chip)}
                            aria-pressed={isSelected}
                          >
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3A0E1A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                              </svg>
                            )}
                            {chip}
                          </button>
                        );
                      })}
                    </div>

                    {currentSpec.allow_text && (
                      <div style={{ marginTop: '18px' }}>
                        <label htmlFor="chips-detail" className="ob-input-label">
                          {currentSpec.text_label || 'Add your own (optional)'}
                        </label>
                        <input
                          id="chips-detail"
                          type="text"
                          className="ob-text-input"
                          placeholder={currentSpec.text_ph || 'Anything else fixed in your week?'}
                          value={optionalDetailText}
                          onChange={(e) => setOptionalDetailText(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* RANK SPEC */}
                {currentSpec.type === 'rank' && (
                  <div style={{ marginTop: '20px' }}>
                    <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
                      {liveAnnouncement}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {rankItems.map((item, idx) => (
                        <div key={idx} className="ob-rank-row">
                          <span className="ob-rank-number">{idx + 1}</span>
                          <span style={{ flex: 1, fontSize: '16px', fontWeight: 600, lineHeight: 1.2 }}>{item}</span>
                          <button
                            type="button"
                            aria-label={`Move ${item} up`}
                            className="ob-rank-arrow-btn"
                            disabled={idx === 0}
                            onClick={() => handleMoveRank(idx, 'up')}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 15l6-6 6 6" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${item} down`}
                            className="ob-rank-arrow-btn"
                            disabled={idx === rankItems.length - 1}
                            onClick={() => handleMoveRank(idx, 'down')}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {currentSpec.allow_text && (
                      <div style={{ marginTop: '18px' }}>
                        <label htmlFor="rank-detail" className="ob-input-label">
                          {currentSpec.text_label || 'Anything to add? (optional)'}
                        </label>
                        <input
                          id="rank-detail"
                          type="text"
                          className="ob-text-input"
                          placeholder={currentSpec.text_ph || 'Why this order?'}
                          value={optionalDetailText}
                          onChange={(e) => setOptionalDetailText(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* TIME SPEC */}
                {currentSpec.type === 'time' && (
                  <div style={{ marginTop: '20px' }}>
                    <div className="ob-chips-group">
                      {(currentSpec.chips || FIXED_LISTS.quiet_times).map((chip, idx) => {
                        const isSelected = timeChips.includes(chip);
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`ob-multichip ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggleTimeChip(chip)}
                            aria-pressed={isSelected}
                          >
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3A0E1A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                              </svg>
                            )}
                            {chip}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: '22px' }}>
                      <span className="ob-input-label">Or set quiet hours</span>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <div className="ob-time-pill">
                          <label htmlFor="quiet-from" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ob-body)' }}>From</label>
                          <input
                            id="quiet-from"
                            type="time"
                            className="ob-time-input"
                            value={timeFrom}
                            onChange={(e) => setTimeFrom(e.target.value)}
                          />
                        </div>
                        <div className="ob-time-pill">
                          <label htmlFor="quiet-to" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ob-body)' }}>To</label>
                          <input
                            id="quiet-to"
                            type="time"
                            className="ob-time-input"
                            value={timeTo}
                            onChange={(e) => setTimeTo(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {currentSpec.allow_text && (
                      <div style={{ marginTop: '18px' }}>
                        <label htmlFor="time-detail" className="ob-input-label">
                          {currentSpec.text_label || 'Anything to add? (optional)'}
                        </label>
                        <input
                          id="time-detail"
                          type="text"
                          className="ob-text-input"
                          placeholder={currentSpec.text_ph || 'Add a detail, in your own words'}
                          value={optionalDetailText}
                          onChange={(e) => setOptionalDetailText(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Buttons (unless submit_on_tap) */}
                {!(currentSpec.type === 'choice' && currentSpec.submit_on_tap) && (
                  <div className="ob-bottom-block">
                    <button
                      type="button"
                      className="ob-primary-btn"
                      disabled={isPrimaryDisabled()}
                      onClick={handlePrimaryAction}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      className="ob-quiet-link"
                      onClick={handleEnoughForNow}
                    >
                      Enough for now
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MEMORY SHEET OVERLAY (Section 7) */}
        {sheetOpen && (
          <div className="ob-sheet-overlay" role="dialog" aria-modal="true" aria-label="Memory sheet">
            <div className="ob-sheet-content">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '46px' }}>
                <button
                  type="button"
                  className="ob-sheet-back"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Back to onboarding"
                >
                  <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chev" size={20} /></span>
                </button>
              </div>

              {/* Title with exact active count (Fixes Bug per Section 7) */}
              <h1 style={{ margin: '22px 0 0', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '40px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                {activeCount} remembered
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: '15px', lineHeight: 1.45, color: 'var(--ob-body)' }}>
                Everything here is what you told me. Tap anything to fix it.
              </p>

              {/* Categories with items */}
              {(['projects', 'people', 'commitments', 'how_i_work', 'history'] as FactCategory[]).map((cat) => {
                const catFacts = activeFacts.filter((f) => f.category === cat);
                if (catFacts.length === 0) return null;

                return (
                  <div key={cat} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="ob-sheet-section-pill">
                      {CATEGORY_TITLES[cat]}
                    </div>

                    {catFacts.map((fact) => (
                      <div key={fact.id} className="ob-sheet-fact-card">
                        {editingFactId === fact.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              type="text"
                              className="ob-text-input"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                style={{
                                  flex: 1,
                                  height: '40px',
                                  borderRadius: '20px',
                                  border: '2.5px solid var(--ob-line)',
                                  background: 'var(--ob-lime)',
                                  color: 'var(--ob-card-ink)',
                                  fontWeight: 700,
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => handleSaveEditFact(fact.id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                style={{
                                  flex: 1,
                                  height: '40px',
                                  borderRadius: '20px',
                                  border: '2.5px solid var(--ob-line)',
                                  background: 'var(--ob-field)',
                                  color: 'var(--ob-ink)',
                                  fontWeight: 700,
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setEditingFactId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : confirmForgetId === fact.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontWeight: 700 }}>Forget this?</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                style={{
                                  flex: 1,
                                  height: '40px',
                                  borderRadius: '20px',
                                  border: '2.5px solid var(--ob-line)',
                                  background: 'var(--ob-primary-btn)',
                                  color: 'var(--ob-card-ink)',
                                  fontWeight: 700,
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => handleForgetFact(fact.id)}
                              >
                                Forget
                              </button>
                              <button
                                type="button"
                                style={{
                                  flex: 1,
                                  height: '40px',
                                  borderRadius: '20px',
                                  border: '2.5px solid var(--ob-line)',
                                  background: 'var(--ob-field)',
                                  color: 'var(--ob-ink)',
                                  fontWeight: 700,
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => setConfirmForgetId(null)}
                              >
                                Keep
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div>{fact.value}</div>
                            {fact.due_text && (
                              <div style={{ fontSize: '13px', color: 'var(--ob-muted)', marginTop: '4px' }}>
                                Due {fact.due_text}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button
                                type="button"
                                style={{
                                  flex: 1,
                                  height: '44px',
                                  borderRadius: '22px',
                                  border: '2.5px solid var(--ob-line)',
                                  background: 'var(--ob-lime)',
                                  color: 'var(--ob-card-ink)',
                                  fontFamily: "'Figtree', sans-serif",
                                  fontWeight: 600,
                                  fontSize: '15px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setEditingFactId(fact.id);
                                  setEditValue(fact.value);
                                  setConfirmForgetId(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{
                                  flex: 1,
                                  height: '44px',
                                  borderRadius: '22px',
                                  border: '2.5px solid var(--ob-line)',
                                  background: 'var(--ob-bg)',
                                  color: 'var(--ob-ink)',
                                  fontFamily: "'Figtree', sans-serif",
                                  fontWeight: 600,
                                  fontSize: '15px',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setConfirmForgetId(fact.id);
                                  setEditingFactId(null);
                                }}
                              >
                                Forget this
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
