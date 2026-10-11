import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { configureGateway, getDefaultDeps, runTask, type GatewayDeps } from './gateway.ts';
import { LayeredCache, MemoryCache } from './cache.ts';
import { MemoryBudget } from './budget.ts';
import { ProviderError, type TaskDef, type TransportRequest } from './types.ts';
import { looksLikeCrisis, stripDashes, isTrivialAck } from './text.ts';

const task: TaskDef<{ q: string }, { a: string }> = {
  id: 't', version: '1', system: 'SYS', temperature: 0.2, maxOutTokens: 100, timeoutMs: 1000,
  inputSchema: z.object({ q: z.string().max(50) }),
  outputSchema: z.object({ a: z.string() }),
  buildUser: (i) => `Q: ${i.q}`,
  cache: { ttlSec: 60, scope: 'user', keyOf: (i) => i.q.toLowerCase() },
  shortcut: (i) => (i.q === 'ping' ? { a: 'pong' } : null),
  fallback: () => ({ a: 'fixed' }),
  userText: (i) => i.q,
  safe: () => ({ a: 'care' }),
  repair: true,
};

function deps(over: Partial<GatewayDeps> & { responses?: Array<string | Error> } = {}) {
  const calls: TransportRequest[] = [];
  const queue = [...(over.responses ?? ['{"a":"ok"}'])];
  const d: GatewayDeps = {
    providers: [
      { name: 'primary', baseURL: 'x', apiKey: 'k', model: 'm1' },
      { name: 'fallback', baseURL: 'y', apiKey: 'k', model: 'm2' },
    ],
    transport: async (req) => {
      calls.push(req);
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      if (next instanceof Error) throw next;
      return { text: next, tokensIn: 50, tokensOut: 10 };
    },
    cache: new LayeredCache(new MemoryCache(), null),
    budget: null,
    now: () => new Date('2026-10-10T10:00:00Z'),
    cap: 1000,
    ...over,
  };
  return { d, calls };
}

test('rule shortcut costs zero model calls', async () => {
  const { d, calls } = deps();
  const r = await runTask(task, { q: 'ping' }, { userId: 'u' }, d);
  assert.equal(r.source, 'rule'); assert.equal(calls.length, 0);
});

test('safety gate skips the model', async () => {
  const { d, calls } = deps();
  const r = await runTask(task, { q: 'i want to die' }, { userId: 'u' }, d);
  assert.equal(r.data.a, 'care'); assert.equal(r.reason, 'safety'); assert.equal(calls.length, 0);
});

test('safety gate wins over a rule shortcut that also matches', async () => {
  const { d, calls } = deps();
  // A shortcut that would answer anything containing "overwhelmed", like onboarding's venting branch.
  const venting: typeof task = { ...task, shortcut: (i) => (/overwhelmed/i.test(i.q) ? { a: 'vent-card' } : null) };
  const r = await runTask(venting, { q: 'overwhelmed and i want to die' }, { userId: 'u' }, d);
  assert.equal(r.data.a, 'care'); assert.equal(r.reason, 'safety'); assert.equal(calls.length, 0);
  const ok = await runTask(venting, { q: 'so overwhelmed today' }, { userId: 'u' }, d);
  assert.equal(ok.data.a, 'vent-card'); assert.equal(ok.source, 'rule');
});

test('second identical call is a cache hit; other users do not share', async () => {
  const { d, calls } = deps();
  const a = await runTask(task, { q: 'Hello' }, { userId: 'u1' }, d);
  const b = await runTask(task, { q: 'hello' }, { userId: 'u1' }, d);
  const c = await runTask(task, { q: 'hello' }, { userId: 'u2' }, d);
  assert.deepEqual([a.source, b.source, c.source], ['model', 'cache', 'model']);
  assert.equal(calls.length, 2);
});

test('concurrent identical calls make one model call', async () => {
  const { d, calls } = deps();
  const rs = await Promise.all([1, 2, 3].map(() => runTask(task, { q: 'same' }, { userId: 'u' }, d)));
  assert.equal(calls.length, 1); assert.equal(rs.length, 3);
});

test('prompt prefix is identical across users (provider-side caching stays possible)', async () => {
  const { d, calls } = deps();
  await runTask(task, { q: 'a' }, { userId: 'u1' }, d);
  await runTask(task, { q: 'b' }, { userId: 'u2' }, d);
  assert.equal(calls[0].messages[0].content, calls[1].messages[0].content);
});

