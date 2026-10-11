import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatContext, reconcileChatFacts, similarity, type MemoryLike } from './chat-facts.ts';

const mem = (id: string, category: string, text: string, extra: Partial<MemoryLike> = {}): MemoryLike => ({ id, category, text, confidence: 'stated', ...extra });

test('similarity is 1 for the same sentence in different punctuation and case', () => {
  assert.equal(similarity('Aisha is my coursemate.', 'aisha is my coursemate'), 1);
  assert.ok(similarity('Defence is on Sunday', 'Sunday is my cooking day') < 0.6);
});

test('a fact the person already has is skipped', () => {
  const r = reconcileChatFacts([{ category: 'people', text: 'Aisha is my coursemate.' }], [mem('m1', 'people', 'Aisha is my coursemate')]);
  assert.deepEqual(r.add, []); assert.equal(r.skipped, 1);
});

test('same sentence in a different category is still new', () => {
  const r = reconcileChatFacts([{ category: 'goals', text: 'Finish the research proposal' }], [mem('m1', 'projects', 'Finish the research proposal')]);
  assert.equal(r.add.length, 1);
});

test('a duplicate inside the same reply is added once', () => {
  const r = reconcileChatFacts(
    [{ category: 'commitments', text: 'Send Zara the notes' }, { category: 'commitments', text: 'send zara the notes.' }],
    [],
  );
  assert.equal(r.add.length, 1); assert.equal(r.skipped, 1);
});

test('a correction replaces the old text instead of adding a second memory', () => {
  const r = reconcileChatFacts(
    [{ category: 'people', text: 'Aisha is my coursemate on the council.', supersedes: 'm1' }],
    [mem('m1', 'people', 'Aisha is a friend from the council')],
  );
  assert.deepEqual(r.add, []);
  assert.deepEqual(r.update, [{ id: 'm1', text: 'Aisha is my coursemate on the council.' }]);
});

test('a correction that changes nothing is a no-op', () => {
  const r = reconcileChatFacts([{ category: 'people', text: 'Aisha is a friend from the council', supersedes: 'm1' }], [mem('m1', 'people', 'Aisha is a friend from the council.')]);
  assert.deepEqual(r.update, []); assert.deepEqual(r.add, []); assert.equal(r.skipped, 1);
});

test('supersedes pointing at nothing real falls back to normal add rules', () => {
  const r = reconcileChatFacts([{ category: 'people', text: 'Zara is my coursemate', supersedes: 'ghost' }], [mem('m1', 'people', 'Aisha is my coursemate')]);
  assert.equal(r.add.length, 1); assert.deepEqual(r.update, []);
});

test('deleted, forgotten and rejected memories do not count as already known', () => {
  const existing = [
    mem('a', 'projects', 'Research proposal due Friday', { status: 'deleted' }),
    mem('b', 'projects', 'Research proposal due Friday', { gone: true }),
    mem('c', 'projects', 'Research proposal due Friday', { rejected: true }),
  ];
  assert.equal(reconcileChatFacts([{ category: 'projects', text: 'Research proposal due Friday' }], existing).add.length, 1);
});

test('too-short facts are dropped', () => {
  assert.equal(reconcileChatFacts([{ category: 'goals', text: 'ok' }], []).add.length, 0);
});

test('context carries confidence, hides dead memories, and puts commitments first', () => {
  const ctx = buildChatContext({
    history: [mem('h1', 'history', 'Moved to Ibadan', { updated_at: '2026-10-01' })],
    commitments: [mem('c1', 'commitments', 'Reply to Aisha today', { updated_at: '2026-10-10' }), mem('c2', 'commitments', 'Old one', { status: 'deleted' })],
    patterns: [mem('p1', 'patterns', 'Does people tasks first', { confidence: 'hypothesized' }), mem('p2', 'patterns', 'Rejected guess', { confidence: 'hypothesized', rejected: true })],
    people: [mem('pe1', 'people', 'Aisha is my coursemate', { confidence: 'weird-value' })],
  });
  assert.deepEqual(ctx.map((c) => c.id), ['c1', 'p1', 'pe1', 'h1']);
  assert.equal(ctx.find((c) => c.id === 'p1')?.confidence, 'hypothesized');
  assert.equal(ctx.find((c) => c.id === 'pe1')?.confidence, 'stated');
});

test('context respects the limit and handles empty life', () => {
  assert.deepEqual(buildChatContext(null), []);
  const many = Array.from({ length: 30 }, (_, i) => mem(`m${i}`, 'goals', `Goal number ${i}`));
  assert.equal(buildChatContext({ goals: many }, 20).length, 20);
});
