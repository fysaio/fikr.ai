'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { applyUpdate, captureInstall, markUpdate, usePwaState } from '@/lib/pwa/store';

/** Registers the worker, keeps the install prompt, and shows "A newer Fikr is ready" at a safe moment. */
export default function ServiceWorkerRegister() {
  const { updateReady } = usePwaState();
  const path = usePathname();
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', captureInstall);
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return () => window.removeEventListener('beforeinstallprompt', captureInstall);

    let reloading = false;
    const onControl = () => { if (!reloading) { reloading = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', onControl);

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      const watch = (w: ServiceWorker) => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) markUpdate(w); });
      if (reg.waiting && navigator.serviceWorker.controller) markUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    }).catch(() => {});

    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstall);
      navigator.serviceWorker.removeEventListener('controllerchange', onControl);
    };
  }, []);

  // Never offer a reload while someone is typing.
  useEffect(() => {
    const on = () => { const el = document.activeElement; setTyping(!!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)); };
    document.addEventListener('focusin', on); document.addEventListener('focusout', on);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', on); };
  }, []);

  const busy = typing || path.startsWith('/focus') || path.startsWith('/onboarding');
  if (!updateReady || busy) return null;
  return (
    <div className="fk-update" role="status">
      <span>A newer Fikr is ready.</span>
      <button type="button" onClick={applyUpdate}>Update now</button>
    </div>
  );
}
