'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';

/** Centred 430px column for signed-out screens. The screen's own CSS sets colours; this only frames and shows toasts. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { toastMessage } = useApp();
  return (
    <main className="fk-authframe">
      <div className="fk-authframe-in">{children}</div>
      {toastMessage && <div className="fk-toast fk-toast-ok" role="status">{toastMessage}</div>}
    </main>
  );
}
