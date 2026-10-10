import { AppState, Memory, Task, Profile } from '@/types';
import {
  isFixturesEnabled,
  FIXTURE_USER_NAME,
  FIXTURE_TASKS,
  FIXTURE_SAMPLE_ANSWERS,
  FIXTURE_LIFE_DATA,
  FIXTURE_CHATS,
} from '@/fixtures';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'fikr_app_state_v1';

export function getFreshState(): AppState {
  return {
    name: '',
    ans: {},
    firstDone: false,
    done: {},
    showDone: false,
    undone: {},
    all: false,
    log: [],
    compact: false,
    hist: [],
    net: 'online',
    queue: 0,
    synced: 0,
    theme: 'dark',
    nudge: 'Morning, and when it helps',
    tomorrow: [],
    touched: true,
    fresh: true,
    eveDone: false,
    eve1: false,
    chats: [],
    life: {
      people: [],
      projects: [],
      goals: [],
      commitments: [],
      places: [],
      prefs: [],
      history: [],
      patterns: [],
    },
    tasks: [],
  };
}

export function getFixtureState(): AppState {
  return {
    name: FIXTURE_USER_NAME,
    ans: { ...FIXTURE_SAMPLE_ANSWERS },
    firstDone: false,
    done: {},
    showDone: false,
    undone: {},
    all: false,
    log: [],
    compact: false,
    hist: [
      {
        label: 'Yesterday',
        items: [
          {
            msg: 'I keep avoiding the proposal.',
            outcome: 'Held in your thoughts. Nothing became a task.',
          },
        ],
      },
    ],
    net: 'online',
    queue: 0,
    synced: 0,
    theme: 'dark',
    nudge: 'Morning, and when it helps',
    tomorrow: [],
    touched: false,
    fresh: false,
    eveDone: false,
    eve1: false,
    chats: [...FIXTURE_CHATS],
    life: JSON.parse(JSON.stringify(FIXTURE_LIFE_DATA)),
    tasks: [...FIXTURE_TASKS],
  };
}

