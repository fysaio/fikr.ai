import { z } from 'zod';
import type { TaskDef } from './gateway/types';
import { compactFacts, factsDigest, recentTurns, type CompactFact } from './gateway/context';
import { clip, isTrivialAck } from './gateway/text';
import { ONBOARDING_SYSTEM_PROMPT, FALLBACK_QUESTIONS } from '@/config/onboarding-prompts';
import { CHAT_SYSTEM_PROMPT } from '@/config/chat-prompt';
import { CRISIS_COPY } from '@/config/flags';

/* ------------------------------------------------------------------ onboarding */

const factIn = z.object({
  id: z.string().max(80),
  category: z.string().max(30),
  entity: z.string().max(80).nullable().optional(),
  value: z.string().max(400),
  due_text: z.string().max(60).nullable().optional(),
});

export const onboardingInput = z.object({
  nowDay: z.string().max(10), // YYYY-MM-DD only; a full timestamp would defeat the cache
  history: z.array(z.object({ q: z.string().max(400), a: z.string().max(2000) })).max(30),
  facts: z.array(factIn).max(60),
  target: z.string().max(30),
  readiness: z.record(z.string(), z.boolean()),
  /** Computed by code before the call so the gateway can skip the model entirely. */
  complete: z.boolean(),
  venting: z.boolean(),
});
export type OnboardingTaskInput = z.infer<typeof onboardingInput>;

// Loose on purpose: the feature layer already sanitises and clamps every field.
export const onboardingOutput = z.object({
  reflection: z.string().nullish(),
  facts: z.array(z.any()).max(6).default([]),
  next_question: z.string().min(1),
  ui_spec: z.any(),
  slot_target: z.string().nullish(),
  wants_to_be_heard: z.boolean().nullish(),
  correction: z.boolean().nullish(),
  slots: z.record(z.string(), z.boolean()).nullish(),
});
export type OnboardingTaskOutput = z.infer<typeof onboardingOutput>;

const VENT_UI = {
  type: 'choice',
  submit_on_tap: true,
  options: [
    { label: 'Think one through', sub: 'Pick one thing and work it out together' },
    { label: 'Just get it out', sub: "No questions. I'll just listen." },
    { label: 'Not now', sub: 'We can pick this up later' },
  ],
};

export const onboardingTask: TaskDef<OnboardingTaskInput, OnboardingTaskOutput> = {
  id: 'onboarding_turn',
  version: '3',
  system: ONBOARDING_SYSTEM_PROMPT,
  temperature: 0.5,
  maxOutTokens: 700,
  timeoutMs: 12000,
  inputSchema: onboardingInput,
  outputSchema: onboardingOutput,
  repair: true,
  buildUser: (i) => {
    const latest = i.history[i.history.length - 1]?.a ?? '';
    const turns = recentTurns(i.history, 3, 500);
    const facts: CompactFact[] = i.facts.map((f) => ({ ...f, value: f.value }));
    return [
      `NOW:${i.nowDay} TURN:${i.history.length} SLOT:${i.target}`,
      `READY:${Object.entries(i.readiness).filter(([, v]) => v).map(([k]) => k).join(',') || 'none'}`,
      `FACTS(id|cat|entity|value):\n${compactFacts(facts, 20)}`,
      `RECENT:\n${turns.map((t) => `Q:${t.q}\nA:${t.a}`).join('\n')}`,
      `LATEST:"${clip(latest, 1200)}"`,
      `VENTING_FLAG:${i.venting}`,
    ].join('\n');
  },
  // Retries, double taps and offline-queue replays hit this. No two real turns share a key.
  cache: {
    ttlSec: 600,
    scope: 'user',
    keyOf: (i) => ({ d: i.nowDay, t: recentTurns(i.history, 3, 500), f: factsDigest(i.facts), s: i.target }),
  },
  // Same local safety gate as chat. A hit never reaches a model and never stores facts.
  userText: (i) => i.history[i.history.length - 1]?.a ?? '',
  safe: () => ({
    reflection: null,
    facts: [],
    next_question: `I'm glad you told me. ${CRISIS_COPY}`,
    ui_spec: { type: 'choice', submit_on_tap: true, options: [{ label: 'I am okay to carry on' }, { label: 'Not now', sub: 'We can pick this up later' }] },
    slot_target: 'thread',
    wants_to_be_heard: true,
    correction: false,
    slots: null,
  }),
  shortcut: (i) => {
    const turn = i.history.length;
    if (i.venting && turn <= 2) {
      return { reflection: "I'm hearing a lot at once.", facts: [], next_question: 'What would help right now?', ui_spec: VENT_UI, slot_target: 'thread', wants_to_be_heard: true, correction: false, slots: null };
    }
    if (i.complete) {
      return { reflection: null, facts: [], next_question: "That's enough to start.", ui_spec: { type: 'none' }, slot_target: 'close', wants_to_be_heard: false, correction: false, slots: null };
    }
    return null;
  },
  fallback: (i) => {
    const fb = FALLBACK_QUESTIONS[i.target] || FALLBACK_QUESTIONS.project;
    return { reflection: null, facts: [], next_question: fb.next_question, ui_spec: fb.ui_spec, slot_target: fb.slot_target, wants_to_be_heard: false, correction: false, slots: null };
  },
};

