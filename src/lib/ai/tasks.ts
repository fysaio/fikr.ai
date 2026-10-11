import { z } from 'zod';
import type { TaskDef } from './gateway/types';
import { compactFacts, factsDigest, recentTurns, type CompactFact } from './gateway/context';
import { clip, isTrivialAck } from './gateway/text';
import { SUPPORT_LINE } from '@/config/support-copy';
import { ONBOARDING_SYSTEM_PROMPT, FALLBACK_QUESTIONS } from '@/config/onboarding-prompts';
import { CHAT_SYSTEM_PROMPT } from '@/config/chat-prompt';
import { CRISIS_RESOURCES } from '@/config/flags';

/* ------------------------------------------------------------------ onboarding */

/** Over-long strings are clipped, not rejected. A rejected input throws and the person gets a canned fallback for a message that was fine. */
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
// Extra facts are dropped, not fatal: failing validation on a 4th fact would throw away a good turn and pay again for a repair.
export const onboardingOutput = z.object({
  reflection: z.string().nullish(),
  facts: z.array(z.any()).default([]).transform((f) => f.slice(0, 3)),
  next_question: z.string().min(1),
  ui_spec: z.any(),
  slot_target: z.string().nullish(),
  wants_to_be_heard: z.boolean().nullish(),
  correction: z.boolean().nullish(),
  /** True only for the fixed safety reply. The client routes to support resources. */
  safety: z.boolean().nullish(),
});
export type OnboardingTaskOutput = z.infer<typeof onboardingOutput>;

const SAFE_UI = {
  type: 'choice',
  submit_on_tap: true,
  options: [
    { label: 'Show me who I can talk to' },
    { label: "I'm okay for now", sub: 'You can keep writing to me' },
  ],
};

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
  // 3: prompt rewritten and shortened, `slots` dropped from the output, safety gate added.
  version: '3',
  system: ONBOARDING_SYSTEM_PROMPT,
  temperature: 0.5,
  maxOutTokens: 700,
  timeoutMs: 12000,
  inputSchema: onboardingInput,
  outputSchema: onboardingOutput,
  repair: true,
  userText: (i) => i.history[i.history.length - 1]?.a ?? '',
  safe: () => ({ reflection: 'Thank you for telling me. That sounds heavy.', facts: [], next_question: SUPPORT_LINE, ui_spec: SAFE_UI, slot_target: 'support', wants_to_be_heard: true, correction: false, safety: true }),
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
    // The full latest answer is in the key: recentTurns clips at 500 chars, and two long answers that share
    // a 500-char start must not share a reply.
    keyOf: (i) => ({ d: i.nowDay, t: recentTurns(i.history, 3, 500), l: clip(i.history[i.history.length - 1]?.a ?? '', 1200), f: factsDigest(i.facts), s: i.target, v: i.venting }),
  },
  shortcut: (i) => {
    const turn = i.history.length;
    if (i.venting && turn <= 2) {
      return { reflection: "I'm hearing a lot at once.", facts: [], next_question: 'What would help right now?', ui_spec: VENT_UI, slot_target: 'thread', wants_to_be_heard: true, correction: false };
    }
    if (i.complete) {
      return { reflection: null, facts: [], next_question: "That's enough to start.", ui_spec: { type: 'none' }, slot_target: 'close', wants_to_be_heard: false, correction: false };
    }
    return null;
  },
  fallback: (i) => {
    const fb = FALLBACK_QUESTIONS[i.target] || FALLBACK_QUESTIONS.project;
    return { reflection: null, facts: [], next_question: fb.next_question, ui_spec: fb.ui_spec, slot_target: fb.slot_target, wants_to_be_heard: false, correction: false };
  },
};

/* ------------------------------------------------------------------ chat (replaces Think) */

export const chatInput = z.object({
  nowDay: cl(10),
  message: z.string().min(1).transform((v) => v.slice(0, 2000)),
  // A 2000-char user message is legal as MESSAGE. It must also be legal one turn later as history.
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: cl(1500) })).transform((h) => h.slice(-12)),
  context: z.array(z.object({ id: cl(80), category: cl(30), text: cl(400) })).transform((c) => c.slice(0, 30)),
});
export type ChatTaskInput = z.infer<typeof chatInput>;

const chatFact = z.object({
  category: z.enum(['people', 'projects', 'goals', 'commitments', 'prefs', 'history']),
  entity: z.string().nullish().transform((v) => (v ? v.slice(0, 80) : v)),
  text: z.string().min(4).transform((v) => v.slice(0, 300)),
  evidence: z.string().nullish().transform((v) => (v ? v.slice(0, 300) : v)),
});

// Lenient on purpose. One bad fact, an extra fact, a long string or an unknown intent used to fail the whole
// reply, and chat has no repair retry, so a good answer became "I couldn't think it through". Keep the reply, drop the bad part.
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

const CRISIS_COPY = CRISIS_RESOURCES.length > 0
  ? `If you might hurt yourself or someone else, please reach someone near you now. ${CRISIS_RESOURCES.map((r) => `${r.name}: ${r.contact}`).join('. ')}.`
  : 'If you might hurt yourself or someone else, please contact someone you trust who is near you now, and your local emergency services.';

export const chatTask: TaskDef<ChatTaskInput, ChatTaskOutput> = {
  id: 'chat_turn',
  // 2: prompt wording (Gist me, answers to your own question), lenient output, cache key includes memory.
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
      `CONTEXT(id|cat|text):\n${i.context.length ? i.context.slice(0, 15).map((c) => `${c.id}|${c.category}|${clip(c.text, 160)}`).join('\n') : 'none'}`,
      i.history.length ? `RECENT:\n${i.history.slice(-4).map((h) => `${h.role === 'user' ? 'U' : 'G'}:${clip(h.text, 300)}`).join('\n')}` : '',
      `MESSAGE:"${i.message}"`,
    ].filter(Boolean).join('\n'),
  // Same message twice in a row (double tap, outbox replay) answers once. Memory is part of the key: the same words
  // mean something else once the person has added or forgotten something, and a stale hit would also replay old facts.
  cache: { ttlSec: 300, scope: 'user', keyOf: (i) => ({ d: i.nowDay, m: i.message.trim().toLowerCase(), h: i.history.slice(-2), c: factsDigest(i.context.map((c) => ({ id: c.id, category: c.category, value: c.text }))) }) },
  userText: (i) => i.message,
  safe: () => ({ intent: 'heard' as const, reply: `Thank you for telling me. That sounds heavy. I'm an app, so I can't be the right help for this. A real person can. ${CRISIS_COPY}`, outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: true, facts: [] }),
  shortcut: (i) => (isTrivialAck(i.message, [...i.history].reverse().find((h) => h.role === 'assistant')?.text) ? { intent: 'heard' as const, reply: 'Ok.', outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: false, facts: [] } : null),
  fallback: () => ({ intent: 'heard' as const, reply: "I've saved that. I couldn't think it through just now, so nothing is lost and you can add to it.", outcome_line: null, ui: { type: 'none' as const, options: [] }, safety: false, facts: [] }),
};
