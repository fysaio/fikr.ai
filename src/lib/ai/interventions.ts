import {
  InterventionDecision,
  InterventionKind,
  InterventionOutcome,
} from '@/lib/models/schema';
import { Memory } from '@/types';
import { isQuiet, type Settings } from '@/lib/settings/settings';
import { zonedNow } from '@/lib/nudges/decide';

export interface DeciderContext {
  user_profile?: {
    quiet_start?: string; // Default '22:00'
    quiet_end?: string; // Default '07:00'
    timezone?: string; // Default 'Africa/Lagos' or 'UTC'
    nudge_level?: string; // Default 'morning_and_when_helps'
  };
  current_time?: string; // ISO string, defaults to now
  memories: Memory[];
  interventions_today: Array<{
    id: string;
    kind: InterventionKind;
    decision: InterventionDecision;
    shown_at?: string;
    outcome?: InterventionOutcome;
  }>;
  recent_outcomes?: Array<{
    kind: InterventionKind;
    outcome: InterventionOutcome;
  }>;
  daily_cap?: number; // Default 2
  /** The person's real Settings (quiet times, which kinds may speak). Wins over user_profile quiet times. */
  settings?: Settings;
}

export interface DeciderResult {
  decision: InterventionDecision;
  reason: string;
  kind?: InterventionKind;
  text?: string;
  why?: string;
  source_fact_ids?: string[];
  action_label?: string;
}

/**
 * Parses "HH:MM" into minutes from midnight (0..1439)
 */
function parseTimeMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

/**
 * Checks if current minute falls inside [quiet_start, quiet_end]
 */
