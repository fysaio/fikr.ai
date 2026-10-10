'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Arrow } from '@/components/icons/Icons';

export const SCREEN_GROUPS: [string, [string, string][]][] = [
  [
    'Start',
    [
      ['/welcome', 'Welcome'],
      ['/signup', 'Sign up'],
      ['/login', 'Log in'],
      ['/you', 'Name and age'],
      ['/you?under=1', 'Under 16 (blocked)'],
      ['/forgot', 'Forgot password'],
      ['/reset', 'Reset password'],
    ],
  ],
  [
    'Onboarding',
    [
      ['/onboarding', 'Onboarding (guide-led v2)'],
      ['/onboarding/1', 'Question 1'],
      ['/onboarding/2', 'Question 2'],
      ['/onboarding/3', 'Question 3 (chips)'],
      ['/onboarding/4', 'Question 4 (choice)'],
      ['/onboarding/5', 'Question 5'],
      ['/building', 'Building your day'],
    ],
  ],
  [
    'Today',
    [
      ['/today', 'Today'],
      ['/today?late=1', 'Today, running late'],
      ['/yesterday', 'Yesterday (swipe story)'],
      ['/today?eve=1', 'Today, evening'],
      ['/evening', 'Evening check-in'],
      ['/lock', 'Notification styles'],
    ],
  ],
  [
    'Tasks and timer',
    [
      ['/today?ask=timer&tid=1', 'Timer card (on Today)'],
      ['/focus', 'Focus timer (live)'],
      ['/focus-end', 'Time’s up'],
      ['/done', 'First win'],
    ],
  ],
  [
    'Ask on Today',
    [
      ['/today?ask=time', 'Time and duration card'],
      ['/today?ask=choice', 'Multiple choice'],
      ['/today?ask=chips', 'Chips, pick several'],
      ['/today?ask=rank', 'Rank, drag to order'],
      ['/today?ask=memory', 'Memory: remembered, undo'],
    ],
  ],
  [
    'Connection',
    [
      ['/today?net=offline', 'Today, offline'],
      ['/today?ask=choice&net=offline', 'Message waits (offline)'],
      ['/today?ask=time&net=offline', 'Scheduling works offline'],
      ['/today?ask=choice&net=offline&back=1', 'Reconnects and answers'],
      ['/today?ask=choice&net=slow', 'Slow reply'],
      ['/today?net=error', 'Assistant unreachable'],
      ['/offline', 'What works offline'],
      ['/today?net=online', 'Online'],
    ],
  ],
  [
    'Life and account',
    [
      ['/life', 'Life'],
      ['/life/people', 'People list'],
      ['/life/commitments', 'Commitments'],
      ['/life/patterns', 'Patterns'],
      ['/life/item/pa2', 'Memory: a guess'],
      ['/life/item/pa1', 'Memory: I noticed'],
      ['/life/item/hi1', 'Memory: known'],
      ['/life/item/pe1', 'Memory: you told me'],
      ['/profile', 'Profile and settings'],
      ['/delete', 'Delete account'],
    ],
  ],
];

export function SidebarRail() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, setNetStatus } = useApp();

  const queryString = searchParams.toString();
  const currentFullUrl = queryString ? `${pathname}?${queryString}` : pathname;

  return (
    <>
      {/* Mobile Drawer Trigger Button */}
      <button
        id="sb"
        aria-label="All screens"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <Arrow dir="r" />
      </button>

      {/* Backdrop scrim */}
      <div
        id="scrim"
        className={isOpen ? 'on' : ''}
        onClick={() => setIsOpen(false)}
      />

      {/* Rail Navigation Sidebar */}
      <aside id="rail" className={isOpen ? 'open' : ''}>
        <Link
          href="/screens"
          style={{ fontWeight: 900, fontSize: '16px' }}
          onClick={() => setIsOpen(false)}
        >
          All screens
        </Link>

        {SCREEN_GROUPS.map(([groupTitle, links]) => (
          <React.Fragment key={groupTitle}>
            <h4>{groupTitle}</h4>
            {links.map(([href, label]) => {
              const isActive =
                currentFullUrl === href ||
                (!href.includes('?') && pathname === href && !queryString);

              return (
                <Link
                  key={href}
                  href={href}
                  className={isActive ? 'on' : ''}
                  onClick={() => setIsOpen(false)}
                >
                  {label}
                </Link>
              );
            })}
          </React.Fragment>
        ))}

        <h4>Demo: connection</h4>
        <div className="nets">
          <button
            type="button"
            className={state.net === 'online' ? 'on' : ''}
            onClick={() => setNetStatus('online')}
          >
            Online
          </button>
          <button
            type="button"
            className={state.net === 'slow' ? 'on' : ''}
            onClick={() => setNetStatus('slow')}
          >
            Slow
          </button>
          <button
            type="button"
            className={state.net === 'offline' ? 'on' : ''}
            onClick={() => setNetStatus('offline')}
          >
            Offline
          </button>
          <button
            type="button"
            className={state.net === 'error' ? 'on' : ''}
            onClick={() => setNetStatus('error')}
          >
            Assistant down
          </button>
        </div>
      </aside>
    </>
  );
}
