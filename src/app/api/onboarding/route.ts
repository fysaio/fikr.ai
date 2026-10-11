import { NextResponse } from 'next/server';
import { runOnboardingTurn } from '@/lib/ai/onboarding';
import {
  FALLBACK_QUESTIONS,
  sanitizeText,
} from '@/config/onboarding-prompts';
import { OnboardingFact, TargetSlot } from '@/lib/onboarding/types';
import { processNewFacts } from '@/lib/onboarding/dedupe';
import { calculateCoverage } from '@/lib/onboarding/coverage';
import { getAuthedUser } from '@/lib/ai/gateway/auth';
import { allow, ensureGateway } from '@/lib/ai/gateway/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  let currentTarget: TargetSlot = 'project';
  // Kept outside the try so the error path can hand back what the client already had. Returning an empty
  // list here used to wipe every fact collected so far (the client replaces its list with whatever comes back).
  let factsSoFar: OnboardingFact[] = [];
  const nowIso = new Date().toISOString();

  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: 'Log in again.' }, { status: 401, headers: NO_STORE });
  ensureGateway();
  if (!(await allow(user.id, 'onboarding', 20))) {
    return NextResponse.json({ error: 'Slow down for a moment.' }, { status: 429, headers: { ...NO_STORE, 'Retry-After': '30' } });
  }

  try {
    const body = await req.json();
    const { history, existing_facts } = body;

    if (!history || !Array.isArray(history)) {
      return NextResponse.json({ error: 'Invalid history payload' }, { status: 400 });
    }

    const userTurns = history.length;
    const latestTurn = history[history.length - 1];

    // Section 10: Reject oversized input (cap text at 2,000 characters per turn)
    if (latestTurn?.a && typeof latestTurn.a === 'string' && latestTurn.a.length > 2000) {
      return NextResponse.json(
        { error: 'Message is too long. Please keep your answer under 2,000 characters.' },
        { status: 400 }
      );
    }

    const existingFactsList: OnboardingFact[] = Array.isArray(existing_facts) ? existing_facts : [];
    factsSoFar = existingFactsList;

    // SINGLE MODEL CALL per turn
    const turnResult = await runOnboardingTurn(history, existingFactsList, nowIso, user.id);

    // Process extracted facts: dedupe, validate, supersedes, dates
    const { updatedExisting, newlyAdded, supersededCount } = processNewFacts(
      turnResult.facts,
      existingFactsList,
      userTurns,
      nowIso
    );

    const activeFacts = updatedExisting.filter((f) => f.status === 'active');
    const coverage = calculateCoverage(activeFacts, history, userTurns);
    currentTarget = turnResult.slot_target || coverage.target;

    const isComplete = coverage.isComplete;

    // Content-free Instrumentation logging per Section 11 & 12
    const logMetadata = {
      event: 'turn_submitted',
      turn_index: userTurns,
      target: currentTarget,
      ui_type: turnResult.ui_spec.type,
      model: turnResult.metadata.model,
      fallback_used: turnResult.metadata.fallbackUsed,
      facts_added_count: newlyAdded.length,
      facts_superseded_count: supersededCount,
      latency_ms: turnResult.metadata.latencyMs,
      tokens_in: turnResult.metadata.tokensIn,
      tokens_out: turnResult.metadata.tokensOut,
      is_complete: isComplete,
    };
    if (process.env.NODE_ENV !== 'production') {
      // console.info('[INSTRUMENTATION_EVENT]', JSON.stringify(logMetadata));
    }

    return NextResponse.json({
      all_facts: updatedExisting,
      new_facts: newlyAdded,
      target: currentTarget,
      reflection: turnResult.reflection,
      coverage_slots: coverage.slots,
      next_question: sanitizeText(turnResult.next_question),
      ui_spec: turnResult.ui_spec,
      is_complete: isComplete,
      safety: Boolean(turnResult.safety),
      metadata: turnResult.metadata,
    });
  } catch (err: any) {
    console.error('Onboarding route unhandled error:', err?.message || err);
    // Graceful fallback to static question without losing user session
    const fallback = FALLBACK_QUESTIONS[currentTarget] || FALLBACK_QUESTIONS.project;
    return NextResponse.json({
      all_facts: factsSoFar,
      new_facts: [],
      target: currentTarget,
      reflection: undefined,
      next_question: sanitizeText(fallback.next_question),
      ui_spec: fallback.ui_spec,
      is_complete: false,
      metadata: {
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        model: 'fallback',
        retried: false,
        fallbackUsed: true,
      },
    });
  }
}