/* ------------------------------------------------------------------ chat (replaces Think) */

export const chatInput = z.object({
  nowDay: z.string().max(10),
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(1500) })).max(12),
  context: z.array(z.object({
    id: z.string().max(80),
    category: z.string().max(30),
    text: z.string().max(400),
    /** How sure the app is: known, stated, observed or hypothesized. Defaults to stated. */
    confidence: z.enum(['known', 'stated', 'observed', 'hypothesized']).nullish(),
  })).max(30),
});
export type ChatTaskInput = z.infer<typeof chatInput>;

export const chatOutput = z.object({
  intent: z.enum(['heard', 'understand', 'decide', 'remember', 'act', 'unclear']),
  reply: z.string().min(1).max(1200),
  outcome_line: z.string().max(200).nullish(),
  ui: z.object({ type: z.enum(['none', 'choice', 'chips']), options: z.array(z.string().max(60)).max(6) }).nullish(),
  safety: z.boolean().nullish(),
  facts: z.array(z.object({
    category: z.enum(['people', 'projects', 'goals', 'commitments', 'prefs', 'history']),
    entity: z.string().max(80).nullish(),
    text: z.string().min(4).max(300),
    evidence: z.string().max(300).nullish(),
    /** id of a CONTEXT line this fact corrects or replaces. Checked against CONTEXT before use. */
    supersedes: z.string().max(80).nullish(),
  })).max(2).default([]),
});
export type ChatTaskOutput = z.infer<typeof chatOutput>;

export const chatTask: TaskDef<ChatTaskInput, ChatTaskOutput> = {
  id: 'chat_turn',
  version: '2',
  system: CHAT_SYSTEM_PROMPT,
  temperature: 0.5,
  maxOutTokens: 550,
  timeoutMs: 12000,
  inputSchema: chatInput,
  outputSchema: chatOutput,
  repair: false,
  buildUser: (i) =>
    [
      `NOW:${i.nowDay}`,
      `CONTEXT(id|cat|confidence|text):\n${i.context.length ? i.context.slice(0, 15).map((c) => `${c.id}|${c.category}|${c.confidence ?? 'stated'}|${clip(c.text, 160)}`).join('\n') : 'none'}`,
      i.history.length ? `RECENT:\n${i.history.slice(-4).map((h) => `${h.role === 'user' ? 'U' : 'F'}:${clip(h.text, 300)}`).join('\n')}` : '',
      `MESSAGE:"${i.message}"`,
    ].filter(Boolean).join('\n'),
  // Same message twice in a row (double tap, outbox replay) answers once. The memory digest is in the key so a
  // changed memory never gets an answer written for the old one.
  cache: {
    ttlSec: 300,
    scope: 'user',
    keyOf: (i) => ({
      d: i.nowDay,
      m: i.message.trim().toLowerCase(),
      h: i.history.slice(-2),
      c: factsDigest(i.context.slice(0, 15).map((c) => ({ id: c.id, category: c.category, value: `${c.confidence ?? 'stated'}:${c.text}` }))),
    }),
  },
  userText: (i) => i.message,
  safe: () => ({ intent: 'heard' as const, reply: `I'm glad you told me. ${CRISIS_COPY}`, outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: true, facts: [] }),
  shortcut: (i) => (isTrivialAck(i.message) ? { intent: 'heard' as const, reply: 'Ok.', outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: false, facts: [] } : null),
  fallback: () => ({ intent: 'heard' as const, reply: "I've saved that. I couldn't think it through just now, so nothing is lost and you can add to it.", outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: false, facts: [] }),
};
