'use client';

import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { TabIcon, Arrow } from '@/components/icons/Icons';

interface PhoneShellProps {
  children: React.ReactNode;
  flush?: boolean;
  dock?: 'today' | 'life' | null;
  onSendMessage?: (msg: string) => void;
  messagePlaceholder?: string;
}

export const PhoneShell: React.FC<PhoneShellProps> = ({
  children,
  flush = false,
  dock = null,
  onSendMessage,
  messagePlaceholder = "What’s on your mind?",
}) => {
  const { state, toastMessage, pendingInput } = useApp();
  const [inputValue, setInputValue] = useState('');
  const pathname = usePathname();

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setInputValue('');
    if (pendingInput) {
      pendingInput(trimmed);
    } else if (onSendMessage) {
      onSendMessage(trimmed);
    }
  };

  // Check how many hypothesized items need review
  const needsCount =
    (state.life?.patterns || []).filter(
      (x) =>
        x.confidence === 'hypothesized' &&
        !x.gone &&
        !x.rejected &&
        !x.snooze
    ).length || 0;

  // Network banner details
  const { net, queue, synced } = state;
  let netClass = '';
  let netTitle = '';
  let netSub = '';
  const showNetBar = !flush && (synced > 0 || net !== 'online');

  if (synced > 0) {
    netClass = 'ok';
    netTitle = 'Back online';
    netSub = `Synced ${synced} ${synced > 1 ? 'things.' : 'thing.'}`;
  } else if (net === 'offline') {
    netTitle = 'You’re offline';
    netSub = queue ? `${queue} waiting to sync` : 'Your day still works.';
  } else if (net === 'slow') {
    netClass = 'slow';
    netTitle = 'Slow connection';
    netSub = 'Replies may take a while.';
  } else if (net === 'error') {
    netClass = 'err';
    netTitle = 'Can’t reach my assistant';
    netSub = queue ? `${queue} waiting to retry` : 'Your messages are saved.';
  }

  const scrClassName = flush
    ? 'flush'
    : dock === 'life'
    ? 'pad pad2'
    : dock
    ? 'pad'
    : '';

  return (
    <main className={`ph ${showNetBar ? 'net-on' : ''}`}>
      {showNetBar && (
        <div id="net" className={netClass} role="status">
          <i />
          <div>
            <b>{netTitle}</b>
            <span>{netSub}</span>
          </div>
          {synced === 0 && <Link href="/offline">Details</Link>}
        </div>
      )}

      <div id="scr" className={scrClassName}>
        {children}
      </div>

      {toastMessage && (
        <div className="tst" role="status">
          {toastMessage}
        </div>
      )}

      {dock && (
        <div id="dock">
          {dock === 'today' && (
            <form className="msg" id="mf" onSubmit={handleSend}>
              <input
                id="mi"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={pendingInput ? 'Type your reply…' : messagePlaceholder}
                aria-label="Say anything"
              />
              <button className="send" type="submit" aria-label="Send">
                <Arrow dir="u" size={20} />
              </button>
            </form>
          )}

          <nav className="tabs">
            <Link
              href="/today"
              className={pathname === '/today' ? 'on' : ''}
            >
              <TabIcon type="today" />
              Today
            </Link>
            <Link
              href="/think"
              className={pathname === '/think' ? 'on' : ''}
            >
              <TabIcon type="think" />
              Think
            </Link>
            <Link
              href="/life"
              className={pathname.startsWith('/life') ? 'on' : ''}
            >
              <TabIcon type="life" />
              Life
              {needsCount > 0 && <i className="bdg">{needsCount}</i>}
            </Link>
          </nav>
        </div>
      )}
    </main>
  );
};
