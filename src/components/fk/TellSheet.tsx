'use client';
import React, { useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Memory } from '@/types';
import { ChatSheet } from './ChatSheet';
import type { TellReply } from '@/lib/outbox/tell';

/** Tell Fikr sheet wired to Memory. Use on any screen that has the tab bar. */
export function TellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addLifeItem, showToast } = useApp();
  const ref = useRef(state);
  useEffect(() => { ref.current = state; }, [state]);
  const facts = useCallback(() => {
    const life = (ref.current.life || {}) as Record<string, Memory[]>;
    return Object.entries(life).flatMap(([category, items]) => (items || []).filter((m) => m.status !== 'deleted').map((m) => ({ id: String(m.id), category, text: m.text }))).slice(0, 20);
  }, []);
  const take = useCallback((r: TellReply) => {
    const f = r.extracted_facts || [];
    f.forEach((x) => addLifeItem(x.text, x.category, 'From Tell Fikr'));
    if (f.length) showToast('Added to Memory');
  }, [addLifeItem, showToast]);
  return <ChatSheet open={open} onClose={onClose} getContext={facts} onFacts={take} />;
}
