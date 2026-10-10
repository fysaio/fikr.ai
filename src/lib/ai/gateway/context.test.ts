import test from 'node:test';
import assert from 'node:assert/strict';
import { compactFacts, factsDigest, recentTurns } from './context.ts';
import { estimateTokens } from './text.ts';

test('history is trimmed to the last 3 turns and clipped', () => {
  const h = Array.from({ length: 10 }, (_, i) => ({ q: `q${i}`, a: 'x'.repeat(2000) }));
  const t = recentTurns(h);
  assert.equal(t.length, 3); assert.equal(t[0].q, 'q7'); assert.ok(t[0].a.length <= 500);
});

test('compact facts use far fewer tokens than JSON', () => {
  const facts = Array.from({ length: 15 }, (_, i) => ({ id: `f${i}`, category: 'projects', entity: 'Defence', value: 'My project defence is on Sunday and slides are unfinished', due_text: 'on Sunday' }));
  const json = JSON.stringify(facts.map((f) => ({ id: f.id, category: f.category, entity: f.entity, value: f.value, due_text: f.due_text })));
  assert.ok(estimateTokens(compactFacts(facts)) < estimateTokens(json) * 0.8);
});

test('digest changes when facts change', () => {
  const a = [{ id: '1', category: 'p', value: 'a' }]; const b = [{ id: '1', category: 'p', value: 'b' }];
  assert.notEqual(factsDigest(a), factsDigest(b));
  assert.equal(factsDigest(a), factsDigest([...a]));
});
