'use client';
import React, { useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Memory } from '@/types';
import { ChatSheet } from './ChatSheet';
import type { TellReply } from '@/lib/outbox/tell';
import { buildChatContext, reconcileChatFacts } from '@/lib/memory/chat-facts';

/** Gist me sheet wired to Memory. Use on any screen that has the tab bar. */
export function TellSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addLifeItem, updateLifeItem, showToast } = useApp();
  const ref = useRef(state);
  useEffect(() => { ref.current = state; }, [state]);
  const facts = useCallback(() => buildChatContext(ref.current.life as Record<string, Memory[]> | null), []);
  const take = useCallback((r: TellReply) => {
    const stored = Object.values((ref.current.life || {}) as Record<string, Memory[]>).flat();
    const { add, update } = reconcileChatFacts(r.extracted_facts || [], stored);
    add.forEach((x) => addLifeItem(x.text, x.category, 'From Gist me'));
    update.forEach((u) => updateLifeItem(u.id, { text: u.text, source: 'Corrected in Gist me' }));
    if (add.length) showToast('Added to Memory');
    else if (update.length) showToast('Memory updated');
  }, [addLifeItem, updateLifeItem, showToast]);
  return <ChatSheet open={open} onClose={onClose} getContext={facts} onFacts={take} />;
}
