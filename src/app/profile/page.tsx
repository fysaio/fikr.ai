'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow, RowIcon, Wordmark } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { exportAllUserData } from '@/lib/data/data-access';

const THEME_LABELS = {
  dark: 'Dark',
  light: 'Light',
  auto: 'Match my phone',
};

const NUDGE_OPTIONS = [
  'Only when I ask',
  'Morning, and when it helps',
  'Often',
];

export default function ProfilePage() {
  const router = useRouter();
  const { state, setTheme, setNudge, showToast, resetToFresh } = useApp();

  const handleCycleTheme = () => {
    const order: Array<'dark' | 'light' | 'auto'> = ['dark', 'light', 'auto'];
    const current = state.theme || 'dark';
    const nextIdx = (order.indexOf(current) + 1) % 3;
    setTheme(order[nextIdx]);
  };

  const handleCycleNudge = () => {
    const current = state.nudge || NUDGE_OPTIONS[1];
    const nextIdx = (NUDGE_OPTIONS.indexOf(current) + 1) % 3;
    const nextNudge = NUDGE_OPTIONS[nextIdx];
    setNudge(nextNudge);
    showToast(`Okay. ${nextNudge}.`);
  };

  const handleExportData = async () => {
    try {
      showToast('Preparing your download…');
      const jsonStr = await exportAllUserData(state);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fikr-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Your data downloaded as a file');
    } catch (e) {
      console.error(e);
      showToast('Export failed. Please try again.');
    }
  };

  const handleLogOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out exception:', e);
    }
    resetToFresh();
    showToast('Signed out.');
    router.push('/welcome');
  };

  const initial = (state.name || 'A')[0].toUpperCase();

  return (
    <PhoneShell>
      <button
        className="back"
        aria-label="Back"
        type="button"
        onClick={() => router.back()}
      >
        <Arrow dir="l" />
      </button>

      <div className="who">
        <div className="av2" suppressHydrationWarning>
          {initial}
        </div>
        <h1 suppressHydrationWarning>{state.name || 'Your Profile'}</h1>
      </div>

      <h4 className="sh">How I reach you</h4>
      <button
        className="row"
        type="button"
        onClick={() => showToast('Quiet hours active: 10pm to 7am. Silence is guaranteed.')}
      >
        <RowIcon
          path="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"
          color="var(--pur)"
        />
        <span className="rl">Quiet hours</span>
        <span className="m">10pm to 7am (Active)</span>
      </button>

      <button
        className="row"
        id="nz"
        type="button"
        onClick={handleCycleNudge}
      >
        <RowIcon
          path="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"
          color="var(--pur)"
        />
        <span className="rl">When I speak up</span>
        <span className="m" id="nv">
          {state.nudge || NUDGE_OPTIONS[1]}
        </span>
      </button>

      <Link className="row" href="/lock">
        <RowIcon path="M7 3h10v18H7zM11 18h2" color="var(--pur)" />
        <span className="rl">See notification styles</span>
        <span className="m">
          <Arrow dir="c" />
        </span>
      </Link>

      <h4 className="sh">Look</h4>
      <button
        className="row"
        id="th"
        type="button"
        onClick={handleCycleTheme}
      >
        <RowIcon
          path="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
          color="var(--org)"
        />
        <span className="rl">Appearance</span>
        <span className="m" id="thv" suppressHydrationWarning>
          {THEME_LABELS[state.theme || 'dark']}
        </span>
      </button>

      <h4 className="sh">Intelligence & Privacy</h4>
      <div
        style={{
          background: 'var(--card, rgba(255,255,255,0.03))',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '14px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: 'var(--sub, rgba(255,255,255,0.7))',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: '4px' }}>
          Third-Party AI: Groq (Llama 3.3 70B) & Google Gemini (Fallback)
        </div>
        <p style={{ margin: '0 0 6px 0' }}>
          Your onboarding answers and thoughts are processed by Groq (Llama 3.3 70B) as our primary provider, with Google Gemini as fallback, so {state.name ? state.name : 'you'} can be understood. Your text is strictly private and never used to train public foundation models.
        </p>
        <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
          Self-contained extraction · Full user delete & export rights
        </span>
      </div>

      <Link className="row" href="/cost">
        <RowIcon
          path="M3 3v18h18M7 16l4-8 5 5 5-9"
          color="var(--blue, #38bdf8)"
        />
        <span className="rl">Cost & Latency metrics</span>
        <span className="m">
          <Arrow dir="c" />
        </span>
      </Link>

      <h4 className="sh">Your data</h4>
      <button
        className="row"
        type="button"
        onClick={handleExportData}
      >
        <RowIcon
          path="M12 4v11M7 11l5 5 5-5M5 20h14"
          color="var(--org)"
        />
        <span className="rl">Export my data</span>
      </button>

      <h4 className="sh">Account</h4>
      <button
        className="row"
        type="button"
        onClick={handleLogOut}
      >
        <RowIcon
          path="M10 4H5v16h5M15 8l4 4-4 4M9 12h10"
          color="var(--mute)"
        />
        <span className="rl">Log out</span>
      </button>

      <Link className="row" style={{ color: 'var(--red)' }} href="/delete">
        <RowIcon
          path="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"
          color="var(--red)"
        />
        <span className="rl">Delete account</span>
      </Link>

      <div className="fkf">
        <Wordmark height={22} />
        <small>by Common Intelligence Labs</small>
      </div>
    </PhoneShell>
  );
}
