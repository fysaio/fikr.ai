import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AuthedUser { id: string; dev: boolean }

/** Resolves the signed-in user for an API route. Returns null when there is no session. */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configured = Boolean(url && !url.includes('placeholder') && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) {
    // Local development without Supabase: allow a fixed dev user. Never in production.
    return process.env.NODE_ENV === 'production' ? null : { id: '00000000-0000-0000-0000-000000000000', dev: true };
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id, dev: false } : null;
  } catch {
    return null;
  }
}
