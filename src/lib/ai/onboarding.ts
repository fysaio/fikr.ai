import { runTask } from './gateway/gateway';
import { ensureGateway } from './gateway/server';
import { onboardingTask } from './tasks';
import {
  OnboardingFact,
  ExtractorRawFact,
  FactCategory,
  FactState,
  Slot,
  TargetSlot,
  UISpec,
  TurnResult,
} from '@/lib/onboarding/types';
import { calculateCoverage } from '@/lib/onboarding/coverage';
import {
  FALLBACK_QUESTIONS,
  sanitizeText,
} from '@/config/onboarding-prompts';

export interface OnboardingTurnAIResult extends TurnResult {
  metadata: {
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    model: string;
    retried: boolean;
    fallbackUsed: boolean;
  };
}

export type OnboardingTurnResult = OnboardingTurnAIResult;
export type OnboardingRawOutput = any;

/**
 * Validates and sanitizes a UISpec, falling back to a safe default if malformed.
 */
/** `allowTapSubmit` is true only for the fixed venting and safety cards. A model-chosen tap-to-submit would remove the text box on an ordinary question. */
function validateUISpec(spec: any, fallbackTarget: TargetSlot, allowTapSubmit = false): UISpec {
  if (!spec || typeof spec !== 'object') {
    return { type: 'text', ph: 'Write your answer here...', multiline: true };
  }

  const type = spec.type;
  if (type === 'choice') {
    const rawOptions = Array.isArray(spec.options) ? spec.options : [];
    const options = rawOptions
      .map((opt: any) => {
        if (typeof opt === 'string') return sanitizeText(opt);
        if (typeof opt === 'object' && opt !== null && opt.label) {
          return {
            label: sanitizeText(opt.label),
            sub: opt.sub ? sanitizeText(opt.sub) : undefined,
          };
        }
        return '';
      })
      .filter((opt: any) => (typeof opt === 'string' ? opt.length > 0 : opt.label.length > 0))
      .slice(0, 5);

    if (options.length === 0) {
      return { type: 'text', ph: 'Write your answer here...', multiline: true };
    }

    return {
      type: 'choice',
      options,
      submit_on_tap: allowTapSubmit && Boolean(spec.submit_on_tap),
      allow_text: allowTapSubmit && spec.submit_on_tap ? false : spec.allow_text !== false,
      text_label: spec.text_label ? sanitizeText(spec.text_label) : 'Anything to add? (optional)',
      text_ph: spec.text_ph ? sanitizeText(spec.text_ph) : 'Add a detail, in your own words',
    };
  }

  if (type === 'chips') {
    const rawOptions = Array.isArray(spec.options)
      ? spec.options
      : Array.isArray(spec.chips)
      ? spec.chips
      : [];
    const options = rawOptions
      .map((o: any) => (typeof o === 'string' ? sanitizeText(o) : ''))
      .filter((o: string) => o.length > 0)
      .slice(0, 6);

    if (options.length === 0) {
      return { type: 'text', ph: 'Write your answer here...', multiline: true };
    }

    return {
      type: 'chips',
      options,
      allow_text: spec.allow_text !== false,
      text_label: spec.text_label ? sanitizeText(spec.text_label) : 'Add your own (optional)',
      text_ph: spec.text_ph ? sanitizeText(spec.text_ph) : 'Anything else fixed?',
    };
  }

  if (type === 'rank') {
    const rawItems = Array.isArray(spec.items)
      ? spec.items
      : Array.isArray(spec.options)
      ? spec.options
      : [];
    const items = rawItems
      .map((i: any) => (typeof i === 'string' ? sanitizeText(i) : ''))
      .filter((i: string) => i.length > 0)
      .slice(0, 5);

    if (items.length < 2) {
      return { type: 'text', ph: 'Tell me your priority order...', multiline: true };
    }

    return {
      type: 'rank',
      items,
      allow_text: spec.allow_text !== false,
      text_label: spec.text_label ? sanitizeText(spec.text_label) : 'Anything to add? (optional)',
      text_ph: spec.text_ph ? sanitizeText(spec.text_ph) : 'Why this order?',
    };
  }

  if (type === 'time') {
    const rawChips = Array.isArray(spec.chips) ? spec.chips : [];
    const chips = rawChips
      .map((c: any) => (typeof c === 'string' ? sanitizeText(c) : ''))
      .filter((c: string) => c.length > 0);

    return {
      type: 'time',
      chips: chips.length > 0 ? chips : ['Mornings', 'During classes', 'Prayer times', 'Evenings', 'Weekends'],
      from: spec.from || '22:00',
      to: spec.to || '06:30',
      allow_text: spec.allow_text !== false,
      text_label: spec.text_label ? sanitizeText(spec.text_label) : 'Anything to add? (optional)',
      text_ph: spec.text_ph ? sanitizeText(spec.text_ph) : 'Add a detail, in your own words',
    };
  }

  if (type === 'none') {
    return { type: 'none' };
  }

  return {
    type: 'text',
    ph: spec.ph ? sanitizeText(spec.ph) : 'A project, a worry, anything',
    multiline: spec.multiline !== false,
    label: spec.label ? sanitizeText(spec.label) : undefined,
  };
}

