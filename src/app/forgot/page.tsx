'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthFrame } from '@/components/fk';
import { createClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/telemetry/events';
import '@/app/auth.css';

export default function ForgotPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(30);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendResetEmail = async (targetEmail: string) => {
    const trimmed = targetEmail.trim();
    if (!trimmed) return;

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setGeneralError('Sending reset link needs a connection. Try again when you’re back online.');
      setLiveAnnouncement('Error: Sending reset link needs a connection. Try again when you’re back online.');
      return;
    }

    setLoading(true);
    setGeneralError(null);

    // Track instrumentation
    trackAuthEvent('forgot_requested');

    try {
      const supabase = createClient();
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset`
          : undefined;

      // Rate limit check via server
      try {
        await fetch('/api/auth/reset-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check' }),
        });
      } catch {}

      // Call Supabase Auth reset password
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: redirectUrl,
      });

      // On submit always show the sent state, whether or not an account exists.
      // Never confirm whether an email exists.
      setIsSent(true);
      startCountdown();
    } catch (err: any) {
      // Still show the sent state to never confirm if an account exists
      setIsSent(true);
      startCountdown();
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) return;
    sendResetEmail(email);
  };

  const handleResend = () => {
    if (countdown > 0 || loading) return;
    sendResetEmail(email);
  };

  const isRequestDisabled = email.trim().length === 0 || loading;

  // Render Sent State
  if (isSent) {
    const formattedCountdown = `0:${countdown < 10 ? '0' : ''}${countdown}`;

    return (
      <AuthFrame>
        <div className="auth-screen forgot-sent-screen">
          <div role="status" aria-live="polite" className="sr-only">
            {liveAnnouncement}
          </div>

          {/* Back arrow to /forgot request state (prefilled) */}
          <button
            type="button"
            aria-label="Back"
            onClick={() => setIsSent(false)}
            className="auth-back-btn"
          >
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
          </button>

          {/* Headline */}
          <h1 className="auth-headline">
            Check your
            <br />
            <span className="auth-highlight">email.</span>
          </h1>

          {/* Subtitle */}
          <p className="auth-body-text">
            If there&apos;s an account for this address, a reset link is on its way.
          </p>

          {/* Typed email address in a pill (ellipsis if long) */}
          <div className="auth-email-pill" title={email}>
            {email}
          </div>

          {/* Spam folder note */}
          <div className="auth-helper" style={{ marginTop: '14px', fontSize: '14px' }}>
            Can&apos;t see it? Check your spam folder.
          </div>

          {/* Resend button with live countdown */}
          <button
            type="button"
            disabled={countdown > 0 || loading}
            aria-disabled={countdown > 0 || loading}
            onClick={handleResend}
            className={`auth-btn ${countdown > 0 || loading ? 'auth-btn-disabled' : 'auth-btn-primary'}`}
            style={{ marginTop: '24px' }}
          >
            {countdown > 0 ? `Resend in ${formattedCountdown}` : loading ? 'Sending…' : 'Resend email'}
          </button>

          {/* Link back to login */}
          <div style={{ marginTop: '6px', textAlign: 'center' }}>
            <Link href="/login" className="auth-link">
              Back to log in
            </Link>
          </div>

          {/* Decorative Tangerine Card: What happens next */}
          <div className="auth-card auth-card-tangerine" style={{ marginTop: '26px' }} aria-hidden="true">
            <div className="auth-card-title-steps">What happens next</div>
            <div className="auth-card-steps">
              <div className="auth-card-step-item">
                <span className="auth-card-step-badge">1</span>
                <span>Open the link in the email</span>
              </div>
              <div className="auth-card-step-item">
                <span className="auth-card-step-badge">2</span>
                <span>Choose a new password</span>
              </div>
            </div>
          </div>
        </div>
      </AuthFrame>
    );
  }

  // Render Request State
  return (
    <AuthFrame>
      <div className="auth-screen forgot-screen">
        <div role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>

        {/* Back Link to /login */}
        <Link href="/login" aria-label="Back" className="auth-back-btn">
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
          Reset your
          <br />
          <span className="auth-highlight">password.</span>
        </h1>

        {/* Subtitle */}
        <p className="auth-body-text">
          Enter your email and I&apos;ll send you a link to choose a new one.
        </p>

        {/* Form */}
        <form className="auth-form" onSubmit={handleRequestSubmit} noValidate>
          <div className="auth-fields">
            <div className="auth-field-group">
              <label htmlFor="email" className="auth-label">
                Email
              </label>
              <div className="auth-input-wrap">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>
            </div>
          </div>

          {generalError && (
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
              <span>{generalError}</span>
            </div>
          )}

          {/* Send reset link Button */}
          <button
            type="submit"
            disabled={isRequestDisabled}
            aria-disabled={isRequestDisabled}
            className={`auth-btn ${isRequestDisabled ? 'auth-btn-disabled' : 'auth-btn-primary'}`}
            style={{ marginTop: '24px' }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        {/* Link back to login */}
        <div style={{ marginTop: '6px', textAlign: 'center' }}>
          <Link href="/login" className="auth-link">
            Back to log in
          </Link>
        </div>

        {/* Decorative Lilac Card: Your memory */}
        <div className="auth-card auth-card-lilac" style={{ marginTop: '26px' }} aria-hidden="true">
          <div className="auth-card-tag">Your memory</div>
          <div className="auth-card-title">Safe while you reset.</div>
          <div className="auth-card-desc">
            Changing your password doesn&apos;t touch anything I remember.
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
