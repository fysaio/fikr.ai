'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { createClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/telemetry/events';
import '@/app/auth.css';

type ResetState = 'form' | 'done' | 'expired' | 'checking';

function ResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<ResetState>('checking');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  useEffect(() => {
    // Check URL parameters for explicit errors (e.g., Supabase OTP expired or invalid token)
    const errorParam = searchParams.get('error') || searchParams.get('error_code');
    const testParam = searchParams.get('test');

    if (testParam === 'expired' || errorParam) {
      trackAuthEvent('reset_link_expired');
      setState('expired');
      return;
    }

    if (testParam === 'done') {
      setState('done');
      return;
    }

    // Check if recovery session or hash is present
    const checkRecoverySession = async () => {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (hash.includes('error=')) {
          trackAuthEvent('reset_link_expired');
          setState('expired');
          return;
        }

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        // In Supabase, arriving via reset email initiates a session or emits PASSWORD_RECOVERY
        const { data: { user } } = await supabase.auth.getUser();

        if (session || user || hash.includes('access_token=') || searchParams.get('code')) {
          setState('form');
        } else {
          // No recovery token or session present -> link expired/invalid
          trackAuthEvent('reset_link_expired');
          setState('expired');
        }
      } catch (err) {
        trackAuthEvent('reset_link_expired');
        setState('expired');
      }
    };

    checkRecoverySession();

    return () => {
      setShowPassword(false);
    };
  }, [searchParams]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || password.length < 8) return;

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('Saving needs a connection. Try again when you’re back online.');
      setLiveAnnouncement('Error: Saving needs a connection. Try again when you’re back online.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // 15s timeout
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setErrorMessage('That took too long. Check your connection and try again.');
      setLiveAnnouncement('Error: That took too long. Check your connection and try again.');
    }, 15000);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      clearTimeout(timeoutTimer);
      if (timedOut) return;

      if (error) {
        if (
          error.message?.toLowerCase().includes('expired') ||
          error.message?.toLowerCase().includes('token') ||
          error.status === 401
        ) {
          trackAuthEvent('reset_link_expired');
          setState('expired');
          setLoading(false);
          return;
        }
        setErrorMessage(error.message || 'Could not update password. Try again.');
        setLiveAnnouncement(`Error: ${error.message}`);
        setLoading(false);
        return;
      }

      // Successful password update
      trackAuthEvent('reset_succeeded');

      // Guarantee no automatic login: sign out immediately
      await supabase.auth.signOut();

      setState('done');
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (timedOut) return;
      setErrorMessage('That took too long or connection failed. Try again.');
      setLoading(false);
    }
  };

  const isRuleMet = password.length >= 8;
  const isSubmitDisabled = !isRuleMet || loading;

  // 1. Checking State (brief initial check)
  if (state === 'checking') {
    return (
      <PhoneShell flush>
        <div className="auth-screen">
          <div style={{ height: '46px' }} />
          <h1 className="auth-headline">
            Checking
            <br />
            <span className="auth-highlight">link…</span>
          </h1>
        </div>
      </PhoneShell>
    );
  }

  // 2. Done State
  if (state === 'done') {
    return (
      <PhoneShell flush>
        <div className="auth-screen reset-done-screen">
          <div style={{ height: '46px' }} />

          {/* Headline */}
          <h1 className="auth-headline">
            Password
            <br />
            <span className="auth-highlight">updated.</span>
          </h1>

          {/* Subtitle */}
          <p className="auth-body-text">Log in with your new password.</p>

          {/* Primary Button to /login */}
          <Link
            href="/login"
            className="auth-btn auth-btn-primary"
            style={{ marginTop: '24px' }}
          >
            Log in
          </Link>

          {/* Decorative Lilac Card: Your memory */}
          <div className="auth-card auth-card-lilac" style={{ marginTop: '26px' }} aria-hidden="true">
            <div className="auth-card-tag">Your memory</div>
            <div className="auth-card-title">Right where you left it.</div>
            <div className="auth-card-desc">
              Everything I remember, you can see and change.
            </div>
          </div>
        </div>
      </PhoneShell>
    );
  }

  // 3. Expired State
  if (state === 'expired') {
    return (
      <PhoneShell flush>
        <div className="auth-screen reset-expired-screen">
          <div style={{ height: '46px' }} />

          {/* Headline */}
          <h1 className="auth-headline">
            Link
            <br />
            <span className="auth-highlight">expired.</span>
          </h1>

          {/* Subtitle */}
          <p className="auth-body-text">
            That reset link no longer works. Ask for a fresh one.
          </p>

          {/* Primary Button to /forgot */}
          <Link
            href="/forgot"
            className="auth-btn auth-btn-primary"
            style={{ marginTop: '24px' }}
          >
            Send a new link
          </Link>

          {/* Link back to login */}
          <div style={{ marginTop: '6px', textAlign: 'center' }}>
            <Link href="/login" className="auth-link">
              Back to log in
            </Link>
          </div>

          {/* Decorative Tangerine Card: Usually one of these */}
          <div className="auth-card auth-card-tangerine" style={{ marginTop: '26px' }} aria-hidden="true">
            <div className="auth-card-title-steps">Usually one of these</div>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', lineHeight: '1.3' }}>
              <div>The link was already used.</div>
              <div>It&apos;s been a while since it was sent.</div>
            </div>
          </div>
        </div>
      </PhoneShell>
    );
  }

  // 4. Form State
  return (
    <PhoneShell flush>
      <div className="auth-screen reset-screen">
        <div role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>

        {/* Back Link to /login */}
        <Link href="/login" aria-label="Back to log in" className="auth-back-btn">
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
        <h1 className="auth-headline">
          Choose a
          <br />
          <span className="auth-highlight">new one.</span>
        </h1>

        {/* Subtitle */}
        <p className="auth-body-text">Then you&apos;re back in.</p>

        {/* Form */}
        <form className="auth-form" onSubmit={handlePasswordSubmit} noValidate>
          <div className="auth-fields">
            <div className="auth-field-group">
              <label htmlFor="password" className="auth-label">
                New password
              </label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input has-eye"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="auth-eye-btn"
                >
                  {showPassword ? (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Rule pill: At least 8 characters */}
          <div className="auth-rule-pill">
            <span className={`auth-rule-circle ${isRuleMet ? 'checked' : ''}`}>
              {isRuleMet && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            At least 8 characters
          </div>

          {errorMessage && (
            <div role="alert" className="auth-field-error" style={{ marginTop: '12px' }}>
              <svg
                className="auth-error-icon"
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
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Save password button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            aria-disabled={isSubmitDisabled}
            className={`auth-btn ${isSubmitDisabled ? 'auth-btn-disabled' : 'auth-btn-primary'}`}
            style={{ marginTop: '24px' }}
          >
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </PhoneShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetContent />
    </Suspense>
  );
}
