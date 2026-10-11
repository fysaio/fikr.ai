import { Slot, TargetSlot, UISpec } from '@/lib/onboarding/types';

export const PRODUCT_NAME = 'Gist';

/**
 * Strips em dash (U+2014) and en dash (U+2013), replacing with " - "
 * and collapses multiple spaces.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Fixed lists per Section 4 of Build Prompt
 */
export const FIXED_LISTS = {
  help_style: ['Just listen', 'Help me sort it', 'Nudge me'],
  week_shape: ['Classes', 'Work or internship', 'Faith or prayer', 'Family time', 'Training or sport', 'Commuting'],
  quiet_times: ['Mornings', 'During classes', 'Prayer times', 'Evenings', 'Weekends'],
};

/**
 * Static fallback questions per target slot when model calls fail (Section 5)
 */
export const FALLBACK_QUESTIONS: Record<
  string,
  { next_question: string; ui_spec: UISpec; slot_target: TargetSlot }
> = {
  project: {
    next_question: 'Which thing on your plate has a deadline, or is taking most of your time?',
    ui_spec: { type: 'text', ph: 'A project, a worry, anything', multiline: true },
    slot_target: 'project',
  },
  people: {
    next_question: 'Who else is involved in this?',
    ui_spec: { type: 'text', ph: 'Name and how they fit in', multiline: false },
    slot_target: 'people',
  },
  commitment: {
    next_question: 'Is there something you promised someone, or a decision you are sitting on?',
    ui_spec: { type: 'text', ph: 'A promise, a deadline, or a decision', multiline: true },
    slot_target: 'commitment',
  },
  week_shape: {
    next_question: 'What does a normal week hold for you?',
    ui_spec: {
      type: 'chips',
      options: [...FIXED_LISTS.week_shape],
      allow_text: true,
      text_label: 'Add your own (optional)',
      text_ph: 'Anything else fixed in your week?',
    },
    slot_target: 'week_shape',
  },
  quiet_times: {
    next_question: 'When should I leave you alone?',
    ui_spec: {
      type: 'time',
      chips: [...FIXED_LISTS.quiet_times],
      from: '22:00',
      to: '06:30',
      allow_text: true,
    },
    slot_target: 'quiet_times',
  },
  help_style: {
    next_question: 'When things pile up, what helps most?',
    ui_spec: {
      type: 'choice',
      options: [...FIXED_LISTS.help_style],
      allow_text: true,
      text_label: 'Anything to add? (optional)',
      text_ph: 'Add a detail, in your own words',
    },
    slot_target: 'help_style',
  },
  how_they_want_help: {
    next_question: 'When things pile up, what helps most?',
    ui_spec: {
      type: 'choice',
      options: [...FIXED_LISTS.help_style],
      allow_text: true,
      text_label: 'Anything to add? (optional)',
      text_ph: 'Add a detail, in your own words',
    },
    slot_target: 'help_style',
  },
  close: {
    next_question: "That's enough to start.",
    ui_spec: { type: 'none' },
    slot_target: 'close',
  },
};

/**
 * GUIDE & EXTRACTOR PROMPT (one model call per turn).
 * Static string: no per-user data, so the prefix is identical for everyone and provider prefix caches can reuse it.
 * Roughly 1k tokens. Venting and crisis handling live in code (see tasks.ts), not here, so they cost nothing per turn.
 * Bump onboardingTask.version in src/lib/ai/tasks.ts whenever this text changes.
 */
export const ONBOARDING_SYSTEM_PROMPT = `You are the onboarding guide for ${PRODUCT_NAME}, a personal assistant app. Learn just enough to make the person's first Today screen useful. Do not collect everything.

VOICE: plain human English. Match their tone, including Nigerian Pidgin, without caricature. No advice, coaching, motivation or therapy talk. No em dashes or en dashes.

EACH TURN
1. Read LATEST and FACTS. Never ask what they already told you. If they said their defence is Sunday and the supervisor has not replied, you know the deadline and who is involved.
2. Optionally echo their own words in under 10 words as "reflection". Never guess feelings.
3. Ask ONE question, at most 22 words. It must change what Today shows. If it would not, do not ask it.
4. Choose the lightest answer format:
- chips: several things can be true at once (blockers, parts of their week). Pick any.
- choice: one exclusive answer.
- rank: 2 to 5 items they named that compete. Put them in "items".
- time: quiet hours. Put common periods in "chips".
- text: only when a free answer is truly needed.
Every chips, choice, rank and time spec sets allow_text true with a short label such as "Anything to add? (optional)". Options must fit what they actually said. Never invent names. A catch-all option reads "Something else".

STOP with slot_target "close", next_question "That's enough to start." and ui_spec {"type":"none"} once you have: one concrete project or commitment, a schedule anchor (week shape or quiet times), and how they like help (Just listen, Help me sort it, Nudge me). Also stop from turn 4 on if detail is good.
If LATEST sounds overloaded or like venting, set wants_to_be_heard true. Code handles that reply.

FACTS (at most 3 per turn, stated only, never inferred)
- First person, in their words: "My defence is on Sunday." Keep entity verbatim. evidence is a verbatim quote. Copy dates exactly into due_text.
- Chosen options and typed nuance are facts. Combine them: "Blocking my defence: waiting on feedback, finishing slides."
- If they correct an earlier fact, set supersedes to its id and acknowledge briefly.
- category: people | projects | commitments | how_i_work | history. state: open | undecided | done | null.

INPUT: NOW, TURN, SLOT (what code wants next), READY, FACTS (id|cat|entity|value), RECENT, LATEST, VENTING_FLAG.

OUTPUT: JSON only
{"reflection":"optional","facts":[{"category":"","entity":null,"value":"","evidence":"","supersedes":null,"due_text":null,"state":null}],"next_question":"","ui_spec":{"type":"text|choice|chips|rank|time|none","ph":"","options":[],"items":[],"chips":[],"submit_on_tap":false,"allow_text":true,"text_label":"","text_ph":""},"slot_target":"project|people|commitment|help_style|week_shape|quiet_times|close","wants_to_be_heard":false,"correction":false}`;

export const EXTRACTOR_SYSTEM_PROMPT = ONBOARDING_SYSTEM_PROMPT;
export const GUIDE_SYSTEM_PROMPT = ONBOARDING_SYSTEM_PROMPT;
