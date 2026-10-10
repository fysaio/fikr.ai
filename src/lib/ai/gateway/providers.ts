import OpenAI from 'openai';
import { ProviderError, type ProviderConfig, type Transport } from './types.ts';

/**
 * Provider chain: primary (Groq by default), then fallback (Gemini's OpenAI-compatible endpoint).
 * Both speak the same protocol, so one transport serves both.
 */
export function loadProviders(env: Record<string, string | undefined> = process.env): ProviderConfig[] {
  const out: ProviderConfig[] = [];
  const key = env.LLM_API_KEY;
  if (key && key !== 'placeholder-llm-key') {
    out.push({
      name: 'primary',
      baseURL: env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
      apiKey: key,
      model: env.LLM_MODEL || 'llama-3.3-70b-versatile',
    });
  }
  const fbKey = env.LLM_FALLBACK_API_KEY || env.GEMINI_API_KEY;
  if (fbKey) {
    out.push({
      name: 'fallback',
      baseURL: env.LLM_FALLBACK_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: fbKey,
      model: env.LLM_FALLBACK_MODEL || 'gemini-2.5-flash',
    });
  }
  return out;
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
    const resp = await clientFor(req.provider).chat.completions.create(
      {
        model: req.provider.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
      },
      { signal: controller.signal }
    );
    const text = resp.choices[0]?.message?.content ?? '';
    return { text, tokensIn: resp.usage?.prompt_tokens ?? 0, tokensOut: resp.usage?.completion_tokens ?? 0 };
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
