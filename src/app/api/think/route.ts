import { NextResponse } from 'next/server';
import { runThinkTurn } from '@/lib/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { message, history, context_facts } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const historyList = Array.isArray(history) ? history : [];
    const contextList = Array.isArray(context_facts) ? context_facts : [];

    const result = await runThinkTurn(message, historyList, contextList);

    // Instrumentation (event payload contains metadata, no raw user content per Section 11)
    const logMetadata = {
      event: 'think_entry_processed',
      intent: result.intent,
      latency_ms: result.metadata.latencyMs,
      tokens_in: result.metadata.tokensIn,
      tokens_out: result.metadata.tokensOut,
      extracted_facts_count: result.extracted_facts.length,
    };
    console.log('[INSTRUMENTATION_EVENT]', JSON.stringify(logMetadata));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Think API route error:', err);
    return NextResponse.json(
      {
        intent: 'heard',
        reply: "I hear you.",
        outcome_line: 'Held in your thoughts.',
        extracted_facts: [],
      },
      { status: 500 }
    );
  }
}
