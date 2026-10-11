'use client';
import { useSyncExternalStore } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface PwaState { install: InstallEvent | null; updateReady: boolean; waiting: ServiceWorker | null }

let state: PwaState = { install: null, updateReady: false, waiting: null };
const subs = new Set<() => void>();
const set = (p: Partial<PwaState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const SERVER: PwaState = { install: null, updateReady: false, waiting: null };

export const usePwaState = () => useSyncExternalStore(subscribe, () => state, () => SERVER);

export function captureInstall(e: Event) { e.preventDefault(); set({ install: e as InstallEvent }); }
export function markUpdate(w: ServiceWorker) { set({ updateReady: true, waiting: w }); }
export async function promptInstall(): Promise<boolean> {
  const ev = state.install;
  if (!ev) return false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  set({ install: null });
  return outcome === 'accepted';
}
export function applyUpdate() { state.waiting?.postMessage('SKIP_WAITING'); }

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
