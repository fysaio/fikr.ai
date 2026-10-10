import React from 'react';

/** Single icon set for Fikr v2. 24px grid, round caps. No microphone anywhere: Fikr is text only. */
const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  more: (<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>),
  chev: <path d="M9 6l6 6-6 6" />,
  timer: (<><path d="M10 2h4" /><path d="M12 14l3-3" /><circle cx="12" cy="14" r="8" /></>),
  call: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v10.5a1 1 0 0 0 1 1h4v-5.5h4v5.5h4a1 1 0 0 0 1-1V9" /></>),
  memory: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" />,
  tell: (<><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M12 7.5v6M9 10.5h6" /></>),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  undo: (<><path d="M9 7L4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 0 12" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  wifi: (<><path d="M2 8.8a15 15 0 0 1 20 0" /><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M8.5 16a5 5 0 0 1 7 0" /><path d="M12 20h.01" /></>),
  wifioff: (<><path d="M2 8.8a15 15 0 0 1 4-2.6" /><path d="M22 8.8a15 15 0 0 0-8-3.7" /><path d="M5 12.5a10 10 0 0 1 3-1.9" /><path d="M19 12.5a10 10 0 0 0-5-2.5" /><path d="M8.5 16a5 5 0 0 1 7 0" /><path d="M12 20h.01" /><path d="M3 3l18 18" /></>),
  refresh: (<><path d="M20 11a8 8 0 0 0-14.5-4" /><path d="M4 13a8 8 0 0 0 14.5 4" /><path d="M5.5 3v4h4" /><path d="M18.5 21v-4h-4" /></>),
  send: (<><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>),
} as const;

export type IconName = keyof typeof PATHS | 'whatsapp';

export function Icon({ name, size = 20, stroke = 2.4 }: { name: IconName; size?: number; stroke?: number }) {
  if (name === 'whatsapp') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.3 15.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3 4.3c-.2 0-.5.1-.7.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.3 2.5 1 3 .8 3.5.7.6 0 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4l-.5-.3-1.8-.9c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.4 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4z" fillRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
