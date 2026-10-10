'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { ChatItem } from '@/types';

export default function ChatsPage() {
  const router = useRouter();
  const { state, setState, showToast } = useApp();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const chats = state.chats || [];
  const sortedChats = [...chats].sort((a, b) => b.age - a.age);

  const keepWhy = (c: ChatItem) => {
    if (c.pin) return 'Pinned';
    if (c.mem) return `Made ${c.mem} ${c.mem > 1 ? 'memories' : 'memory'} that still exist`;
    if (c.open) return 'Has an unanswered question';
    return '';
  };

  const expiringChats = sortedChats.filter((c) => !keepWhy(c) && 30 - c.age <= 5);

  const togglePin = (id: number) => {
    setState((prev) => ({
      ...prev,
      chats: (prev.chats || []).map((c) =>
        c.id === id ? { ...c, pin: !c.pin } : c
      ),
    }));
  };

  const deleteChat = (id: number) => {
    setState((prev) => ({
      ...prev,
      chats: (prev.chats || []).filter((c) => c.id !== id),
    }));
    showToast('Deleted');
  };

  return (
    <PhoneShell dock="life">
      <button
        className="back"
        aria-label="Back"
        type="button"
        onClick={() => router.back()}
      >
        <Arrow dir="l" />
      </button>

      <h1>Chats</h1>
      <p className="m">
        Kept 30 days after the last message. A chat stays longer if it made a
        memory or task that still exists, has an unanswered question, or is pinned.
      </p>

      {expiringChats.length > 0 && (
        <div className="banner">
          <b>
            {expiringChats.length} chat{expiringChats.length > 1 ? 's' : ''} expire in{' '}
            {Math.min(...expiringChats.map((c) => 30 - c.age))} days.
          </b>
          <p className="m" style={{ margin: '4px 0 0' }}>
            Keep any you want. Nothing else is lost.
          </p>
        </div>
      )}

      {state.log.length > 0 && (
        <Link className="card" href="/today">
          <b>Today</b>
          <p className="m" style={{ margin: '4px 0 0' }}>
            {state.log.length} message{state.log.length > 1 ? 's' : ''} · open the thread
          </p>
        </Link>
      )}

      {sortedChats.length > 0 ? (
        sortedChats.map((c) => (
          <div key={c.id} className="card">
            <b>{c.t}</b>
            <p className="m" style={{ margin: '4px 0 8px' }}>
              {c.age} days ago ·{' '}
              {keepWhy(c) || (
                <span className="exp">Expires in {30 - c.age} days</span>
              )}
            </p>
            {expandedId === c.id && (
              <div className="sn m" style={{ marginBottom: '8px' }}>
                You: {c.sn}
              </div>
            )}
            <button
              className="lnk rd"
              type="button"
              onClick={() =>
                setExpandedId((prev) => (prev === c.id ? null : c.id))
              }
            >
              {expandedId === c.id ? 'Hide' : 'Read'}
            </button>{' '}
            ·{' '}
            <button
              className="lnk pn"
              type="button"
              onClick={() => togglePin(c.id)}
            >
              {c.pin ? 'Unpin' : 'Keep'}
            </button>{' '}
            ·{' '}
            <button
              className="lnk dl2"
              type="button"
              style={{ color: 'var(--red)' }}
              onClick={() => deleteChat(c.id)}
            >
              Delete
            </button>
          </div>
        ))
      ) : state.log.length === 0 ? (
        <p className="m">Nothing saved yet.</p>
      ) : null}
    </PhoneShell>
  );
}
