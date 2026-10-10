'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PhoneShell } from '@/components/layout/PhoneShell';
import { Arrow, Mark } from '@/components/icons/Icons';
import { useApp } from '@/context/AppContext';
import { ExtractedThinkFact, ThinkIntent } from '@/lib/ai/think';
import { syncThinkEntryWithSupabase } from '@/lib/data/data-access';
import { addToSyncQueue } from '@/lib/data/offline-queue';

interface ThinkMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  intent?: ThinkIntent;
  outcome_line?: string;
  ui?: {
    type: 'none' | 'choice' | 'chips';
    options: string[];
  };
  facts?: ExtractedThinkFact[];
  pending?: boolean;
}

const STORAGE_KEY = 'fikr_think_thread_v1';

export default function ThinkPage() {
  const router = useRouter();
  const { state, addLifeItem, forgetLifeItem, showToast } = useApp();

  const [messages, setMessages] = useState<ThinkMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Load thread and unsent draft from storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
      const draft = sessionStorage.getItem('fikr_think_draft');
      if (draft) {
        setInputText(draft);
      }
    } catch {}
  }, []);

  // Persist thread locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen to background sync completions when reconnecting
  useEffect(() => {
    const handleThinkSynced = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;

      const { messageId, facts, reply, intent, outcome_line } = detail;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, pending: false } : m
        )
      );

      if (facts && facts.length > 0) {
        facts.forEach((ef: any) => {
          addLifeItem(ef.text, ef.category, 'From your message in Think');
        });
      }
    };

    window.addEventListener('fikr:think-synced', handleThinkSynced);
    return () => window.removeEventListener('fikr:think-synced', handleThinkSynced);
  }, [addLifeItem]);

  const handleSubmit = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || isThinking) return;

    setInputText('');
    try {
      sessionStorage.removeItem('fikr_think_draft');
    } catch {}

    const userMsgId = `usr_${Date.now()}`;
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const userMsg: ThinkMessage = {
      id: userMsgId,
      role: 'user',
      text: clean,
      pending: isOffline,
    };

    // Save locally first per Section 8 & 9
    setMessages(prev => [...prev, userMsg]);

    // If currently offline, queue action and return immediately
    if (isOffline) {
      addToSyncQueue('think_entry', { text: clean, messageId: userMsgId }, userMsgId);
      const fallbackMsg: ThinkMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        text: "Saved on your phone. I'll reflect on this once you're back online.",
        intent: 'heard',
        outcome_line: 'Saved offline.',
      };
      setMessages(prev => [...prev, fallbackMsg]);
      return;
    }

    setIsThinking(true);

    // Prepare context from Life knowledge
    const contextFacts: Array<{ id: string; category: string; text: string }> = [];
    if (state.life) {
      Object.entries(state.life).forEach(([cat, items]) => {
        if (Array.isArray(items)) {
          items.forEach(it => {
            if (it.status !== 'deleted') {
              contextFacts.push({ id: it.id, category: cat, text: it.text });
            }
          });
        }
      });
    }

    const historyPayload = messages.map(m => ({ role: m.role, text: m.text }));

    try {
      const res = await fetch('/api/think', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: [...historyPayload, { role: 'user', text: clean }],
          context_facts: contextFacts,
        }),
      });

      if (!res.ok) {
        throw new Error('Think service unavailable');
      }

      const data = await res.json();

      // Route newly extracted facts to Life memory store
      const extractedList: ExtractedThinkFact[] = Array.isArray(data.extracted_facts)
        ? data.extracted_facts
        : [];

      extractedList.forEach((ef) => {
        const created = addLifeItem(ef.text, ef.category, 'From your message in Think');
        if (created?.id) {
          ef.id = created.id;
        }
      });

      const assistantMsg: ThinkMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        text: data.reply || "I hear you.",
        intent: data.intent,
        outcome_line: data.outcome_line,
        ui: data.ui,
        facts: extractedList,
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Sync thought entry and response to Supabase
      syncThinkEntryWithSupabase({
        role: 'user',
        text: clean,
        intent: data.intent || 'heard',
      });
      syncThinkEntryWithSupabase({
        role: 'assistant',
        text: data.reply || "I hear you.",
        intent: data.intent || 'heard',
        outcome_line: data.outcome_line,
      });
    } catch (err) {
      console.warn('Think turn error:', err);
      // Mark user message as pending and queue for background sync
      setMessages(prev =>
        prev.map(m => (m.id === userMsgId ? { ...m, pending: true } : m))
      );
      addToSyncQueue('think_entry', { text: clean, messageId: userMsgId }, userMsgId);

      const fallbackMsg: ThinkMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        text: "Saved on your phone. I'll reflect on this once you're back online.",
        intent: 'heard',
        outcome_line: 'Saved offline.',
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleForgetFact = async (factId: string) => {
    await forgetLifeItem(factId);
    setMessages(prev =>
      prev.map(m => ({
        ...m,
        facts: m.facts ? m.facts.filter(f => f.id !== factId) : [],
      }))
    );
    showToast('Forgotten from memory');
  };

  return (
    <PhoneShell>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          padding: '0 4px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 4px 8px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <button
            className="back"
            type="button"
            aria-label="Back to Today"
            onClick={() => router.push('/today')}
          >
            <Arrow dir="l" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mark size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mute)' }}>
              Think out loud
            </span>
          </div>
          <div style={{ width: '36px' }} />
        </div>

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                margin: 'auto 0',
                color: 'var(--mute)',
                padding: '20px',
              }}
            >
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)', marginBottom: '8px' }}>
                What&apos;s on your mind?
              </h2>
              <p style={{ fontSize: '14px', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto' }}>
                Say whatever is in your head. I won&apos;t make tasks unless you ask.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '6px',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: m.role === 'user' ? 'var(--s1)' : 'var(--bg)',
                  border: m.role === 'assistant' ? '1px solid var(--s2)' : 'none',
                  color: 'var(--ink)',
                  fontSize: '15px',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.text}
              </div>

              {m.role === 'user' && m.pending && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--mute)',
                    marginTop: '-2px',
                    fontWeight: 600,
                  }}
                >
                  Waiting to sync
                </span>
              )}

              {/* Tappable intent options if assistant suggested choices */}
              {m.role === 'assistant' && m.ui?.options && m.ui.options.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {m.ui.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className="pill"
                      style={{
                        background: 'var(--s1)',
                        border: '1px solid var(--line)',
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        padding: '6px 12px',
                        borderRadius: '16px',
                      }}
                      onClick={() => handleSubmit(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Memory Extraction Chips */}
              {m.role === 'assistant' && m.facts && m.facts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', width: '100%' }}>
                  {m.facts.map((fact) => (
                    <div
                      key={fact.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--remb)',
                        border: '1px solid rgba(160,190,40,.25)',
                        borderRadius: '12px',
                        fontSize: '13px',
                      }}
                    >
                      <Link
                        href={`/life/item/${fact.id}`}
                        style={{
                          color: 'var(--ink)',
                          fontWeight: 600,
                          textDecoration: 'none',
                          flex: 1,
                        }}
                      >
                        <span style={{ color: 'var(--lime)', marginRight: '6px' }}>✓</span>
                        {fact.text}
                      </Link>
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--mute)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          marginLeft: '8px',
                        }}
                        onClick={() => handleForgetFact(fact.id)}
                      >
                        Forget
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '10px 14px',
                color: 'var(--mute)',
                fontSize: '14px',
                fontStyle: 'italic',
              }}
            >
              Listening…
            </div>
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(inputText);
          }}
          style={{
            padding: '10px 4px 16px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            placeholder="What's on your mind?"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              try {
                sessionStorage.setItem('fikr_think_draft', e.target.value);
              } catch {}
            }}
            disabled={isThinking}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '24px',
              border: '1px solid var(--s2)',
              background: 'var(--s1)',
              color: 'var(--ink)',
              fontSize: '15px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            className="btn"
            disabled={!inputText.trim() || isThinking}
            style={{
              padding: '10px 18px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 800,
              minWidth: 'auto',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </PhoneShell>
  );
}