/**
 * Detects whether user message signals heavy venting/overload using simple heuristics.
 */
function detectsVentingHeuristic(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const ventPhrases = [
    'just listen',
    'just want to talk',
    'overwhelmed',
    'drowning',
    'too much at once',
    'too much going on',
    'so much going on',
    'head is spinning',
    'head is full',
    'stressed out',
    'cant cope',
    "can't cope",
    'a lot on my plate',
    'just venting',
    'tired of everything',
  ];
  const matchesPhrase = ventPhrases.some((phrase) => lower.includes(phrase));
  const isVeryLong = message.length > 250 && (lower.includes('and') || lower.includes('also') || lower.includes(','));
  return matchesPhrase || isVeryLong;
}

export async function runOnboardingTurn(
  history: Array<{ q: string; a: string }>,
  existingFacts: OnboardingFact[],
  nowIso = new Date().toISOString(),
  userId = 'anonymous'
): Promise<OnboardingTurnAIResult> {
  const userTurns = history.length;
  const latestTurn = history[history.length - 1];
  const latestMessage = latestTurn?.a ? sanitizeText(latestTurn.a) : '';

  // Internal coverage evaluation
  const activeFacts = existingFacts.filter((f) => f.status === 'active');
  const coverage = calculateCoverage(activeFacts, history, userTurns);
  const currentTarget: TargetSlot = coverage.target;

  // Check venting heuristic
  const isVentingSignal = detectsVentingHeuristic(latestMessage);

  ensureGateway();
  const task = await runTask(
    onboardingTask,
    {
      nowDay: nowIso.slice(0, 10),
      history,
      facts: activeFacts.map((f) => ({ id: f.id, category: f.category, entity: f.entity, value: f.value, due_text: f.due_text })),
      target: currentTarget,
      readiness: coverage.readinessMet as unknown as Record<string, boolean>,
      complete: coverage.isComplete,
      venting: isVentingSignal,
    },
    { userId }
  );
  const result = {
    success: task.source !== 'fallback',
    data: task.data as any,
    metadata: {
      model: task.usage.model ?? (task.source === 'rule' ? 'rule' : task.source === 'cache' ? 'cache' : 'fallback'),
      latencyMs: task.usage.latencyMs,
      tokensIn: task.usage.tokensIn,
      tokensOut: task.usage.tokensOut,
      retried: task.usage.retried,
    },
  };

  const fallback = FALLBACK_QUESTIONS[currentTarget] || FALLBACK_QUESTIONS.project;

  // Safety gate tripped: fixed, careful copy. Skip every cap below (the 22-word limit would cut it short),
  // store no facts, and keep the person in a gentle two-option state instead of the next onboarding question.
  if (task.source === 'rule' && task.reason === 'safety') {
    const safe = task.data;
    return {
      reflection: undefined,
      facts: [],
      next_question: sanitizeText(safe.next_question),
      ui_spec: validateUISpec(safe.ui_spec, 'thread', true),
      slot_target: 'thread',
      wants_to_be_heard: true,
      correction: false,
      slots: coverage.slots,
      metadata: {
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        model: 'rule',
        retried: false,
        fallbackUsed: false,
      },
    };
  }

  const rawData = result.data;
  let fallbackUsed = false;

  if (!result.success || !rawData || typeof rawData !== 'object') {
    fallbackUsed = true;
    return {
      reflection: undefined,
      facts: [],
      next_question: sanitizeText(fallback.next_question),
      ui_spec: fallback.ui_spec,
      slot_target: fallback.slot_target,
      wants_to_be_heard: false,
      correction: false,
      slots: coverage.slots,
      metadata: {
        latencyMs: result.metadata.latencyMs,
        tokensIn: result.metadata.tokensIn,
        tokensOut: result.metadata.tokensOut,
        model: result.metadata.model,
        retried: result.metadata.retried,
        fallbackUsed: true,
      },
    };
  }

  // Reflection is optional and short. An over-long one is dropped, never cut mid-sentence.
  let reflection: string | undefined = undefined;
  if (rawData.reflection && typeof rawData.reflection === 'string') {
    // A reflection longer than 10 words is the model copying the whole message back. Cutting it leaves a broken
    // sentence ("...and my supervisor hasn't"), so drop it. No reflection is better than a cut one.
    const words = sanitizeText(rawData.reflection).split(' ');
    if (words.length <= 10) reflection = words.join(' ');
  }

  // Handle extracted facts: max 3 facts, stated only!
  const rawFactsList = Array.isArray(rawData.facts) ? rawData.facts : [];
  const processedFacts: ExtractorRawFact[] = rawFactsList
    .slice(0, 3)
    .map((rf: any) => {
      let cat: FactCategory = rf.category || 'projects';
      if (!['people', 'projects', 'commitments', 'how_i_work', 'history'].includes(cat)) {
        cat = 'projects';
      }

      return {
        category: cat,
        entity: rf.entity ? sanitizeText(rf.entity) : null,
        value: sanitizeText(rf.value),
        evidence: rf.evidence ? sanitizeText(rf.evidence) : latestMessage.slice(0, 120),
        epistemic_state: 'stated' as const, // Strict Rule: ONLY stated in onboarding!
        supersedes: rf.supersedes ? String(rf.supersedes) : null,
        due_text: rf.due_text ? sanitizeText(rf.due_text) : null,
        // State only makes sense for work and promises. A person is not "open".
        state: cat === 'projects' || cat === 'commitments' ? ((rf.state as FactState) || (cat === 'commitments' ? 'open' : null)) : null,
      };
    })
    .filter((f: ExtractorRawFact) => f.value.length > 0);

  // Handle venting branch enforcement if either model or heuristic detected it
  const wantsToBeHeard = Boolean(rawData.wants_to_be_heard) || isVentingSignal;

  let nextQ = sanitizeText(rawData.next_question) || fallback.next_question;
  // Enforce max 22 words on next_question
  const qWords = nextQ.split(' ');
  if (qWords.length > 22) {
    nextQ = qWords.slice(0, 22).join(' ');
  }

  let uiSpec = validateUISpec(rawData.ui_spec, currentTarget, rawData.slot_target === 'thread');
  let slotTarget: TargetSlot = rawData.slot_target || currentTarget;

  if (wantsToBeHeard && userTurns <= 2) {
    // If not already in venting branch, force venting branch
    if (uiSpec.type !== 'choice' || !uiSpec.submit_on_tap) {
      reflection = "I'm hearing a lot at once.";
      nextQ = 'What would help right now?';
      uiSpec = {
        type: 'choice',
        submit_on_tap: true,
        options: [
          { label: 'Think one through', sub: 'Pick one thing and work it out together' },
          { label: 'Just get it out', sub: "No questions. I'll just listen." },
          { label: 'Not now', sub: 'We can pick this up later' },
        ],
      };
      slotTarget = 'thread';
    }
  }

  // Tap-to-send is only for the venting card. On any other choice card it would submit before the person can add text.
  if (uiSpec.type === 'choice' && uiSpec.submit_on_tap && slotTarget !== 'thread') {
    uiSpec = { ...uiSpec, submit_on_tap: false, allow_text: true };
  }

  const slotsReturned: Record<Slot, boolean> = {
    project: Boolean(rawData.slots?.project ?? coverage.slots.project),
    people: Boolean(rawData.slots?.people ?? coverage.slots.people),
    commitment: Boolean(rawData.slots?.commitment ?? coverage.slots.commitment),
    help_style: Boolean(rawData.slots?.help_style ?? coverage.slots.help_style),
    week_shape: Boolean(rawData.slots?.week_shape ?? coverage.slots.week_shape),
    quiet_times: Boolean(rawData.slots?.quiet_times ?? coverage.slots.quiet_times),
  };

  return {
    reflection,
    facts: processedFacts,
    next_question: nextQ,
    ui_spec: uiSpec,
    slot_target: slotTarget,
    wants_to_be_heard: wantsToBeHeard,
    correction: Boolean(rawData.correction),
    slots: slotsReturned,
    metadata: {
      latencyMs: result.metadata.latencyMs,
      tokensIn: result.metadata.tokensIn,
      tokensOut: result.metadata.tokensOut,
      model: result.metadata.model,
      retried: result.metadata.retried,
      fallbackUsed,
    },
  };
}
