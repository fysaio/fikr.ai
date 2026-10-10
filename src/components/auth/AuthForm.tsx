'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Wordmark, Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';

interface AuthFormProps {
  isLogin?: boolean;
}

export const AuthForm: React.FC<AuthFormProps> = ({ isLogin = false }) => {
  const router = useRouter();
  const { state, showToast, setName } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isOffline = state.net === 'offline' || state.net === 'error';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOffline) {
      setErrorMessage(
        isLogin
          ? 'Logging in needs a connection. Try again when you’re back online.'
          : 'Creating an account needs a connection. Try again when you’re back online.'
      );
      return;
    }

    if (!email || !password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.warn('Login error:', error.message);
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        // Fetch user profile if exists to determine landing destination
        let profileName = '';
        let isOnboarded = false;

        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
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
          localStorage.getItem('fikr_onboarding_done') === 'true';

        showToast('Welcome back.');

        // Route appropriately based on onboarding stage
        if (!profileName) {
          router.replace('/you?complete=1');
        } else if (!isOnboarded && !isLocalOnboardingDone) {
          router.replace('/onboarding');
        } else {
          router.replace('/today');
        }
      } else {
        const redirectUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/api/auth/callback?next=/onboarding`
          : undefined;

        // Retrieve name held on device from /you
        const pendingName =
          (typeof window !== 'undefined' && sessionStorage.getItem('fikr_pending_name')) ||
          state.name ||
          '';

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: pendingName,
            },
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          console.warn('Signup error:', error.message);
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          // Account created: save name and age_verified to profile
          if (pendingName) {
            await syncProfileWithSupabase({
              name: pendingName,
              age_verified: true,
            });
            setName(pendingName);
          }
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('fikr_pending_name');
            sessionStorage.removeItem('fikr_pending_age');
            sessionStorage.removeItem('fikr_pending_age_verified');
            localStorage.setItem('fikr_onboarding_reached', 'true');
          }
          showToast('Account created.');
          router.replace('/onboarding');
        } else if (data.user) {
          // Email confirmation is required by Supabase settings
          setSuccessMessage(
            'Check your inbox to confirm your email, then return here to log in.'
          );
        } else {
          router.replace('/onboarding');
        }
      }
    } catch (err: any) {
      console.warn('Auth operation exception:', err);
      if (err?.message?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) {
        router.replace(isLogin ? '/today' : '/onboarding');
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/welcome');
    }
  };

  return (
    <PhoneShell>
      <div className="af">
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={handleBack}
        >
          <Arrow dir="l" />
        </button>

        <div className="fkr">
          <Wordmark height={18} />
        </div>

        <h1 className="ah">
          {isLogin ? (
            <>
              Welcome
              <br />
              <span>back.</span>
            </>
          ) : (
            <>
              Make it
              <br />
              <span>yours.</span>
            </>
          )}
        </h1>

        <p className="as">
          {isLogin
            ? 'Pick up where you left off.'
            : 'An email and a password. That’s all for now.'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="pw">
            <input
              type={showPassword ? 'text' : 'password'}
              id="pw"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              id="sp"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {errorMessage && (
            <p
              className="as err"
              id="aerr"
              style={{ fontSize: '14px', margin: '10px 2px 0' }}
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              className="as"
              id="asucc"
              style={{ fontSize: '14px', margin: '10px 2px 0', color: 'var(--lime)' }}
            >
              {successMessage}
            </p>
          )}

          <button
            className="btn"
            type="submit"
            style={{ marginTop: '16px' }}
            disabled={loading}
          >
            {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Continue'}
          </button>
        </form>

        <p className="alt">
          {isLogin ? (
            <>
              <Link href="/you">Create an account</Link> · Forgot password?
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Log in</Link>
            </>
          )}
        </p>

        <div className="peekw" aria-hidden="true">
          {isLogin ? (
            <div className="wc p2">
              <b>Yesterday is ready</b>
              <em>
                See what moved <Arrow dir="r" />
              </em>
            </div>
          ) : (
            <div className="wc p1">
              <b>What happens next</b>
              <div>1 · Your name</div>
              <div>2 · Five quick questions</div>
              <div>3 · Your first day</div>
            </div>
          )}
        </div>
      </div>
    </PhoneShell>
  );
};
