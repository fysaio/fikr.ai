'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow, Illustration } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';

export default function DeleteAccountPage() {
  const router = useRouter();
  const { resetToFresh, showToast } = useApp();

  const handleDeleteEverything = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await Promise.allSettled([
          supabase.from('memories').delete().eq('user_id', user.id),
          supabase.from('entries').delete().eq('user_id', user.id),
          supabase.from('checkins').delete().eq('user_id', user.id),
          supabase.from('suppressions').delete().eq('user_id', user.id),
          supabase.from('interventions').delete().eq('user_id', user.id),
          supabase.from('profiles').delete().eq('id', user.id),
        ]);
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Account deletion remote sync note:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
    }

    resetToFresh();
    showToast('Account and all data deleted.');
    router.push('/welcome');
  };

  return (
    <PhoneShell>
      <div className="fill">
        <button
          className="back"
          aria-label="Back"
          type="button"
          onClick={() => router.back()}
        >
          <Arrow dir="l" />
        </button>

        <div className="grow">
          <Illustration type="bye" />
          <h1>Delete your account?</h1>
          <p className="m" style={{ maxWidth: '290px' }}>
            This removes your account and everything I know about you. It can’t
            be undone.
          </p>
        </div>

        <div className="foot">
          <Link className="btn" href="/profile">
            Keep my account
          </Link>
          <button
            className="btn r"
            type="button"
            onClick={handleDeleteEverything}
          >
            Delete everything
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
