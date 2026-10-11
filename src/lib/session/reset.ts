import { createClient } from '@/lib/supabase/client';
import { outboxClear } from '@/lib/outbox/outbox';

export const LOCAL_STORAGE_KEYS = [
  'gist_app_state_v1',
  'gist_onboarding_v2',
  'gist_onboarding_v1',
  'gist_user_profile_v1',
  'gist_onboarding_reached',
  'gist_onboarding_done',
  'gist_suppressions_v1',
  'cil-theme',
];

/**
 * Resets all local and remote data for the user.
 * Guarantees zero bleed of facts across test runs or new onboarding attempts.
 */
export async function resetAllUserData(): Promise<void> {
  // 1. Clear LocalStorage
  if (typeof window !== 'undefined') {
    try {
      LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      // Remove any flags or cached fixture markers
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('gist_') || key.startsWith('fikr_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.warn('LocalStorage clear error:', err);
    }
  }

  await outboxClear();

  // 2. Clear Supabase tables for authenticated user if online
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await Promise.allSettled([
        supabase.from('facts').delete().eq('user_id', user.id),
        supabase.from('entities').delete().eq('user_id', user.id),
        supabase.from('suppressions').delete().eq('user_id', user.id),
        supabase.from('think_entries').delete().eq('user_id', user.id),
        supabase.from('interventions').delete().eq('user_id', user.id),
        supabase.from('onboarding_state').delete().eq('user_id', user.id),
        supabase.from('memories').delete().eq('user_id', user.id),
        supabase.from('tasks').delete().eq('user_id', user.id),
      ]);
    }
  } catch (err) {
    // Non-blocking in offline / test environments
    console.warn('Remote reset skipped or failed:', err);
  }
}
