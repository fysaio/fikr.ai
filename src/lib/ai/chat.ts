import { runTask } from './gateway/gateway';
import { ensureGateway } from './gateway/server';
import { chatTask } from './tasks';
import { sanitizeText } from '@/config/onboarding-prompts';
import type { FactCategory } from '@/lib/models/schema';

export type ChatIntent = 'heard' | 'understand' | 'decide' | 'remember' | 'act' | 'unclear';

export interface ChatExtractedFact {
  id: string;
  category: FactCategory;
  text: string;
  entity: string | null;
  confidence: 'stated';
  source: 'chat';
  evidence: string;
}

export interface ChatTurnResult {
  intent: ChatIntent;
  reply: string;
  outcome_line: string;
  ui?: { type: 'none' | 'choice' | 'chips'; options: string[] };
  safety: boolean;
  extracted_facts: ChatExtractedFact[];
  source: 'rule' | 'cache' | 'model' | 'fallback';
  metadata: { latencyMs: number; tokensIn: number; tokensOut: number };
}

/** One model call per turn (reply plus fact extraction). Rules, cache and budget are handled by the gateway. */
export async function runChatTurn(
  userId: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  context: Array<{ id: string; category: string; text: string }>,
  nowIso = new Date().toISOString()
): Promise<ChatTurnResult> {
  ensureGateway();
  const clean = sanitizeText(message);
  const r = await runTask(chatTask, { nowDay: nowIso.slice(0, 10), message: clean, history, context }, { userId });
  const d = r.data;
  return {
    intent: d.intent,
    reply: d.reply,
    outcome_line: d.outcome_line || '',
    ui: d.ui ?? undefined,
    safety: Boolean(d.safety),
    source: r.source,
    extracted_facts: (d.facts ?? []).map((f, i) => ({
      id: `cht_${Date.now()}_${i}`,
      category: f.category as FactCategory,
      text: f.text,
      entity: f.entity ?? null,
      confidence: 'stated' as const,
      source: 'chat' as const,
      evidence: f.evidence || clean.slice(0, 120),
    })),
    metadata: { latencyMs: r.usage.latencyMs, tokensIn: r.usage.tokensIn, tokensOut: r.usage.tokensOut },
  };
}
