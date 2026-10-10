'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';
import { syncProfileWithSupabase } from '@/lib/data/data-access';

export function useSettings() {
  const [settings, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => { const t = setTimeout(() => setS(loadSettings()), 0); return () => clearTimeout(t); }, []);
  const update = useCallback((fn: (s: Settings) => Settings) => {
    setS((prev) => {
      const next = fn(prev);
      saveSettings(next);
      syncProfileWithSupabase({ speak: next.speak, quiet: next.quiet, quiet_today: next.quietToday } as never);
      return next;
    });
  }, []);
  return [settings, update] as const;
}
