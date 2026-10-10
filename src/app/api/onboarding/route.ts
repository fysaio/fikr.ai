import { NextResponse } from 'next/server';
import { runOnboardingTurn } from '@/lib/ai/onboarding';
import {
  FALLBACK_QUESTIONS,
  sanitizeText,
} from '@/config/onboarding-prompts';
import { OnboardingFact, TargetSlot } from '@/lib/onboarding/types';
import { processNewFacts } from '@/lib/onboarding/dedupe';
import { calculateCoverage } from '@/lib/onboarding/coverage';

export const dynamic = 'force-dynamic';

// In-memory rate limiting: 30 requests per minute per client
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 30) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(req: Request) {
  let currentTarget: TargetSlot = 'project';
  const nowIso = new Date().toISOString();

  // Rate limiting check
  const forwarded = req.headers.get('x-forwarded-for') || 'local_user';
  const clientIp = forwarded.split(',')[0].trim();
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment before trying again.' },
      { status: 429 }
    );
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

    // SINGLE MODEL CALL per turn
    const turnResult = await runOnboardingTurn(history, existingFactsList, nowIso);

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
      metadata: turnResult.metadata,
    });
  } catch (err: any) {
    console.error('Onboarding route unhandled error:', err?.message || err);
    // Graceful fallback to static question without losing user session
    const fallback = FALLBACK_QUESTIONS[currentTarget] || FALLBACK_QUESTIONS.project;
    return NextResponse.json({
      all_facts: [],
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
