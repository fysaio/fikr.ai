import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompletionParams, isReasoningModel, REASONING_HEADROOM, extractJSON } from './providers.ts';
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
