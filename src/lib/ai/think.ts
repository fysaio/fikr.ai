import { callAI } from './provider';
import { PRODUCT_NAME } from '@/config/flags';
import { THINK_SYSTEM_PROMPT } from '@/config/prompts';
import { sanitizeText } from '@/config/onboarding-prompts';
import { FactCategory } from '@/lib/models/schema';

export type ThinkIntent = 'heard' | 'understand' | 'decide' | 'remember' | 'act' | 'unclear';

export interface ThinkTurnOutput {
  intent: ThinkIntent;
  reply: string;
  outcome_line?: string;
  ui?: {
    type: 'none' | 'choice' | 'chips';
    options: string[];
  };
  safety?: boolean;
}

export interface ExtractedThinkFact {
  id: string;
  category: FactCategory;
  text: string;
  entity?: string | null;
  confidence: 'stated';
  source: string;
  evidence: string;
}

export interface ThinkTurnResult {
  intent: ThinkIntent;
  reply: string;
  outcome_line: string;
  ui?: {
    type: 'none' | 'choice' | 'chips';
    options: string[];
  };
  extracted_facts: ExtractedThinkFact[];
  metadata: {
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
  };
}

const THINK_EXTRACT_PROMPT = `You extract new facts from a user's thought inside ${PRODUCT_NAME}.
OUTPUT valid JSON only: { "facts": [{ "category": "people|projects|goals|commitments|prefs|history|patterns", "entity": "string or null", "text": "clean one-sentence fact in first person", "evidence": "exact quote from message" }] }
RULES:
1. Max 2 facts per message. Be conservative: if nothing concrete was stated, return an empty array.
2. Confidence is always stated.
3. Never turn a thought into a task.
4. Moods, passing rants, and transient feelings are NOT facts.
5. Do not use em dashes or en dashes.`;

export async function runThinkTurn(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
  contextFacts: Array<{ id: string; category: string; text: string }>,
  nowIso = new Date().toISOString()
): Promise<ThinkTurnResult> {
  const cleanMessage = sanitizeText(message);

  const contextStr = contextFacts.length > 0
    ? contextFacts.slice(0, 15).map(f => `[${f.category}] ${f.text}`).join('\n')
    : 'No prior facts.';

  const historyStr = history.slice(-6).map(h => `${h.role === 'user' ? 'USER' : 'ASSISTANT'}: ${h.text}`).join('\n');

  const thinkUserPrompt = `NOW: ${nowIso}
CONTEXT:
${contextStr}

CONVERSATION HISTORY:
${historyStr}

MESSAGE:
"${cleanMessage}"`;

  // Main Think turn: Intent classification and response
  const mainResult = await callAI<ThinkTurnOutput>([
    { role: 'system', content: THINK_SYSTEM_PROMPT },
    { role: 'user', content: thinkUserPrompt },
  ], {
    temperature: 0.5,
    maxTokens: 500,
    timeoutMs: 15000,
    responseFormat: 'json_object',
    endpoint: 'think',
  });

  const parsed = mainResult.data || {
    intent: 'heard',
    reply: cleanMessage ? "I hear you." : "What's on your mind?",
    outcome_line: 'Held in your thoughts.',
  };

  // Background extraction call
  let extractedFacts: ExtractedThinkFact[] = [];
  try {
    const extractResult = await callAI<{ facts: Array<{ category: FactCategory; entity?: string | null; text: string; evidence: string }> }>([
      { role: 'system', content: THINK_EXTRACT_PROMPT },
      { role: 'user', content: `MESSAGE: "${cleanMessage}"` },
    ], {
      temperature: 0.1,
      maxTokens: 300,
      timeoutMs: 10000,
      responseFormat: 'json_object',
      endpoint: 'think_extract',
    });

    if (extractResult.data?.facts && Array.isArray(extractResult.data.facts)) {
      extractedFacts = extractResult.data.facts.map((f, i) => ({
        id: `thk_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        category: f.category || 'prefs',
        text: sanitizeText(f.text),
        entity: f.entity ? sanitizeText(f.entity) : null,
        confidence: 'stated' as const,
        source: 'Think',
        evidence: sanitizeText(f.evidence) || cleanMessage,
      })).filter(f => f.text.length > 3);
    }
  } catch (extractErr) {
    console.warn('Think background extraction skipped or failed:', extractErr);
  }

  return {
    intent: parsed.intent || 'heard',
    reply: sanitizeText(parsed.reply) || "I hear you.",
    outcome_line: sanitizeText(parsed.outcome_line || '') || 'Held in your thoughts.',
    ui: parsed.ui,
    extracted_facts: extractedFacts,
    metadata: {
      latencyMs: mainResult.metadata.latencyMs,
      tokensIn: mainResult.metadata.tokensIn,
      tokensOut: mainResult.metadata.tokensOut,
    },
  };
}
