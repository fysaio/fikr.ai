import OpenAI from 'openai';
import { clean } from '@/lib/sanitizer';
import { recordCallMetric } from './metrics';

export interface AIModelOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: 'json_object' | 'text';
  endpoint?: string;
}

export interface AICallResult<T> {
  success: boolean;
  data: T | null;
  rawText?: string;
  error?: string;
  metadata: {
    model: string;
    latencyMs: number;
    tokensIn: number;
    tokensOut: number;
    retried: boolean;
  };
}

let clientInstance: OpenAI | null = null;

export function getAIClient(): OpenAI {
  if (clientInstance) return clientInstance;

  const baseURL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey || apiKey === 'placeholder-llm-key') {
    throw new Error('LLM_API_KEY is not configured.');
  }

  clientInstance = new OpenAI({
    baseURL,
    apiKey,
  });

  return clientInstance;
}

export function getAIModelName(): string {
  return process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
}

/**
 * Robust JSON extraction helper
 */
export function extractJSON<T = any>(text: string): T {
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

  throw new Error('Unable to extract valid JSON from model response');
}

/**
 * Execute chat completion with retries and instrumentation metrics
 */
export async function callAI<T = any>(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: AIModelOptions = {}
): Promise<AICallResult<T>> {
  const model = getAIModelName();
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 1200;
  const timeoutMs = options.timeoutMs ?? 15000;
  const isJson = options.responseFormat === 'json_object' || options.responseFormat === undefined;

  const start = Date.now();
  let tokensIn = 0;
  let tokensOut = 0;
  let retried = false;

  const client = getAIClient();

  const makeAttempt = async (temp: number, strictJson: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages,
          temperature: temp,
          max_tokens: maxTokens,
          ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
        },
        { signal: controller.signal }
      );
      clearTimeout(timer);

      tokensIn += completion.usage?.prompt_tokens ?? 0;
      tokensOut += completion.usage?.completion_tokens ?? 0;

      return completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  const finalize = (res: AICallResult<T>): AICallResult<T> => {
    recordCallMetric({
      endpoint: options.endpoint || 'general',
      model: res.metadata.model,
      tokensIn: res.metadata.tokensIn,
      tokensOut: res.metadata.tokensOut,
      latencyMs: res.metadata.latencyMs,
      success: res.success,
      retried: res.metadata.retried,
    });
    return res;
  };

  let rawContent: string | null = null;
  try {
    rawContent = await makeAttempt(temperature, isJson);
  } catch (err: any) {
    // Retry once at lower temperature without strict format enforcement
    retried = true;
    try {
      rawContent = await makeAttempt(0.0, false);
    } catch (retryErr: any) {
      return finalize({
        success: false,
        data: null,
        error: retryErr?.message || err?.message || 'AI request failed after retry',
        metadata: {
          model,
          latencyMs: Date.now() - start,
          tokensIn,
          tokensOut,
          retried: true,
        },
      });
    }
  }

  if (!rawContent) {
    return finalize({
      success: false,
      data: null,
      error: 'Empty response returned by AI model',
      metadata: {
        model,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        retried,
      },
    });
  }

  if (!isJson) {
    return finalize({
      success: true,
      data: clean(rawContent) as unknown as T,
      rawText: rawContent,
      metadata: {
        model,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        retried,
      },
    });
  }

  try {
    const parsed = extractJSON<T>(rawContent);
    return finalize({
      success: true,
      data: parsed,
      rawText: rawContent,
      metadata: {
        model,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        retried,
      },
    });
  } catch (parseErr: any) {
    // Retry once if JSON was malformed
    retried = true;
    try {
      const retryContent = await makeAttempt(0.0, false);
      if (retryContent) {
        const parsedRetry = extractJSON<T>(retryContent);
        return finalize({
          success: true,
          data: parsedRetry,
          rawText: retryContent,
          metadata: {
            model,
            latencyMs: Date.now() - start,
            tokensIn,
            tokensOut,
            retried: true,
          },
        });
      }
    } catch (retryParseErr: any) {
      // Return parse failure
    }

    return finalize({
      success: false,
      data: null,
      rawText: rawContent,
      error: `JSON parse error: ${parseErr?.message}`,
      metadata: {
        model,
        latencyMs: Date.now() - start,
        tokensIn,
        tokensOut,
        retried,
      },
    });
  }
}
