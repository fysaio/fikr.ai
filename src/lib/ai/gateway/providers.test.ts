import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompletionParams, isReasoningModel, REASONING_HEADROOM, extractJSON, loadProviders, toProviderError } from './providers.ts';
import type { TransportRequest } from './types.ts';

const req = (model: string, json = true): TransportRequest => ({
  provider: { name: 'primary', baseURL: 'x', apiKey: 'k', model },
  messages: [{ role: 'user', content: 'hi' }], temperature: 0.5, maxTokens: 550, timeoutMs: 1000, json,
});

test('recognises reasoning models', () => {
  for (const m of ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'gpt-oss-120b']) assert.equal(isReasoningModel(m), true, m);
  for (const m of ['llama-3.3-70b-versatile', 'gemini-2.5-flash', 'gpt-4o']) assert.equal(isReasoningModel(m), false, m);
});

test('plain chat models keep max_tokens and send no reasoning options', () => {
  const p = buildCompletionParams(req('llama-3.3-70b-versatile'), {}) as Record<string, unknown>;
  assert.equal(p.max_tokens, 550); assert.equal('max_completion_tokens' in p, false); assert.equal('reasoning_effort' in p, false);
  assert.deepEqual(p.response_format, { type: 'json_object' });
});

test('reasoning models get headroom, low effort by default, and no max_tokens', () => {
  const p = buildCompletionParams(req('openai/gpt-oss-120b'), {}) as Record<string, unknown>;
  assert.equal(p.max_completion_tokens, 550 + REASONING_HEADROOM); assert.equal(p.reasoning_effort, 'low'); assert.equal('max_tokens' in p, false);
});

test('LLM_REASONING overrides effort, and junk values fall back to low', () => {
  assert.equal((buildCompletionParams(req('openai/gpt-oss-120b'), { LLM_REASONING: 'high' }) as Record<string, unknown>).reasoning_effort, 'high');
  assert.equal((buildCompletionParams(req('openai/gpt-oss-120b'), { LLM_REASONING: 'extreme' }) as Record<string, unknown>).reasoning_effort, 'low');
});

test('json mode is optional', () => {
  assert.equal('response_format' in buildCompletionParams(req('llama-3.3-70b-versatile', false), {}), false);
});

test('extractJSON reads fenced and padded output', () => {
  assert.deepEqual(extractJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJSON('Sure! {"a":1} done'), { a: 1 });
  assert.throws(() => extractJSON('no json here'));
});

test('Gemini 2.5 Flash is sent with thinking off by default, and the override works', () => {
  const p = buildCompletionParams(req('gemini-2.5-flash'), {}) as Record<string, unknown>;
  assert.equal(p.reasoning_effort, 'none'); assert.equal(p.max_tokens, 550);
  assert.equal((buildCompletionParams(req('gemini-2.5-flash'), { LLM_FALLBACK_REASONING: 'low' }) as Record<string, unknown>).reasoning_effort, 'low');
  assert.equal('reasoning_effort' in buildCompletionParams(req('gemini-2.5-flash'), { LLM_FALLBACK_REASONING: '' }), false);
});

test('loadProviders returns primary and multiple fallbacks with proper Groq defaults', () => {
  const providers = loadProviders({
    LLM_API_KEY: 'key-1',
    LLM_MODEL: 'openai/gpt-oss-120b',
    LLM_FALLBACK_API_KEY: 'key-2',
    LLM_FALLBACK_MODEL: 'llama-3.3-70b-versatile',
    LLM_FALLBACK_2_API_KEY: 'key-3',
    LLM_FALLBACK_2_MODEL: 'llama-3.1-8b-instant',
  });

  assert.equal(providers.length, 3);
  assert.equal(providers[0].name, 'primary');
  assert.equal(providers[0].baseURL, 'https://api.groq.com/openai/v1');
  assert.equal(providers[0].model, 'openai/gpt-oss-120b');
  assert.equal(providers[0].apiKey, 'key-1');

  assert.equal(providers[1].name, 'fallback');
  assert.equal(providers[1].baseURL, 'https://api.groq.com/openai/v1');
  assert.equal(providers[1].model, 'llama-3.3-70b-versatile');
  assert.equal(providers[1].apiKey, 'key-2');

  assert.equal(providers[2].name, 'fallback_2');
  assert.equal(providers[2].baseURL, 'https://api.groq.com/openai/v1');
  assert.equal(providers[2].model, 'llama-3.1-8b-instant');
  assert.equal(providers[2].apiKey, 'key-3');
});

test('loadProviders supports Gemini when only GEMINI_API_KEY is configured', () => {
  const providers = loadProviders({
    LLM_API_KEY: 'key-1',
    GEMINI_API_KEY: 'gemini-key',
  });

  assert.equal(providers.length, 2);
  assert.equal(providers[1].name, 'fallback');
  assert.equal(providers[1].baseURL, 'https://generativelanguage.googleapis.com/v1beta/openai');
  assert.equal(providers[1].model, 'gemini-2.5-flash');
});

test('toProviderError keeps the status and a short code, and drops anything that could carry text', () => {
  const sdk = Object.assign(new Error('400 {"failed_generation":"user words"}'), { status: 400, code: 'json_validate_failed' });
  const a = toProviderError(sdk);
  assert.equal(a.status, 400); assert.equal(a.code, 'json_validate_failed'); assert.equal(a.retryable, false);

  const nested = toProviderError(Object.assign(new Error('x'), { status: 413, error: { code: 'rate_limit_exceeded' } }));
  assert.equal(nested.code, 'rate_limit_exceeded'); assert.equal(nested.retryable, false);

  const sentence = toProviderError(Object.assign(new Error('x'), { status: 400, code: 'this is a whole sentence with spaces' }));
  assert.equal(sentence.code, undefined);

  const net = toProviderError(Object.assign(new Error('socket hang up'), { name: 'APIConnectionError' }));
  assert.equal(net.status, undefined); assert.equal(net.code, 'APIConnectionError'); assert.equal(net.retryable, true);

  const abort = toProviderError(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  assert.equal(abort.code, 'timeout'); assert.equal(abort.retryable, true);

  assert.equal(toProviderError(Object.assign(new Error('busy'), { status: 429 })).retryable, true);
  assert.equal(toProviderError(Object.assign(new Error('down'), { status: 503 })).retryable, true);
});
