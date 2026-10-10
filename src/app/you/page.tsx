'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { useApp } from '@/context/AppContext';
import { AGE_MINIMUM } from '@/config/flags';
import { syncProfileWithSupabase } from '@/lib/data/data-access';
import { trackAuthEvent } from '@/lib/telemetry/events';
import '@/app/auth.css';
import './you.css';

function YouContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUnder = searchParams.get('under') === '1';
  const isComplete = searchParams.get('complete') === '1';

  const { state, setName } = useApp();

  const [nameInput, setNameInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('fikr_pending_name');
      if (stored !== null) return stored;
      return state.name && state.name !== 'there' ? state.name : '';
    }
    return state.name && state.name !== 'there' ? state.name : '';
  });

  const [ageInput, setAgeInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('fikr_pending_age') || '';
    }
    return '';
  });

  const [nameError, setNameError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // /you?under=1 Screen (no storage, no cookie, no network request)
  if (isUnder) {
    return (
      <PhoneShell flush>
        <div className="auth-screen you-screen">
          <div style={{ height: '46px' }} />

          <h1 className="auth-headline you-headline">
            Not
            <br />
            <span className="auth-highlight you-headline-highlight">yet.</span>
          </h1>

          <p className="auth-body-text you-body-text">
            This app is for people {AGE_MINIMUM} and older. Come back when you&apos;re there.
          </p>

          <Link
            href="/welcome"
            className="auth-btn auth-btn-primary"
            style={{ marginTop: '28px' }}
          >
            Back to start
          </Link>
        </div>
      </PhoneShell>
    );
  }

  // Field change handlers - no validation on keystroke!
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 40);
    setNameInput(val);
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Digits only, 1 to 3 characters
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 3);
    setAgeInput(digitsOnly);
  };

  // Blur validation: only fires on blur, never on keystroke
  const handleNameBlur = () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.length > 40) {
      setNameError('Tell me what to call you.');
      setLiveAnnouncement('Error: Tell me what to call you.');
    } else {
      setNameError(null);
    }
  };

  const handleAgeBlur = () => {
    // If complete mode and age not required/already saved, skip
    if (isComplete && !ageInput) return;

    const trimmed = ageInput.trim();
    const isDigitsOnly = /^\d+$/.test(trimmed);
    const num = isDigitsOnly ? parseInt(trimmed, 10) : NaN;
    if (!trimmed || !isDigitsOnly || isNaN(num) || num < 1 || num > 120) {
      setAgeError('Enter your age as a number.');
      setLiveAnnouncement('Error: Enter your age as a number.');
    } else {
      setAgeError(null);
    }
  };

  // Submit logic (on submit or Enter key)
  const doSubmit = async () => {
    const trimmedName = nameInput.trim();
    const trimmedAge = ageInput.trim();

    let hasValidationFailure = false;

    // Validate Name
    if (!trimmedName || trimmedName.length > 40) {
      setNameError('Tell me what to call you.');
      hasValidationFailure = true;
    } else {
      setNameError(null);
    }

    // Validate Age
    const isDigitsOnly = /^\d+$/.test(trimmedAge);
    const num = isDigitsOnly ? parseInt(trimmedAge, 10) : NaN;
    if (!trimmedAge || !isDigitsOnly || isNaN(num) || num < 1 || num > 120) {
      setAgeError('Enter your age as a number.');
      hasValidationFailure = true;
    } else {
      setAgeError(null);
    }

    if (hasValidationFailure) {
      setLiveAnnouncement(
        !trimmedName ? 'Error: Tell me what to call you.' : 'Error: Enter your age as a number.'
      );
      return;
    }

    // Age below minimum -> go to /you?under=1 with NO storage write or server requests
    if (num < AGE_MINIMUM) {
      trackAuthEvent('under_age_blocked');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('fikr_pending_name');
        sessionStorage.removeItem('fikr_pending_age');
        sessionStorage.removeItem('fikr_pending_age_verified');
      }
      router.push('/you?under=1');
      return;
    }

    // Valid submit: hold in memory/sessionStorage until signup succeeds
    trackAuthEvent('you_submitted');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('fikr_pending_name', trimmedName);
      sessionStorage.setItem('fikr_pending_age', String(num));
      sessionStorage.setItem('fikr_pending_age_verified', 'true');
    }
    setName(trimmedName);

    if (isComplete) {
      // User already logged in, updating missing profile info
      await syncProfileWithSupabase({
        name: trimmedName,
        age_verified: true,
      });
      router.replace('/onboarding');
    } else {
      router.push('/signup');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSubmit();
    }
  };

  const isButtonDisabled = nameInput.trim().length === 0 || ageInput.trim().length === 0;

  // Preview card greeting: Hello, <name>. (escaped)
  const trimmedName = nameInput.trim();
  const hasValidName = trimmedName.length >= 1 && trimmedName.length <= 40;
  const previewGreeting = hasValidName ? `Hello, ${trimmedName}.` : 'Hello, there.';

  return (
    <PhoneShell flush>
      <div className="auth-screen you-screen">
        {/* Single live region for error announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>

        {/* Back Link */}
        <Link href="/welcome" aria-label="Back" className="auth-back-btn you-back-btn">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M11 6l-6 6 6 6" />
          </svg>
        </Link>

        {/* Headline */}
        <h1 className="auth-headline you-headline">
          First, the
          <br />
          <span className="auth-highlight you-headline-highlight">basics.</span>
        </h1>

        {/* Subtitle */}
        <p className="auth-body-text you-body-text">Just enough to say hello properly.</p>

        {/* Fields Form */}
        <form className="auth-form you-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-fields you-fields">
            {/* Name Field */}
            <div className="auth-field-group you-field-group">
              <label htmlFor="name" className="auth-label you-label">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="given-name"
                maxLength={40}
                required
                aria-required="true"
                placeholder="What should I call you?"
                value={nameInput}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                onKeyDown={handleKeyDown}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? 'name-error' : undefined}
                className={`auth-input you-input ${nameError ? 'is-invalid you-input-error' : ''}`}
              />
              {nameError && (
                <div id="name-error" role="alert" className="auth-field-error you-field-error">
                  <svg
                    className="auth-error-icon you-error-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Error: {nameError}</span>
                </div>
              )}
            </div>

            {/* Age Field */}
            <div className="auth-field-group you-field-group">
              <label htmlFor="age" className="auth-label you-label">
                Age
              </label>
              <input
                id="age"
                name="age"
                type="text"
                inputMode="numeric"
                maxLength={3}
                required
                aria-required="true"
                placeholder="Your age"
                value={ageInput}
                onChange={handleAgeChange}
                onBlur={handleAgeBlur}
                onKeyDown={handleKeyDown}
                aria-invalid={!!ageError}
                aria-describedby={ageError ? 'age-error' : 'age-helper'}
                className={`auth-input you-input ${ageError ? 'is-invalid you-input-error' : ''}`}
              />
              {ageError && (
                <div id="age-error" role="alert" className="auth-field-error you-field-error">
                  <svg
                    className="auth-error-icon you-error-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Error: {ageError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Age Helper Text */}
          <div id="age-helper" className="auth-helper you-helper">
            You must be {AGE_MINIMUM} or older to use this app. Stays on your device until you sign up.
          </div>

          {/* Continue Button */}
          <button
            type="submit"
            aria-disabled={isButtonDisabled}
            aria-describedby={isButtonDisabled ? 'age-helper' : undefined}
            className={`auth-btn ${isButtonDisabled ? 'auth-btn-disabled' : 'auth-btn-primary'}`}
          >
            Continue
          </button>
        </form>

        {/* Login Link */}
        <div className="auth-sub-center you-login-line">
          Already have an account?{' '}
          <Link href="/login" className="auth-link you-login-link">
            Log in
          </Link>
        </div>

        {/* Decorative Preview Card */}
        <div className="auth-card auth-card-tangerine you-preview-card" style={{ width: '280px' }} aria-hidden="true">
          <div className="auth-card-tag you-preview-tag">Preview</div>
          <div className="auth-card-title you-preview-greeting" style={{ fontSize: '28px' }}>
            {previewGreeting}
          </div>
          <div className="auth-card-desc you-preview-sub">Good to meet you.</div>
        </div>
      </div>
    </PhoneShell>
  );
}

export default function YouPage() {
  return (
    <Suspense fallback={null}>
      <YouContent />
    </Suspense>
  );
}
