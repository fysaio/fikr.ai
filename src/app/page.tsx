'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const router = useRouter();
  const { state, setName } = useApp();

  useEffect(() => {
    async function checkRootState() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          // 1. Logged out or first visit
          router.replace('/welcome');
          return;
        }

        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, onboarding_status')
          .eq('id', session.user.id)
          .maybeSingle();

        const name = profile?.name || state.name;
        if (name && !state.name) {
          setName(name);
        }

        const isOnboarded =
          profile?.onboarding_status === 'complete' ||
          profile?.onboarding_status === 'skipped' ||
          (typeof window !== 'undefined' && localStorage.getItem('fikr_onboarding_done') === 'true');

        if (!name) {
          // 2. Logged in, no name
          router.replace('/you?complete=1');
        } else if (!isOnboarded) {
          // 3. Logged in, onboarding incomplete
          router.replace('/onboarding');
        } else {
          // 4. Logged in and onboarded
          router.replace('/today');
        }
      } catch (err) {
        // Fallback for offline or local mock mode
        if (!state.name) {
          router.replace('/welcome');
        } else if (typeof window !== 'undefined' && localStorage.getItem('fikr_onboarding_done') === 'true') {
          router.replace('/today');
        } else {
          router.replace('/onboarding');
        }
      }
    }

    checkRootState();
  }, [router, state.name, setName]);

  return null;
}
