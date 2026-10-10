'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { syncCheckinWithSupabase } from '@/lib/data/data-access';

interface EveningStep {
  title: string;
  subtitle: string;
  placeholder: string;
  key: 'what_happened' | 'what_changed' | 'what_remains_important' | 'what_tomorrow_should_know';
}

const EVENING_STEPS: EveningStep[] = [
  {
    title: 'What happened today?',
    subtitle: 'A quiet reflection, not a productivity report. What actually took place?',
    placeholder: 'e.g. Spent morning with Aisha on retreat logistics; proposal stayed on hold...',
    key: 'what_happened',
  },
  {
    title: 'What changed?',
    subtitle: 'Did any plans shift, resolve, or change in your headspace or commitments?',
    placeholder: 'e.g. Decided to postpone the photo shoot; proposal intro is due Friday...',
    key: 'what_changed',
  },
  {
    title: 'What remains important?',
    subtitle: 'The open commitments or priorities that still hold weight heading forward.',
    placeholder: 'e.g. Sending Zara the notes and writing the first proposal paragraph...',
    key: 'what_remains_important',
  },
  {
    title: 'What should tomorrow know?',
    subtitle: 'The context, reminders, or focus you want to wake up to in the morning.',
    placeholder: 'e.g. Protect 9 to 11 for the proposal intro before the council meeting...',
    key: 'what_tomorrow_should_know',
  },
];

export default function EveningPage() {
  const router = useRouter();
  const { state, setState, addLifeItem, showToast } = useApp();

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({
    what_happened: '',
    what_changed: '',
    what_remains_important: '',
    what_tomorrow_should_know: '',
  });
  const [currentText, setCurrentText] = useState('');

  const step = EVENING_STEPS[currentStepIdx];
  const isLastStep = currentStepIdx === EVENING_STEPS.length - 1;

  const handleNext = async (skipped = false) => {
    const textToSave = skipped ? '' : currentText.trim();
    const updatedAnswers = {
      ...answers,
      [step.key]: textToSave,
    };
    setAnswers(updatedAnswers);

    if (!isLastStep) {
      setCurrentStepIdx((prev) => prev + 1);
      setCurrentText('');
    } else {
      await finishEveningLoop(updatedAnswers);
    }
  };

  const finishEveningLoop = async (finalAnswers: Record<string, string>) => {
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    // 1. Extract any new facts/commitments mentioned during check-in
    if (finalAnswers.what_changed && finalAnswers.what_changed.length > 5) {
      addLifeItem(
        finalAnswers.what_changed,
        'commitments',
        'Evening check-in'
      );
    }

    if (
      finalAnswers.what_remains_important &&
      finalAnswers.what_remains_important.length > 5 &&
      finalAnswers.what_remains_important !== finalAnswers.what_changed
    ) {
      addLifeItem(
        finalAnswers.what_remains_important,
        'commitments',
        'Evening check-in'
      );
    }

    // 2. Build tomorrow notes and yesterday history for Today feed
    const tomorrowNotes: string[] = [];
    if (finalAnswers.what_tomorrow_should_know) {
      tomorrowNotes.push(finalAnswers.what_tomorrow_should_know);
    }
    if (finalAnswers.what_remains_important) {
      tomorrowNotes.push(finalAnswers.what_remains_important);
    }

    const yesterdayItem = {
      msg: finalAnswers.what_happened || 'Reviewed your day.',
      outcome:
        finalAnswers.what_remains_important ||
        finalAnswers.what_tomorrow_should_know ||
        'Held in your thoughts for tomorrow.',
    };

    // 3. Write to local storage daily_context
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'fikr_daily_context_v1',
          JSON.stringify({
            date: todayDate,
            answers: finalAnswers,
            completed_at: nowIso,
          })
        );
      } catch (e) {
        console.warn('Local daily_context save failed:', e);
      }
    }

    // 4. Sync to Supabase checkins table
    syncCheckinWithSupabase({
      date: todayDate,
      answers: finalAnswers,
    });

    // 5. Update AppState to feed tomorrow's Today
    setState((prev) => ({
      ...prev,
      eveDone: true,
      eve1: false,
      tomorrow: tomorrowNotes,
      hist: [
        {
          label: 'Yesterday',
          items: [yesterdayItem],
        },
      ],
      log: [
        ...prev.log,
        {
          msg: 'Evening check-in',
          kind: 'eve',
          sys: true,
          done: true,
          outcome: 'Tomorrow will know what you told it.',
          tr: [
            { q: 'What happened', a: finalAnswers.what_happened || 'Skipped' },
            { q: 'What changed', a: finalAnswers.what_changed || 'Skipped' },
            { q: 'What remains important', a: finalAnswers.what_remains_important || 'Skipped' },
            { q: 'What should tomorrow know', a: finalAnswers.what_tomorrow_should_know || 'Skipped' },
          ],
        },
      ],
    }));

    router.push('/today');
    setTimeout(() => {
      showToast('Rest well. Tomorrow will know what you told it.');
    }, 100);
  };

  return (
    <PhoneShell>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '0 4px',
        }}
      >
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={() => router.back()}
          style={{ alignSelf: 'flex-start', margin: 0 }}
        >
          <Arrow dir="l" />
        </button>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--mute)',
            }}
          >
            Evening Conversation
          </span>
          <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
            &bull; Step {currentStepIdx + 1} of {EVENING_STEPS.length}
          </span>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '6px', margin: '8px 0 16px' }}>
          {EVENING_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: '4px',
                flex: 1,
                borderRadius: '2px',
                background:
                  i === currentStepIdx
                    ? 'var(--lime)'
                    : i < currentStepIdx
                    ? 'var(--ink)'
                    : 'var(--border)',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>

        <h1
          id="et"
          style={{
            fontSize: '24px',
            fontWeight: 900,
            lineHeight: 1.25,
            margin: '0 0 8px',
          }}
        >
          {step.title}
        </h1>

        <p
          className="m"
          style={{
            fontSize: '14px',
            color: 'var(--mute)',
            lineHeight: 1.45,
            margin: '0 0 16px',
          }}
        >
          {step.subtitle}
        </p>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            aria-label={step.title}
            placeholder={step.placeholder}
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            autoFocus
            rows={5}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--cink)',
              fontSize: '15px',
              lineHeight: 1.45,
              resize: 'none',
              marginBottom: '12px',
            }}
          />

          <button
            className="btn"
            type="button"
            onClick={() => handleNext(false)}
            style={{ margin: '0 0 8px' }}
          >
            {isLastStep ? 'Finish check-in' : 'Continue'}
          </button>

          <button
            className="lnk"
            id="sk"
            type="button"
            style={{ textAlign: 'center', padding: '6px', fontSize: '13px', color: 'var(--mute)' }}
            onClick={() => handleNext(true)}
          >
            Skip this question
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