test('invalid JSON gets one repair, then succeeds', async () => {
  const { d, calls } = deps({ responses: ['nope', '{"a":"fixed it"}'] });
  const r = await runTask(task, { q: 'x' }, { userId: 'u' }, d);
  assert.equal(r.source, 'model'); assert.equal(r.usage.retried, true); assert.equal(calls.length, 2);
});

test('primary 500 falls through to the fallback provider', async () => {
  const { d, calls } = deps({ responses: [new ProviderError('boom', { status: 500 }), '{"a":"from gemini"}'] });
  const r = await runTask(task, { q: 'x' }, { userId: 'u' }, d);
  assert.equal(r.data.a, 'from gemini'); assert.equal(r.usage.provider, 'fallback'); assert.equal(calls[1].provider.name, 'fallback');
});

test('all providers down returns fixed copy, never throws', async () => {
  const { d } = deps({ responses: [new ProviderError('down', { status: 503 })] });
  const r = await runTask(task, { q: 'x' }, { userId: 'u' }, d);
  assert.equal(r.source, 'fallback'); assert.equal(r.data.a, 'fixed');
});

test('daily budget stops spend and serves fallback', async () => {
  const budget = new MemoryBudget();
  const { d, calls } = deps({ budget, cap: 150 });
  const first = await runTask(task, { q: 'one' }, { userId: 'u' }, d);
  const second = await runTask(task, { q: 'two' }, { userId: 'u' }, d);
  assert.equal(first.source, 'model'); assert.equal(second.source, 'fallback'); assert.equal(second.reason, 'budget');
  assert.equal(calls.length, 1);
});

test('budget reconciles to real usage after the call', async () => {
  const budget = new MemoryBudget();
  const { d } = deps({ budget, cap: 10_000 });
  await runTask(task, { q: 'one' }, { userId: 'u' }, d);
  assert.equal([...budget.used.values()][0], 60);
});

test('em and en dashes are stripped from model output', async () => {
  const { d } = deps({ responses: ['{"a":"one — two – three"}'] });
  const r = await runTask(task, { q: 'x' }, { userId: 'u' }, d);
  assert.ok(!/[—–]/.test(r.data.a));
});

test('bad input is rejected before anything runs', async () => {
  const { d, calls } = deps();
  await assert.rejects(runTask(task, { q: 'x'.repeat(51) }, { userId: 'u' }, d));
  assert.equal(calls.length, 0);
});

test('helpers', () => {
  assert.equal(stripDashes('a — b'), 'a - b');
  assert.ok(looksLikeCrisis('I want to kill myself'));
  assert.ok(!looksLikeCrisis('this deadline will kill me'));
  assert.ok(isTrivialAck('Thanks!'));
});

test('provider cached-prompt tokens are reported in usage', async () => {
  const { d } = deps();
  d.transport = async () => ({ text: '{"a":"ok"}', tokensIn: 100, tokensOut: 10, cachedIn: 80 });
  const r = await runTask(task, { q: 'cached' }, { userId: 'u' }, d);
  assert.equal(r.usage.cachedIn, 80);
});

test('rule and cache hits are counted so hit rates can be measured', async () => {
  const budget = new MemoryBudget();
  const { d } = deps({ budget, cap: 10_000 });
  await runTask(task, { q: 'ping' }, { userId: 'u' }, d);      // rule
  await runTask(task, { q: 'again' }, { userId: 'u' }, d);     // model
  await runTask(task, { q: 'again' }, { userId: 'u' }, d);     // cache
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(budget.notes.map((n) => n.kind).sort(), ['cache', 'rule']);
});

test('a slow primary cannot push the whole run past the total deadline', async () => {
  const t = { ...task, timeoutMs: 400, totalTimeoutMs: 450, repair: false };
  const seen: number[] = [];
  const { d } = deps();
  d.transport = async (req) => { seen.push(req.timeoutMs); await new Promise((r) => setTimeout(r, 300)); throw new ProviderError('slow', { status: 503 }); };
  const started = Date.now();
  const r = await runTask(t, { q: 'slow' }, { userId: 'u' }, d);
  assert.equal(r.source, 'fallback');
  assert.ok(Date.now() - started < 700, 'must not wait for a second full timeout');
  assert.ok(seen.every((ms) => ms <= 400));
});

void configureGateway; void getDefaultDeps;
