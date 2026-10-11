import type { OnboardingFact, Slot, TargetSlot } from './types.ts';

export interface CoverageReport {
  slots: Record<Slot, boolean>;
  isComplete: boolean;
  target: TargetSlot;
  readinessMet: {
    concreteProjectOrCommitment: boolean;
    weekShapeCaptured: boolean;
  };
}

/**
 * Calculates slot coverage and readiness in code (build prompt v5, section 4).
 *
 * Quiet times and "how I want help" are NOT asked in onboarding any more: they live in Settings. They are still
 * reported in `slots` (the client may read them) but they never decide readiness or the next question.
 *
 * Ready when:
 * (a) at least one project or commitment with something concrete (a date or a person), and
 * (b) the shape of their week is captured,
 * after at least 3 turns; or after 7 turns whatever is captured.
 */
export function calculateCoverage(
  activeFacts: OnboardingFact[],
  history: Array<{ q: string; a: string }>,
  userTurns: number
): CoverageReport {
  // 1. project: >= 1 projects fact
  const hasProject = activeFacts.some(f => f.category === 'projects');

  // 2. people: >= 1 named person or entity in active facts
  const hasPeople = activeFacts.some(
    f => f.category === 'people' || Boolean(f.entity) || (f.value && /(supervisor|boss|lead|manager|colleague|partner|friend|mother|father|mum|dad|client|team)/i.test(f.value))
  );

  // 3. commitment: >= 1 commitments fact
  const hasCommitment = activeFacts.some(f => f.category === 'commitments');

  // (a) Concrete project or commitment: has due date OR named person OR entity
  const hasConcreteProjectOrCommitment = activeFacts.some(f => {
    if (f.category !== 'projects' && f.category !== 'commitments') return false;
    const hasDate = Boolean(f.due_text || f.due_at);
    const hasPerson = Boolean(f.entity) || hasPeople;
    return hasDate || hasPerson;
  });

  // 4. help_style: >= 1 how_i_work fact about support style (listen, sort, nudge)
  const hasHelpStyle = activeFacts.some(f => {
    if (f.category !== 'how_i_work') return false;
    const v = (f.value || '').toLowerCase();
    return v.includes('listen') || v.includes('sort') || v.includes('nudge') || v.includes('help') || v.includes('support');
  }) || history.some(h => {
    const q = (h.q || '').toLowerCase();
    return (q.includes('help most') || q.includes('listened to') || q.includes('helped to sort') || q.includes('nudged')) && Boolean(h.a);
  });

  // 5. week_shape: fixed week periods (classes, work, prayer, family, training, sport, commuting)
  const hasWeekShape = activeFacts.some(f => {
    if (f.category !== 'how_i_work') return false;
    const v = (f.value || '').toLowerCase();
    return v.includes('class') || v.includes('work') || v.includes('internship') || v.includes('faith') || v.includes('prayer') || v.includes('family') || v.includes('sport') || v.includes('commuting');
  }) || history.some(h => {
    const q = (h.q || '').toLowerCase();
    return q.includes('normal week') && Boolean(h.a);
  });

  // 6. quiet_times: quiet periods or hours
  const hasQuietTimes = activeFacts.some(f => {
    if (f.category !== 'how_i_work') return false;
    const v = (f.value || '').toLowerCase();
    return v.includes('quiet') || v.includes('leave me alone') || v.includes('morning') || v.includes('evening') || v.includes('weekend') || v.includes('from ') || v.includes('to ');
  }) || history.some(h => {
    const q = (h.q || '').toLowerCase();
    return (q.includes('leave you alone') || q.includes('quiet hours') || q.includes('stay quiet')) && Boolean(h.a);
  });

  const slots: Record<Slot, boolean> = {
    project: hasProject,
    people: hasPeople,
    commitment: hasCommitment,
    help_style: hasHelpStyle,
    week_shape: hasWeekShape,
    quiet_times: hasQuietTimes,
  };

  const readinessMet = {
    concreteProjectOrCommitment: hasConcreteProjectOrCommitment,
    weekShapeCaptured: hasWeekShape,
  };

  const fullyReady = hasConcreteProjectOrCommitment && hasWeekShape && userTurns >= 3;

  const reachedTurnLimit = userTurns >= 7;
  const isComplete = fullyReady || reachedTurnLimit;

  // Next slot target in priority:
  // 1. a project or commitment
  // 2. people tied to it
  // 3. shape of the week
  // 4. something concrete (a date or a person) on a project or commitment
  let target: TargetSlot = 'close';
  if (isComplete) {
    target = 'close';
  } else if (!hasProject && !hasCommitment) {
    target = 'project';
  } else if (!hasPeople) {
    target = 'people';
  } else if (!hasWeekShape) {
    target = 'week_shape';
  } else if (!hasConcreteProjectOrCommitment) {
    target = 'commitment';
  } else {
    target = 'close';
  }

  return {
    slots,
    isComplete,
    target,
    readinessMet,
  };
}
