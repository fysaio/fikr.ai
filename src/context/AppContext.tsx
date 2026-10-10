'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, Memory, Task } from '@/types';
import {
  loadInitialState,
  persistState,
  clearLocalState,
  getFreshState,
  getFixtureState,
  syncProfileWithSupabase,
  syncMemoryWithSupabase,
  syncTaskWithSupabase,
  forgetMemoryWithSupabase,
  addSuppression,
} from '@/lib/data/data-access';
import {
  getPendingQueueCount,
  processSyncQueue,
} from '@/lib/data/offline-queue';
import { createClient } from '@/lib/supabase/client';

interface FocusTimerState {
  task: Task;
  total: number;
  left: number;
  end: number;
  paused: boolean;
}

interface AppContextValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  setName: (name: string) => void;
  setAnswer: (index: number, val: any) => void;
  toggleUndone: (index: number) => void;
  setNetStatus: (net: 'online' | 'offline' | 'slow' | 'error') => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
  setNudge: (nudge: string) => void;
  addTask: (task: Partial<Task>) => Task;
  completeTask: (id: string | number) => void;
  addLifeItem: (text: string, category?: string, source?: string) => Memory;
  updateLifeItem: (id: string, updates: Partial<Memory>) => void;
  removeLifeItem: (id: string) => void;
  forgetLifeItem: (id: string) => Promise<void>;
  mergeLifeItems: (primaryId: string, secondaryId: string, mergedText: string) => Promise<void>;
  setCompact: (val: boolean) => void;
  setAllTasks: (val: boolean) => void;
  focusTimer: FocusTimerState | null;
  setFocusTimer: React.Dispatch<React.SetStateAction<FocusTimerState | null>>;
  pendingInput: ((val: string) => void) | null;
  setPendingInput: React.Dispatch<React.SetStateAction<((val: string) => void) | null>>;
  resetToFresh: () => void;
  resetToFixtures: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [focusTimer, setFocusTimer] = useState<FocusTimerState | null>(null);
  const [pendingInput, setPendingInput] = useState<((val: string) => void) | null>(null);

  // Sync to localStorage
  useEffect(() => {
    persistState(state);
  }, [state]);

  // Apply Theme
  useEffect(() => {
    const applyTheme = (theme: 'dark' | 'light' | 'auto') => {
      let activeTheme = theme;
      if (theme === 'auto') {
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        activeTheme = prefersLight ? 'light' : 'dark';
      }
      document.documentElement.dataset.theme = activeTheme;
      try {
        localStorage.setItem('cil-theme', theme);
      } catch {}
    };

    applyTheme(state.theme);

    if (state.theme === 'auto') {
      const media = window.matchMedia('(prefers-color-scheme: light)');
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.dataset.theme = e.matches ? 'light' : 'dark';
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [state.theme]);

  // Network Status and Offline Queue Listeners
  useEffect(() => {
    // Initial queue count check
    const initialQueueCount = getPendingQueueCount();
    if (initialQueueCount > 0) {
      setState((prev) => ({ ...prev, queue: initialQueueCount }));
    }

    const handleQueueUpdated = (e: any) => {
      const count = e?.detail?.count ?? getPendingQueueCount();
      setState((prev) => ({ ...prev, queue: count }));
    };

    const handleOnline = async () => {
      const res = await processSyncQueue();
      setState((prev) => ({
        ...prev,
        net: 'online',
        queue: res.remainingCount,
        synced: res.syncedCount,
      }));

      // Clear sync indicator after 3.8s
      setTimeout(() => {
        setState((prev) => ({ ...prev, synced: 0 }));
      }, 3800);
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, net: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('fikr:queue-updated', handleQueueUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fikr:queue-updated', handleQueueUpdated);
    };
  }, []);

  // Listen to Supabase Auth State Changes
  useEffect(() => {
    try {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.name) {
            setState((prev) => ({
              ...prev,
              name: profile.name,
              theme: (profile.theme as any) || prev.theme,
              nudge: profile.nudge_level || prev.nudge,
            }));
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (e) {
      console.warn('Auth listener registration failed:', e);
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  const setName = useCallback((name: string) => {
    setState((prev) => {
      const next = { ...prev, name, touched: true };
      syncProfileWithSupabase({ name });
      return next;
    });
  }, []);

  const setAnswer = useCallback((index: number, val: any) => {
    setState((prev) => ({
      ...prev,
      ans: { ...prev.ans, [index]: val },
    }));
  }, []);

  const toggleUndone = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      undone: { ...prev.undone, [index]: !prev.undone[index] },
    }));
  }, []);

  const setNetStatus = useCallback((net: 'online' | 'offline' | 'slow' | 'error') => {
    setState((prev) => ({ ...prev, net }));
  }, []);

  const setTheme = useCallback((theme: 'dark' | 'light' | 'auto') => {
    setState((prev) => {
      const next = { ...prev, theme };
      syncProfileWithSupabase({ theme });
      return next;
    });
  }, []);

  const setNudge = useCallback((nudge: string) => {
    setState((prev) => {
      const next = { ...prev, nudge };
      syncProfileWithSupabase({ nudge_level: nudge });
      return next;
    });
  }, []);

  const addTask = useCallback((taskData: Partial<Task>): Task => {
    const id = taskData.id || crypto.randomUUID();
    const newTask: Task = {
      id,
      title: taskData.title || '',
      at: taskData.at || '10:00',
      duration_min: taskData.duration_min || taskData.dur || 25,
      dur: taskData.dur || taskData.duration_min || 25,
      in: taskData.in ?? 60,
      why: taskData.why || 'You added this.',
      status: 'open',
      source: 'user',
      mine: true,
      ...taskData,
    };

    setState((prev) => {
      const currentTasks = prev.tasks || [];
      const updated = [...currentTasks, newTask].sort((a, b) => (a.in ?? 0) - (b.in ?? 0));
      return { ...prev, tasks: updated };
    });

    syncTaskWithSupabase(newTask);
    return newTask;
  }, []);

  const completeTask = useCallback((id: string | number) => {
    setState((prev) => ({
      ...prev,
      done: { ...prev.done, [id]: true },
    }));
    syncTaskWithSupabase({ id: String(id), status: 'done' });
  }, []);

  const addLifeItem = useCallback(
    (text: string, category?: string, source?: string): Memory => {
      let cat = category;
      if (cat === 'how_i_work' || cat === 'preferences') {
        cat = 'prefs';
      }

      if (!cat) {
        if (/\b(send|reply|call|text|follow up|owe)\b/i.test(text)) {
          cat = 'commitments';
        } else {
          console.warn('[UNCLASSIFIED_FACT_LOGGED]', { text, category });
          return null as any;
        }
      }

      const validCategories = [
        'people',
        'projects',
        'places',
        'prefs',
        'goals',
        'commitments',
        'history',
        'patterns',
      ];
      if (!validCategories.includes(cat)) {
        console.warn('[UNCLASSIFIED_FACT_LOGGED]', { text, category });
        return null as any;
      }

      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const nowIso = new Date().toISOString();
      const originSource = source || 'You said this on Today';

      const newMemory: Memory = {
        id,
        category: cat as any,
        text,
        confidence: 'stated',
        source: originSource,
        evidence: [],
        status: 'active',
        when_label: cat === 'commitments' ? 'Open' : undefined,
        created_at: nowIso,
        updated_at: nowIso,
        history: [
          {
            action: 'created',
            at: nowIso,
            note: `Learned from ${originSource}`,
          },
        ],
      };

      setState((prev) => {
        const currentLife = prev.life || {};
        const catList = currentLife[cat] || [];
        return {
          ...prev,
          life: {
            ...currentLife,
            [cat]: [...catList, newMemory],
          },
        };
      });

      syncMemoryWithSupabase(newMemory);
      return newMemory;
    },
    []
  );

  const updateLifeItem = useCallback((id: string, updates: Partial<Memory>) => {
    setState((prev) => {
      const currentLife = prev.life || {};
      const newLife: Record<string, Memory[]> = {};
      const nowIso = new Date().toISOString();

      for (const cat in currentLife) {
        newLife[cat] = currentLife[cat].map((item) => {
          if (item.id !== id) return item;

          const currentHistory = item.history || [];
          const nextHistory = [...currentHistory];

          if (updates.text && updates.text.trim() !== item.text.trim()) {
            nextHistory.push({
              action: 'edited',
              at: nowIso,
              previous_text: item.text,
              note: updates.source || 'You edited this',
            });
          } else if (updates.confidence && updates.confidence !== item.confidence) {
            nextHistory.push({
              action: updates.confidence === 'stated' ? 'confirmed' : 'updated',
              at: nowIso,
              note: updates.source || `Confidence changed to ${updates.confidence}`,
            });
          } else if (updates.rejected) {
            nextHistory.push({
              action: 'rejected',
              at: nowIso,
              note: 'You rejected this hypothesis',
            });
          }

          return {
            ...item,
            ...updates,
            updated_at: nowIso,
            history: nextHistory,
          };
        });
      }

      return { ...prev, life: newLife };
    });

    syncMemoryWithSupabase({ id, ...updates });
  }, []);

  const removeLifeItem = useCallback((id: string) => {
    setState((prev) => {
      const currentLife = prev.life || {};
      const newLife: Record<string, Memory[]> = {};

      for (const cat in currentLife) {
        newLife[cat] = currentLife[cat].filter((item) => item.id !== id);
      }

      return { ...prev, life: newLife };
    });

    syncMemoryWithSupabase({ id, status: 'deleted' });
  }, []);

  const forgetLifeItem = useCallback(async (id: string) => {
    let targetText = '';

    setState((prev) => {
      const currentLife = prev.life || {};
      const newLife: Record<string, Memory[]> = {};

      for (const cat in currentLife) {
        currentLife[cat].forEach((item) => {
          if (item.id === id) {
            targetText = item.text;
          }
        });
        // Hard-delete item from active list
        newLife[cat] = currentLife[cat].filter((item) => item.id !== id);
      }

      return { ...prev, life: newLife };
    });

    if (targetText) {
      await forgetMemoryWithSupabase(id, targetText);
    }
  }, []);

  const mergeLifeItems = useCallback(
    async (primaryId: string, secondaryId: string, mergedText: string) => {
      let secondaryItem: Memory | undefined;

      setState((prev) => {
        const currentLife = prev.life || {};
        const newLife: Record<string, Memory[]> = {};
        const nowIso = new Date().toISOString();

        for (const cat in currentLife) {
          const foundSec = currentLife[cat].find((x) => x.id === secondaryId);
          if (foundSec) secondaryItem = foundSec;
        }

        for (const cat in currentLife) {
          newLife[cat] = currentLife[cat]
            .filter((x) => x.id !== secondaryId)
            .map((item) => {
              if (item.id !== primaryId) return item;

              const nextHist = [...(item.history || [])];
              nextHist.push({
                action: 'merged',
                at: nowIso,
                previous_text: item.text,
                note: `Merged with "${secondaryItem?.text || 'another memory'}"`,
              });

              const combinedEvidence = Array.from(
                new Set([...(item.evidence || []), ...(secondaryItem?.evidence || [])])
              );

              return {
                ...item,
                text: mergedText,
                evidence: combinedEvidence,
                updated_at: nowIso,
                history: nextHist,
              };
            });
        }

        return { ...prev, life: newLife };
      });

      // Sync Supabase
      syncMemoryWithSupabase({ id: primaryId, text: mergedText });
      syncMemoryWithSupabase({ id: secondaryId, status: 'deleted' });
    },
    []
  );

  const setCompact = useCallback((val: boolean) => {
    setState((prev) => ({ ...prev, compact: val }));
  }, []);

  const setAllTasks = useCallback((val: boolean) => {
    setState((prev) => ({ ...prev, all: val }));
  }, []);

  const resetToFresh = useCallback(() => {
    clearLocalState();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('fikr_onboarding_reached');
        localStorage.removeItem('fikr_onboarding_v1');
        localStorage.removeItem('fikr_onboarding_done');
      } catch {}
    }
    setState(getFreshState());
  }, []);

  const resetToFixtures = useCallback(() => {
    clearLocalState();
    setState(getFixtureState());
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        setState,
        toastMessage,
        showToast,
        setName,
        setAnswer,
        toggleUndone,
        setNetStatus,
        setTheme,
        setNudge,
        addTask,
        completeTask,
        addLifeItem,
        updateLifeItem,
        removeLifeItem,
        forgetLifeItem,
        mergeLifeItems,
        setCompact,
        setAllTasks,
        focusTimer,
        setFocusTimer,
        pendingInput,
        setPendingInput,
        resetToFresh,
        resetToFixtures,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