export function loadInitialState(): AppState {
  if (typeof window === 'undefined') {
    return isFixturesEnabled() ? getFixtureState() : getFreshState();
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.life && typeof parsed.life === 'object') {
        const seenIds = new Set<string>();
        for (const cat in parsed.life) {
          if (Array.isArray(parsed.life[cat])) {
            parsed.life[cat] = parsed.life[cat].map((item: any, idx: number) => {
              if (!item.id || seenIds.has(item.id)) {
                const uniqueId = `${item.id || cat}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
                return { ...item, id: uniqueId };
              }
              seenIds.add(item.id);
              return item;
            });
          }
        }
      }
      return {
        ...parsed,
        net: navigator.onLine ? 'online' : 'offline',
      };
    }
  } catch (e) {
    console.error('Failed to load local state:', e);
  }

  return isFixturesEnabled() ? getFixtureState() : getFreshState();
}

export function persistState(state: AppState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to persist state:', e);
  }
}

export function clearLocalState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear state:', e);
  }
}

// Supabase sync helpers
export async function syncProfileWithSupabase(profile: Partial<Profile>) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...profile,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Supabase sync skipped or failed:', err);
    return null;
  }
}

export async function hashText(text: string): Promise<string> {
  const norm = text.toLowerCase().trim().replace(/\s+/g, ' ');
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(norm);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      // fallback below
    }
  }
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

const SUPPRESSIONS_STORAGE_KEY = 'fikr_suppressions_v1';

export async function addSuppression(text: string) {
  if (!text) return;
  const hash = await hashText(text);

  // 1. Local suppression persistence
  if (typeof window !== 'undefined') {
    try {
      const existing: string[] = JSON.parse(
        localStorage.getItem(SUPPRESSIONS_STORAGE_KEY) || '[]'
      );
      if (!existing.includes(hash)) {
        existing.push(hash);
        localStorage.setItem(SUPPRESSIONS_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch (e) {
      console.warn('Local suppression storage failed:', e);
    }
  }

  // 2. Supabase suppressions table
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('suppressions')
        .upsert({ user_id: user.id, text_hash: hash }, { onConflict: 'user_id,text_hash' });
    }
  } catch (err) {
    console.warn('Supabase suppression sync failed:', err);
  }
}

export async function isSuppressed(text: string): Promise<boolean> {
  if (!text) return false;
  const hash = await hashText(text);

  if (typeof window !== 'undefined') {
    try {
      const existing: string[] = JSON.parse(
        localStorage.getItem(SUPPRESSIONS_STORAGE_KEY) || '[]'
      );
      if (existing.includes(hash)) return true;
    } catch (e) {
      // ignore
    }
  }
  return false;
}

export async function syncMemoryWithSupabase(memory: Partial<Memory>) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const isUuid =
      memory.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        memory.id
      );

    // Only columns that exist. Local-only flags (gone, rejected, snooze, history) stay on the device.
    const COLUMNS = ['id', 'category', 'text', 'confidence', 'source', 'evidence', 'status', 'when_label', 'created_at', 'phone'] as const;
    const picked: Record<string, unknown> = {};
    for (const k of COLUMNS) if (k in memory && (memory as Record<string, unknown>)[k] !== undefined) picked[k] = (memory as Record<string, unknown>)[k];
    const payload: any = {
      ...picked,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (!isUuid) {
      // Don't pass non-uuid string as primary key to UUID column in postgres
      delete payload.id;
    }

    const { data, error } = await supabase
      .from('memories')
      .upsert(payload)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Supabase sync skipped or failed:', err);
    return null;
  }
}

export async function forgetMemoryWithSupabase(id: string, text: string) {
  try {
    // 1. Record suppression
    await addSuppression(text);

    // 2. Scrub from Supabase
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isUuid =
      id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isUuid) {
      // Hard delete from memories table or scrub content
      await supabase.from('memories').delete().eq('id', id).eq('user_id', user.id);
      await supabase.from('facts').delete().eq('id', id).eq('user_id', user.id);
    }
  } catch (err) {
    console.warn('Supabase forget sync failed:', err);
  }
}

export async function syncTaskWithSupabase(task: Partial<Task>) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('tasks')
      .upsert({
        ...task,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Supabase sync skipped or failed:', err);
    return null;
  }
}

export async function syncThinkEntryWithSupabase(entry: {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  intent: string;
  outcome_line?: string;
}) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('think_entries')
      .insert({
        id: entry.id || crypto.randomUUID(),
        user_id: user.id,
        role: entry.role,
        text: entry.text,
        intent: entry.intent,
        outcome_line: entry.outcome_line || null,
        thread_day: new Date().toISOString().slice(0, 10),
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Think entry sync skipped or failed:', err);
    return null;
  }
}

export async function syncCheckinWithSupabase(checkinData: {
  date?: string;
  answers: any;
}) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('checkins')
      .upsert({
        user_id: user.id,
        date: checkinData.date || new Date().toISOString().slice(0, 10),
        answers: checkinData.answers,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Checkin sync skipped or failed:', err);
    return null;
  }
}

export async function exportAllUserData(fallbackState: AppState): Promise<string> {
  let remoteData: Record<string, any> = {};

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [profiles, memories, entries, checkins, suppressions, interventions] =
        await Promise.allSettled([
          supabase.from('profiles').select('*').eq('id', user.id),
          supabase.from('memories').select('*').eq('user_id', user.id),
          supabase.from('entries').select('*').eq('user_id', user.id),
          supabase.from('checkins').select('*').eq('user_id', user.id),
          supabase.from('suppressions').select('*').eq('user_id', user.id),
          supabase.from('interventions').select('*').eq('user_id', user.id),
        ]);

      remoteData = {
        user_id: user.id,
        profile: profiles.status === 'fulfilled' ? profiles.value.data?.[0] || null : null,
        memories: memories.status === 'fulfilled' ? memories.value.data || [] : [],
        think_entries: entries.status === 'fulfilled' ? entries.value.data || [] : [],
        checkins: checkins.status === 'fulfilled' ? checkins.value.data || [] : [],
        suppressions: suppressions.status === 'fulfilled' ? suppressions.value.data || [] : [],
        interventions: interventions.status === 'fulfilled' ? interventions.value.data || [] : [],
      };
    }
  } catch (e) {
    console.warn('Online export query error, will combine local state:', e);
  }

  // Also collect local items
  let localSuppressions: string[] = [];
  let localQueue: any[] = [];
  let localDailyContext: any = null;
  if (typeof window !== 'undefined') {
    try {
      localSuppressions = JSON.parse(localStorage.getItem('fikr_suppressions_v1') || '[]');
      localQueue = JSON.parse(localStorage.getItem('fikr_offline_queue_v1') || '[]');
      localDailyContext = JSON.parse(localStorage.getItem('fikr_daily_context_v1') || 'null');
    } catch {}
  }

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      ...remoteData,
      local_app_state: fallbackState,
      local_suppressions: localSuppressions,
      local_offline_queue: localQueue,
      local_daily_context: localDailyContext,
    },
    null,
    2
  );
}

export async function loadUserDataFromSupabase() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [profileRes, memoriesRes, tasksRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('memories').select('*').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('tasks').select('*').eq('user_id', user.id),
    ]);

    return {
      user,
      profile: profileRes.data,
      memories: (memoriesRes.data as Memory[]) || [],
      tasks: (tasksRes.data as Task[]) || [],
    };
  } catch (err) {
    console.warn('Failed to load user data from Supabase:', err);
    return null;
  }
}

