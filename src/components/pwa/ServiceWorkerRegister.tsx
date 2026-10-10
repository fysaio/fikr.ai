'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[Fikr PWA] Service Worker registered with scope:', registration.scope);

            // Listen for service worker updates
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (
                    installingWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    console.log('[Fikr PWA] New version available.');
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.error('[Fikr PWA] Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}