function isInQuietPeriod(
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number
): boolean {
  if (startMinutes > endMinutes) {
    // Crosses midnight, e.g. 22:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Intervention Decider
 * Evaluates context and returns 'act' | 'ask' | 'suggest' | 'silent'.
 * Default is 'silent'. Needs a clear reason to speak.
 * Hard daily cap on interventions (default 2), and none during protected periods.
 */
export function decideIntervention(ctx: DeciderContext): DeciderResult {
  const startTime = Date.now();
  const profile = ctx.user_profile || {};
  const quietStartStr = profile.quiet_start || '22:00';
  const quietEndStr = profile.quiet_end || '07:00';
  const dailyCap = ctx.daily_cap ?? 2;

  const now = ctx.current_time ? new Date(ctx.current_time) : new Date();
  // Wall-clock time in the person's timezone. getHours() on a server is UTC, which shifted quiet hours
  // and the morning window by an hour for Lagos and by more elsewhere.
  const local = zonedNow(now, profile.timezone || 'Africa/Lagos');
  const currentMinutes = local.getHours() * 60 + local.getMinutes();
  const speakOn = (kind: 'contextual_action' | 'relationship' | 'reflection' | 'orientation') => {
    if (!ctx.settings) return true;
    const map = { contextual_action: 'moment', relationship: 'people', reflection: 'reflection', orientation: 'orientation' } as const;
    return ctx.settings.speak[map[kind]];
  };
  const quietStartMin = parseTimeMinutes(quietStartStr);
  const quietEndMin = parseTimeMinutes(quietEndStr);

  // 1. Protected Quiet Period Check
  const quietNow = ctx.settings ? isQuiet(local, ctx.settings) : isInQuietPeriod(currentMinutes, quietStartMin, quietEndMin);
  if (quietNow) {
    return logAndReturn({
      decision: 'silent',
      reason: `Currently in protected quiet period (${quietStartStr} - ${quietEndStr})`,
    });
  }

  // 2. Hard Daily Cap Check
  const nonSilentCountToday = ctx.interventions_today.filter(
    (i) => i.decision !== 'silent'
  ).length;

  if (nonSilentCountToday >= dailyCap) {
    return logAndReturn({
      decision: 'silent',
      reason: `Daily cap of ${dailyCap} interventions reached (${nonSilentCountToday} served today)`,
    });
  }

  // 3. User Nudge Level Preference Check
  if (
    profile.nudge_level === 'only_when_asked' ||
    profile.nudge_level === 'never'
  ) {
    return logAndReturn({
      decision: 'silent',
      reason: 'User preference set to speak only when asked',
    });
  }

  // 4. Fatigue / Learning from ignored interruptions
  const recentDismissals = (ctx.recent_outcomes || []).slice(-5);
  const dismissedKinds = new Set(
    recentDismissals
      .filter((r) => r.outcome === 'dismissed' || r.outcome === 'ignored')
      .map((r) => r.kind)
  );

  const activeMemories = ctx.memories.filter(
    (m) => !m.gone && !m.rejected && m.status !== 'deleted'
  );

  // 5. Evaluate Concrete Triggers (Need a clear, compelling reason to speak)

  // Trigger A: Stalled or pending commitment (Contextual Action)
  if (speakOn('contextual_action') && !dismissedKinds.has('contextual_action')) {
    const commitments = activeMemories.filter(
      (m) => m.category === 'commitments' && !m.snooze
    );

    const urgentCommitment = commitments.find((c) =>
      /\b(today|due|reply|send|call|before|friday|asap)\b/i.test(c.text) ||
      (c.when_label && /today/i.test(c.when_label))
    );

    if (urgentCommitment) {
      return logAndReturn({
        decision: 'suggest',
        kind: 'contextual_action',
        reason: 'Stalled commitment requiring follow-up today',
        text: `You noted: "${urgentCommitment.text}". Would you like to clear this now?`,
        why: 'From your commitments on file',
        source_fact_ids: [urgentCommitment.id],
        action_label: 'Take care of it',
      });
    }
  }

  // Trigger B: Relationship follow-up (Relationship)
  if (speakOn('relationship') && !dismissedKinds.has('relationship')) {
    const people = activeMemories.filter((m) => m.category === 'people');
    const relationshipCommitment = activeMemories.find(
      (m) =>
        m.category === 'commitments' &&
        people.some((p) => m.text.toLowerCase().includes(p.text.toLowerCase()))
    );

    if (relationshipCommitment) {
      return logAndReturn({
        decision: 'suggest',
        kind: 'relationship',
        reason: 'Promised follow-up with a person in your life',
        text: `Open note regarding ${relationshipCommitment.text}. Ready to reach out?`,
        why: 'From your people and commitments history',
        source_fact_ids: [relationshipCommitment.id],
        action_label: 'Reach out',
      });
    }
  }

  // Trigger C: Pattern reflection (Reflection)
  if (speakOn('reflection') && !dismissedKinds.has('reflection')) {
    const hypothesizedPattern = activeMemories.find(
      (m) => m.category === 'patterns' && m.confidence === 'hypothesized' && !m.snooze
    );

    if (hypothesizedPattern) {
      return logAndReturn({
        decision: 'ask',
        kind: 'reflection',
        reason: 'Unverified pattern hypothesis waiting for user alignment',
        text: `I noticed: "${hypothesizedPattern.text}". Does this feel true to you?`,
        why: 'Hypothesis formed from your recent observations',
        source_fact_ids: [hypothesizedPattern.id],
        action_label: 'Verify pattern',
      });
    }
  }

  // Trigger D: Morning Orientation Window (Orientation)
  // Window: 07:30 to 09:30, if no orientation was served yet today
  if (speakOn('orientation') && !dismissedKinds.has('orientation')) {
    const hadOrientationToday = ctx.interventions_today.some(
      (i) => i.kind === 'orientation' && i.decision !== 'silent'
    );
    if (!hadOrientationToday && currentMinutes >= 450 && currentMinutes <= 570) {
      return logAndReturn({
        decision: 'suggest',
        kind: 'orientation',
        reason: 'Morning orientation window',
        text: 'Good morning. Your key commitments and open thoughts are ready.',
        why: 'Daily morning orientation',
        action_label: 'View today',
      });
    }
  }

  // 6. Default to Silent
  return logAndReturn({
    decision: 'silent',
    reason: 'No urgent trigger or stalled commitment; silence is default',
  });

  function logAndReturn(res: DeciderResult): DeciderResult {
    const latencyMs = Date.now() - startTime;
    // Log instrumentation event without raw user content per Section 11
    if (typeof console !== 'undefined' && console.log) {
      console.log(
        '[INSTRUMENTATION_EVENT]',
        JSON.stringify({
          event: 'intervention_decided',
          decision: res.decision,
          reason: res.reason,
          kind: res.kind || 'none',
          latency_ms: latencyMs,
        })
      );
    }
    return res;
  }
}
