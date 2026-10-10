import { OnboardingFact, Slot, TargetSlot } from './types';

export interface CoverageReport {
  slots: Record<Slot, boolean>;
  isComplete: boolean;
  target: TargetSlot;
  readinessMet: {
    concreteProjectOrCommitment: boolean;
    weekOrQuietCaptured: boolean;
    helpStyleCaptured: boolean;
  };
}

/**
 * Calculates slot coverage and readiness strictly in code per Section 5 of Build Prompt:
 * Ready when:
 * (a) at least one project or commitment with something concrete (a name plus a date or a person), and
 * (b) week shape or quiet times is captured, and
 * (c) help style is captured;
 * or after 7 person turns;
 * Minimum 3 turns unless user stops sooner.
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

  const weekOrQuietCaptured = hasWeekShape || hasQuietTimes;
  const readinessMet = {
    concreteProjectOrCommitment: hasConcreteProjectOrCommitment,
    weekOrQuietCaptured,
    helpStyleCaptured: hasHelpStyle,
  };

  const fullyReady =
    hasConcreteProjectOrCommitment &&
    weekOrQuietCaptured &&
    hasHelpStyle &&
    userTurns >= 3;

  const reachedTurnLimit = userTurns >= 7;
  const isComplete = fullyReady || reachedTurnLimit;

  // Next slot target in priority:
  // 1. dated commitment or project
  // 2. people tied to it
  // 3. shape of the week
  // 4. how they want help
  // 5. quiet times
  let target: TargetSlot = 'close';
  if (isComplete) {
    target = 'close';
  } else if (!hasProject && !hasCommitment) {
    target = 'project';
  } else if (!hasPeople) {
    target = 'people';
  } else if (!hasWeekShape && !hasQuietTimes) {
    target = 'week_shape';
  } else if (!hasHelpStyle) {
    target = 'help_style';
  } else if (!hasQuietTimes) {
    target = 'quiet_times';
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
