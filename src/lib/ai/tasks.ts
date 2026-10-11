import { z } from 'zod';
import type { TaskDef } from './gateway/types';
import { compactFacts, factsDigest, recentTurns, type CompactFact } from './gateway/context';
import { clip, isTrivialAck } from './gateway/text';
import { ONBOARDING_SYSTEM_PROMPT, FALLBACK_QUESTIONS } from '@/config/onboarding-prompts';
import { CHAT_SYSTEM_PROMPT } from '@/config/chat-prompt';
import { CRISIS_COPY } from '@/config/flags';

/* ------------------------------------------------------------------ onboarding */

/** Over-long strings are clipped, not rejected. A rejected input throws and the person gets canned fallback copy for a message that was fine. */
const cl = (n: number) => z.string().transform((v) => v.slice(0, n));

const factIn = z.object({
  id: cl(80),
  category: cl(30),
  entity: cl(80).nullable().optional(),
  value: cl(400),
  due_text: cl(60).nullable().optional(),
});

export const onboardingInput = z.object({
  nowDay: cl(10), // YYYY-MM-DD only; a full timestamp would defeat the cache
  history: z.array(z.object({ q: cl(400), a: cl(2000) })).transform((h) => h.slice(-30)),
  facts: z.array(factIn).transform((f) => f.slice(-60)),
  target: cl(30),
  readiness: z.record(z.string(), z.boolean()),
  /** Computed by code before the call so the gateway can skip the model entirely. */
  complete: z.boolean(),
  venting: z.boolean(),
});
export type OnboardingTaskInput = z.infer<typeof onboardingInput>;

// Loose on purpose: the feature layer already sanitises and clamps every field.
export const onboardingOutput = z.object({
  reflection: z.string().nullish(),
  // Extra facts are dropped, not fatal: failing on a 4th fact would throw away a good turn and pay for a repair.
  facts: z.array(z.any()).default([]).transform((f) => f.slice(0, 3)),
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
  version: '4', // 4: prompt shortened to about 1k tokens, `slots` no longer requested
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
    // The full latest answer is in the key: recentTurns clips at 500 chars, and two long answers that share a
    // 500-char start must not share a reply. The venting flag changes the reply, so it is in the key too.
    keyOf: (i) => ({ d: i.nowDay, t: recentTurns(i.history, 3, 500), l: clip(i.history[i.history.length - 1]?.a ?? '', 1200), f: factsDigest(i.facts), s: i.target, v: i.venting }),
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
  nowDay: cl(10),
  message: z.string().min(1).transform((v) => v.slice(0, 2000)),
  // A 2000-char user message is legal as MESSAGE. It must also be legal one turn later as history.
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: cl(1500) })).transform((h) => h.slice(-12)),
  context: z.array(z.object({
    id: cl(80),
    category: cl(30),
    text: cl(400),
    /** How sure the app is: known, stated, observed or hypothesized. Defaults to stated. */
    confidence: z.enum(['known', 'stated', 'observed', 'hypothesized']).nullish(),
  })).transform((c) => c.slice(0, 30)),
});
export type ChatTaskInput = z.infer<typeof chatInput>;

const chatFact = z.object({
  category: z.enum(['people', 'projects', 'goals', 'commitments', 'prefs', 'history']),
  entity: z.string().nullish().transform((v) => (v ? v.slice(0, 80) : v)),
  text: z.string().min(4).transform((v) => v.slice(0, 300)),
  evidence: z.string().nullish().transform((v) => (v ? v.slice(0, 300) : v)),
  /** id of a CONTEXT line this fact corrects or replaces. Checked against CONTEXT before use. */
  supersedes: z.string().nullish().transform((v) => (v ? v.slice(0, 80) : v)),
});

// Lenient on purpose. One bad fact, an extra fact, a long string or an unknown intent used to fail the whole reply,
// and chat has no repair retry, so a good answer became "I couldn't think it through". Keep the reply, drop the bad part.
export const chatOutput = z.object({
  intent: z.enum(['heard', 'understand', 'decide', 'remember', 'act', 'unclear']).catch('unclear'),
  reply: z.string().min(1).transform((v) => clip(v, 1200)),
  outcome_line: z.string().nullish().transform((v) => (v ? clip(v, 200) : v)),
  ui: z.object({
    type: z.enum(['none', 'choice', 'chips']).catch('none'),
    options: z.array(z.string()).transform((o) => o.slice(0, 6).map((x) => clip(x, 60))).catch([]),
  }).nullish().catch(null),
  safety: z.boolean().nullish(),
  facts: z.array(z.unknown()).default([]).transform((arr) => {
    const ok: z.infer<typeof chatFact>[] = [];
    for (const f of arr) { const p = chatFact.safeParse(f); if (p.success) ok.push(p.data); if (ok.length === 2) break; }
    return ok;
  }),
});
export type ChatTaskOutput = z.infer<typeof chatOutput>;

export const chatTask: TaskDef<ChatTaskInput, ChatTaskOutput> = {
  id: 'chat_turn',
  version: '3', // 3: lenient output, answers to the assistant's own question reach the model
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
  shortcut: (i) => (isTrivialAck(i.message, [...i.history].reverse().find((h) => h.role === 'assistant')?.text) ? { intent: 'heard' as const, reply: 'Ok.', outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: false, facts: [] } : null),
  fallback: () => ({ intent: 'heard' as const, reply: "I've saved that. I couldn't think it through just now, so nothing is lost and you can add to it.", outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: false, facts: [] }),
};
