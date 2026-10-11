import OpenAI from 'openai';
import { ProviderError, type ProviderConfig, type Transport, type TransportRequest } from './types.ts';

/**
 * Provider chain: primary (Groq by default), followed by optional fallbacks (e.g. additional Groq accounts,
 * or Gemini's OpenAI-compatible endpoint). Both speak OpenAI-compatible protocol, so one transport serves all.
 */
export function loadProviders(env: Record<string, string | undefined> = process.env): ProviderConfig[] {
  const out: ProviderConfig[] = [];
  const defaultGroq = 'https://api.groq.com/openai/v1';

  // 1. Primary provider
  const key = env.LLM_API_KEY;
  if (key && key !== 'placeholder-llm-key') {
    out.push({
      name: 'primary',
      baseURL: env.LLM_BASE_URL || defaultGroq,
      apiKey: key,
      model: env.LLM_MODEL || 'llama-3.3-70b-versatile',
    });
  }

  // 2. Fallback 1 (LLM_FALLBACK_API_KEY, LLM_FALLBACK_1_API_KEY, or GEMINI_API_KEY)
  const fbKey1 = env.LLM_FALLBACK_API_KEY || env.LLM_FALLBACK_1_API_KEY || env.GEMINI_API_KEY;
  if (fbKey1 && fbKey1 !== 'placeholder-llm-key') {
    const isGeminiOnly = Boolean(env.GEMINI_API_KEY && !env.LLM_FALLBACK_API_KEY && !env.LLM_FALLBACK_1_API_KEY);
    const defaultUrl = isGeminiOnly
      ? 'https://generativelanguage.googleapis.com/v1beta/openai'
      : (env.LLM_BASE_URL || defaultGroq);
    const defaultModel = isGeminiOnly ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile';

    out.push({
      name: 'fallback',
      baseURL: env.LLM_FALLBACK_BASE_URL || env.LLM_FALLBACK_1_BASE_URL || defaultUrl,
      apiKey: fbKey1,
      model: env.LLM_FALLBACK_MODEL || env.LLM_FALLBACK_1_MODEL || defaultModel,
    });
  }

  // 3. Fallback 2 (LLM_FALLBACK_2_API_KEY)
  const fbKey2 = env.LLM_FALLBACK_2_API_KEY;
  if (fbKey2 && fbKey2 !== 'placeholder-llm-key') {
    out.push({
      name: 'fallback_2',
      baseURL: env.LLM_FALLBACK_2_BASE_URL || env.LLM_BASE_URL || defaultGroq,
      apiKey: fbKey2,
      model: env.LLM_FALLBACK_2_MODEL || 'llama-3.1-8b-instant',
    });
  }

  // 4. Any additional fallbacks (LLM_FALLBACK_3_API_KEY ... LLM_FALLBACK_5_API_KEY)
  for (let i = 3; i <= 5; i++) {
    const k = env[`LLM_FALLBACK_${i}_API_KEY`];
    if (k && k !== 'placeholder-llm-key') {
      out.push({
        name: `fallback_${i}`,
        baseURL: env[`LLM_FALLBACK_${i}_BASE_URL`] || env.LLM_BASE_URL || defaultGroq,
        apiKey: k,
        model: env[`LLM_FALLBACK_${i}_MODEL`] || 'llama-3.1-8b-instant',
      });
    }
  }

  return out;
}

/** gpt-oss models (Groq: openai/gpt-oss-120b) think before they answer, and that thinking counts against the limit. */
export const isReasoningModel = (model: string): boolean => /(^|\/)gpt-oss/i.test(model);

/** Extra tokens a reasoning model may spend thinking, on top of the answer budget a task asks for. */
export const REASONING_HEADROOM = 800;

type Effort = 'low' | 'medium' | 'high';
const effortFrom = (v: string | undefined): Effort => (v === 'medium' || v === 'high' ? v : 'low');

/**
 * Builds the request body. Plain chat models get `max_tokens` as before. Reasoning models get
 * `max_completion_tokens` with headroom for thinking and a low reasoning effort (replies are short, speed matters),
 * so the JSON is not cut off mid-object and the reply comes back empty.
 */
export function buildCompletionParams(req: TransportRequest, env: Record<string, string | undefined> = process.env) {
  const base = {
    model: req.provider.model,
    messages: req.messages,
    temperature: req.temperature,
    ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
  };
  if (isReasoningModel(req.provider.model)) {
    return { ...base, max_completion_tokens: req.maxTokens + REASONING_HEADROOM, reasoning_effort: effortFrom(env.LLM_REASONING) };
  }
  // Gemini 2.5 Flash thinks by default and thinking tokens count against max_tokens. With our small output caps
  // that can leave no room for the JSON, so the fallback fails every call and still bills. Turn thinking off.
  // LLM_FALLBACK_REASONING overrides it ('low', 'medium', 'high'); set it empty to send nothing.
  if (/gemini-2\.5-flash/i.test(req.provider.model)) {
    const effort = env.LLM_FALLBACK_REASONING ?? 'none';
    // 'none' is accepted by Gemini's OpenAI-compatible endpoint but is not in the SDK's type, hence the cast.
    return { ...base, max_tokens: req.maxTokens, ...(effort ? { reasoning_effort: effort as 'low' } : {}) };
  }
  return { ...base, max_tokens: req.maxTokens };
}

const clients = new Map<string, OpenAI>();
function clientFor(p: ProviderConfig): OpenAI {
  const k = `${p.baseURL}|${p.apiKey.slice(-6)}`;
  let c = clients.get(k);
  if (!c) { c = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey, maxRetries: 0 }); clients.set(k, c); }
  return c;
}

export const openAITransport: Transport = async (req) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const resp = await clientFor(req.provider).chat.completions.create(buildCompletionParams(req), { signal: controller.signal });
    const text = resp.choices[0]?.message?.content ?? '';
    // Prompt tokens the provider served from its own prefix cache, when it says so. Lets us see if a static prompt pays off.
    const cachedIn = (resp.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)?.prompt_tokens_details?.cached_tokens ?? 0;
    return { text, cachedIn, tokensIn: resp.usage?.prompt_tokens ?? 0, tokensOut: resp.usage?.completion_tokens ?? 0 };
  } catch (err: unknown) {
    const e = err as { status?: number; name?: string; message?: string };
    if (e?.name === 'AbortError') throw new ProviderError('timeout', { retryable: true });
    const status = e?.status;
    // 400 from json mode is a model-output problem, not an outage. Other 4xx (auth) will not heal on retry.
    throw new ProviderError(e?.message || 'provider error', { status, retryable: !status || status === 429 || status >= 500 });
  } finally {
    clearTimeout(timer);
  }
};

export function extractJSON(text: string): unknown {
  if (!text) throw new Error('empty');
  try { return JSON.parse(text); } catch { /* fall through */ }
  const unfenced = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  try { return JSON.parse(unfenced); } catch { /* fall through */ }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a !== -1 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error('no json');
}
