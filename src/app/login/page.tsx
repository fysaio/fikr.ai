'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthFrame } from '@/components/fk';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/telemetry/events';
import '@/app/auth.css';

export default function LoginPage() {
  const router = useRouter();
  const { state, setName, showToast } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reset password visibility when leaving page
    return () => {
      setShowPassword(false);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    // Check offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('Logging in needs a connection. Try again when you’re back online.');
      setLiveAnnouncement('Error: Logging in needs a connection. Try again when you’re back online.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // 15s timeout safeguard
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setErrorMessage('That took too long. Check your connection and try again.');
      setLiveAnnouncement('Error: That took too long. Check your connection and try again.');
    }, 15000);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      clearTimeout(timeoutTimer);
      if (timedOut) return;

      if (error) {
        trackAuthEvent('login_failed', { errorType: error.code || 'invalid_credentials' });
        // Same message for both wrong email and wrong password, no hint which is wrong
        const msg = 'That email and password don’t match.';
        setErrorMessage(msg);
        setLiveAnnouncement(`Error: ${msg}`);
        setLoading(false);
        return;
      }

      trackAuthEvent('login_succeeded');
      showToast('Welcome back.');

      // State check on user profile
      let profileName = '';
      let isOnboarded = false;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, onboarding_status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.name) {
          profileName = profile.name;
          setName(profile.name);
        }
        if (profile?.onboarding_status === 'complete') {
          isOnboarded = true;
        }
      }

      const isLocalOnboardingDone =
        typeof window !== 'undefined' &&
        localStorage.getItem('gist_onboarding_done') === 'true';

      // Root check routing:
      // 1. Logged in, no name -> /you?complete=1
      // 2. Logged in, onboarding incomplete -> /onboarding
      // 3. Logged in and onboarded -> /today
      if (!profileName && !state.name) {
        router.replace('/you?complete=1');
      } else if (!isOnboarded && !isLocalOnboardingDone) {
        router.replace('/onboarding');
      } else {
        router.replace('/today');
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (timedOut) return;
      trackAuthEvent('login_failed', { errorType: 'network_or_exception' });
      const msg = 'That email and password don’t match.';
      setErrorMessage(msg);
      setLiveAnnouncement(`Error: ${msg}`);
      setLoading(false);
    }
  };

  const isButtonDisabled = email.trim().length === 0 || password.length === 0 || loading;

  return (
    <AuthFrame>
      <div className="auth-screen login-screen">
        {/* Single live region for error announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>

        {/* Back Link to /welcome */}
        <Link href="/welcome" aria-label="Back" className="auth-back-btn">
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
          Welcome
          <br />
          <span className="auth-highlight">back.</span>
        </h1>

        {/* Subtitle */}
        <p className="auth-body-text">Pick up where you left off.</p>

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
                  className="auth-input"
                  required
                />
              </div>
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
                  autoComplete="current-password"
                  placeholder="Your password"
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

          {/* Form Error */}
          {errorMessage && (
            <div
              role="alert"
              className="auth-field-error"
              style={{ marginTop: '12px' }}
            >
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

          {/* Log in Button */}
          <button
            type="submit"
            aria-disabled={isButtonDisabled}
            className={`auth-btn ${isButtonDisabled ? 'auth-btn-disabled' : 'auth-btn-primary'}`}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {/* Two links (each at least 44px high) */}
        <div className="auth-sub-links">
          <Link href="/you" className="auth-link">
            Create an account
          </Link>
          <Link href="/forgot" className="auth-link">
            Forgot password?
          </Link>
        </div>

        {/* Decorative Lilac Card: Your memory */}
        <div className="auth-card auth-card-lilac" aria-hidden="true">
          <div className="auth-card-tag">Your memory</div>
          <div className="auth-card-title">Right where you left it.</div>
          <div className="auth-card-desc">
            Everything I remember, you can see and change.
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
