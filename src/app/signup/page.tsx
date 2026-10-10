'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { syncProfileWithSupabase } from '@/lib/data/data-access';
import { trackAuthEvent } from '@/lib/telemetry/events';
import '@/app/auth.css';

export default function SignupPage() {
  const router = useRouter();
  const { state, setName, showToast } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Check that name and age were held on device
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const heldName = sessionStorage.getItem('fikr_pending_name');
      const heldAge = sessionStorage.getItem('fikr_pending_age');
      if (!heldName || !heldAge) {
        router.replace('/you');
      }
    }
    // Reset password visibility when leaving page
    return () => {
      setShowPassword(false);
    };
  }, [router]);

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValid) {
      setEmailError('Enter a valid email address.');
      setLiveAnnouncement('Error: Enter a valid email address.');
    } else {
      setEmailError(null);
    }
  };

  const handlePasswordBlur = () => {
    if (!password) return;
    if (password.length < 8) {
      setPasswordError('Use at least 8 characters.');
      setLiveAnnouncement('Error: Use at least 8 characters.');
    } else {
      setPasswordError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    let hasError = false;

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setGeneralError('Creating an account needs a connection. Try again when you’re back online.');
      setLiveAnnouncement('Error: Creating an account needs a connection. Try again when you’re back online.');
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.');
      hasError = true;
    } else {
      setEmailError(null);
    }

    if (!password || password.length < 8) {
      setPasswordError('Use at least 8 characters.');
      hasError = true;
    } else {
      setPasswordError(null);
    }

    if (hasError) {
      setLiveAnnouncement('Error: Please correct the errors in the form.');
      return;
    }

    setLoading(true);
    setGeneralError(null);

    // 15-second timeout safeguard
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setGeneralError('That took too long. Check your connection and try again.');
      setLiveAnnouncement('Error: That took too long. Check your connection and try again.');
    }, 15000);

    try {
      const supabase = createClient();
      const pendingName =
        (typeof window !== 'undefined' && sessionStorage.getItem('fikr_pending_name')) ||
        state.name ||
        '';
      const pendingAge =
        typeof window !== 'undefined' ? sessionStorage.getItem('fikr_pending_age') : null;

      // Compute birth year or age band (not full date of birth)
      let birthYear: number | undefined;
      let ageBand = '';
      if (pendingAge) {
        const ageNum = parseInt(pendingAge, 10);
        if (!isNaN(ageNum)) {
          birthYear = new Date().getFullYear() - ageNum;
          if (ageNum < 18) ageBand = '16-17';
          else if (ageNum < 25) ageBand = '18-24';
          else if (ageNum < 35) ageBand = '25-34';
          else if (ageNum < 50) ageBand = '35-49';
          else ageBand = '50+';
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: pendingName,
            birth_year: birthYear,
            age_band: ageBand,
          },
        },
      });

      clearTimeout(timeoutTimer);
      if (timedOut) return;

      if (error) {
        trackAuthEvent('signup_failed', { errorType: error.code || 'provider_error' });
        // Never reveal whether the email exists
        setGeneralError("That didn't work. Try logging in instead, or check your details.");
        setLiveAnnouncement("Error: That didn't work. Try logging in instead, or check your details.");
        // Keep email, reset password field so user can retype
        setPassword('');
        setLoading(false);
        return;
      }

      trackAuthEvent('signup_succeeded');

      // Save profile name and age_verified
      if (pendingName) {
        setName(pendingName);
      }
      await syncProfileWithSupabase({
        name: pendingName,
        age_verified: true,
      });

      // Clear held values on device
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('fikr_pending_name');
        sessionStorage.removeItem('fikr_pending_age');
        sessionStorage.removeItem('fikr_pending_age_verified');
      }

      showToast('Account created.');
      router.replace('/onboarding');
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (timedOut) return;
      trackAuthEvent('signup_failed', { errorType: 'network_or_exception' });
      setGeneralError("That didn't work. Try logging in instead, or check your details.");
      setLiveAnnouncement("Error: That didn't work. Try logging in instead, or check your details.");
      setPassword('');
      setLoading(false);
    }
  };

  const isButtonDisabled = email.trim().length === 0 || password.length === 0 || loading;

  return (
    <PhoneShell flush>
      <div className="auth-screen signup-screen">
        {/* Live region for accessibility error announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>

        {/* Back Link to /you */}
        <Link href="/you" aria-label="Back" className="auth-back-btn">
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
          Make it
          <br />
          <span className="auth-highlight">yours.</span>
        </h1>

        {/* Subtitle */}
        <p className="auth-body-text">An email and a password. That&apos;s all.</p>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-fields">
            {/* Email Field */}
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
                  onBlur={handleEmailBlur}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  className={`auth-input ${emailError ? 'is-invalid' : ''}`}
                />
              </div>
              {emailError && (
                <div id="email-error" role="alert" className="auth-field-error">
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
                  <span>Error: {emailError}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="auth-field-group">
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={handlePasswordBlur}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? 'password-error' : 'password-helper'}
                  className={`auth-input has-eye ${passwordError ? 'is-invalid' : ''}`}
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
              {passwordError && (
                <div id="password-error" role="alert" className="auth-field-error">
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
                  <span>Error: {passwordError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Helper Text */}
          <div id="password-helper" className="auth-helper">
            At least 8 characters. Your memory stays yours: export or delete it any time.
          </div>

          {/* General Form Error */}
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

          {/* Continue Button */}
          <button
            type="submit"
            aria-disabled={isButtonDisabled}
            aria-describedby="password-helper"
            className={`auth-btn ${isButtonDisabled ? 'auth-btn-disabled' : 'auth-btn-primary'}`}
          >
            {loading ? 'Creating account…' : 'Continue'}
          </button>
        </form>

        {/* Login Link */}
        <div className="auth-sub-center">
          Already have an account?{' '}
          <Link href="/login" className="auth-link">
            Log in
          </Link>
        </div>

        {/* Decorative Tangerine Card: What happens next */}
        <div className="auth-card auth-card-tangerine" aria-hidden="true">
          <div className="auth-card-title-steps">What happens next</div>
          <div className="auth-card-steps">
            <div className="auth-card-step-item">
              <span className="auth-card-step-badge">1</span>
              <span>A short chat about what&apos;s on your mind</span>
            </div>
            <div className="auth-card-step-item">
              <span className="auth-card-step-badge">2</span>
              <span>Your first Today</span>
            </div>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}
