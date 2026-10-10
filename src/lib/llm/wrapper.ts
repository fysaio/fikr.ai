import { getLLMClient, getLLMModel } from './client';
import { clean } from '@/lib/sanitizer';

export type ModelCallType = 'EXTRACTOR' | 'GUIDE' | 'THINK' | 'TODAY_SUGGEST' | 'PHRASE';

export interface ModelCallConfig {
  type: ModelCallType;
  temperature: number;
  maxTokens?: number;
}

export const CALL_CONFIGS: Record<ModelCallType, ModelCallConfig> = {
  EXTRACTOR: { type: 'EXTRACTOR', temperature: 0.1, maxTokens: 1200 },
  GUIDE: { type: 'GUIDE', temperature: 0.6, maxTokens: 800 },
  THINK: { type: 'THINK', temperature: 0.6, maxTokens: 900 },
  TODAY_SUGGEST: { type: 'TODAY_SUGGEST', temperature: 0.4, maxTokens: 300 },
  PHRASE: { type: 'PHRASE', temperature: 0.4, maxTokens: 300 },
};

export interface WrappedCallResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  metadata: {
    callType: ModelCallType;
    model: string;
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    retried: boolean;
  };
}

function sanitizeObjectStrings(obj: any): any {
  if (typeof obj === 'string') {
    return clean(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectStrings);
  }
  if (obj !== null && typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = sanitizeObjectStrings(obj[key]);
    }
    return res;
  }
  return obj;
}

function extractJSON(text: string): any {
  if (!text) throw new Error('Empty model output');
  try {
    return JSON.parse(text);
  } catch {}

  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const substr = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(substr);
    } catch {}
  }

  throw new Error('Unable to extract valid JSON from model output');
}

/**
 * Universal Model Wrapper (Section 4.8)
 * Handles timeout, temperature 0 retry on invalid JSON, token/latency logging, and text sanitization.
 */
export async function callModel<T = any>(
  callType: ModelCallType,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 15000
): Promise<WrappedCallResult<T>> {
  const start = Date.now();
  const cfg = CALL_CONFIGS[callType];
  const openai = getLLMClient();
  const model = getLLMModel();

  let tokensIn = 0;
  let tokensOut = 0;
  let retried = false;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const exec = async (temperature: number, strictJson: boolean): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await openai.chat.completions.create(
        {
          model,
          messages,
          temperature,
          max_tokens: cfg.maxTokens || 1000,
          ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
        },
        { signal: controller.signal }
      );
      clearTimeout(timer);

      tokensIn += resp.usage?.prompt_tokens ?? 0;
      tokensOut += resp.usage?.completion_tokens ?? 0;

      return resp.choices[0]?.message?.content ?? null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    let rawContent: string | null = null;
    try {
      rawContent = await exec(cfg.temperature, true);
    } catch {
      // If strict mode rejected, retry at temperature 0 without strict format
      retried = true;
      rawContent = await exec(0, false);
    }

    if (!rawContent) throw new Error('No content returned from model');

    let parsed: any;
    try {
      parsed = extractJSON(rawContent);
    } catch {
      // Invalid JSON: retry once at temperature 0
      retried = true;
      const retryContent = await exec(0, false);
      if (!retryContent) throw new Error('No content on retry');
      parsed = extractJSON(retryContent);
    }

    const sanitizedData = sanitizeObjectStrings(parsed) as T;

    return {
      success: true,
      data: sanitizedData,
      metadata: {
        callType,
        model,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        retried,
      },
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    console.warn(`[ModelWrapperError][${callType}]`, err?.message);

    return {
      success: false,
      data: null,
      error: err?.message || 'Model call failed',
      metadata: {
        callType,
        model,
        latencyMs,
        tokensIn,
        tokensOut,
        retried,
      },
    };
  }
}
