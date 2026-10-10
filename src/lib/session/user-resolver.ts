import { clean } from '@/lib/sanitizer';

export interface ResolvedUser {
  id: string;
  name: string; // Clean trimmed name, or empty string
  greeting: string; // "Hello" if empty, "Hello, Name" if present
  initial: string | null; // Uppercase first letter if name present, or null
  timezone: string;
}

const STORAGE_KEY_PROFILE = 'fikr_user_profile_v1';

export function resolveUser(storedName?: string | null): ResolvedUser {
  let name = clean(storedName || '');
  if (name.toLowerCase() === 'there' || name.toLowerCase() === 'amina') {
    // Drop bad defaults
    name = '';
  }

  const greeting = name ? `Hello, ${name}` : 'Hello';
  const initial = name ? name[0].toUpperCase() : null;

  return {
    id: 'user_local_active',
    name,
    greeting,
    initial,
    timezone: 'Africa/Lagos',
  };
}

export function getSavedUserProfile(): ResolvedUser {
  if (typeof window === 'undefined') {
    return resolveUser('');
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return resolveUser(parsed.name);
    }
    // Check fallback in legacy app state
    const appState = localStorage.getItem('fikr_app_state_v1');
    if (appState) {
      const parsed = JSON.parse(appState);
      return resolveUser(parsed.name);
    }
  } catch {}

  return resolveUser('');
}

export function saveUserProfile(patch: { name?: string; timezone?: string }): ResolvedUser {
  const current = getSavedUserProfile();
  const updatedName = patch.name !== undefined ? clean(patch.name) : current.name;
  const resolved = resolveUser(updatedName);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify({
        id: resolved.id,
        name: resolved.name,
        timezone: resolved.timezone,
      }));
    } catch {}
  }

  return resolved;
}
