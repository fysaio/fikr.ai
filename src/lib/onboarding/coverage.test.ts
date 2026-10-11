import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCoverage } from './coverage.ts';
import type { OnboardingFact } from './types.ts';

let n = 0;
const fact = (over: Partial<OnboardingFact>): OnboardingFact => ({
  id: `f${++n}`, user_id: null, category: 'projects', entity: null, value: '', evidence: '', epistemic_state: 'stated',
  state: null, due_text: null, due_at: null, supersedes_id: null, status: 'active', created_at: '2026-10-11T10:00:00Z', source_turn: 1, ...over,
});
const hist = (k: number) => Array.from({ length: k }, (_, i) => ({ q: `q${i}`, a: `a${i}` }));

const project = fact({ category: 'projects', entity: 'Defence', value: 'My project defence is on Sunday', due_text: 'on Sunday' });
const person = fact({ category: 'people', entity: 'Dr Bello', value: 'Dr Bello is my supervisor and has not replied' });
const week = fact({ category: 'how_i_work', value: 'My week is classes and work' });

test('first question is the project when nothing is known', () => {
  const c = calculateCoverage([], hist(1), 1);
  assert.equal(c.target, 'project'); assert.equal(c.isComplete, false);
});

test('help style and quiet times are never asked: after project, people and week the next step is close', () => {
  const c = calculateCoverage([project, person, week], hist(3), 3);
  assert.equal(c.isComplete, true); assert.equal(c.target, 'close');
  assert.equal(c.slots.help_style, false); assert.equal(c.slots.quiet_times, false);
});

test('target never lands on help_style or quiet_times, whatever is captured', () => {
  const sets = [[], [project], [project, person], [project, person, week], [week], [person]];
  for (const facts of sets) for (const turns of [1, 2, 3, 4, 6]) {
    const t = calculateCoverage(facts, hist(turns), turns).target;
    assert.ok(!['help_style', 'quiet_times'].includes(t), `${facts.length} facts, ${turns} turns -> ${t}`);
  }
});

test('asks for the week shape once project and people are known', () => {
  const c = calculateCoverage([project, person], hist(2), 2);
  assert.equal(c.target, 'week_shape'); assert.equal(c.isComplete, false);
});

test('not complete before 3 turns even when everything is captured', () => {
  const c = calculateCoverage([project, person, week], hist(2), 2);
  assert.equal(c.isComplete, false);
});

test('turn 7 closes onboarding whatever is captured', () => {
  const c = calculateCoverage([], hist(7), 7);
  assert.equal(c.isComplete, true); assert.equal(c.target, 'close');
});

test('readiness reports only what decides completion', () => {
  const c = calculateCoverage([project, week], hist(3), 3);
  assert.deepEqual(Object.keys(c.readinessMet).sort(), ['concreteProjectOrCommitment', 'weekShapeCaptured']);
  assert.equal(c.readinessMet.concreteProjectOrCommitment, true); assert.equal(c.readinessMet.weekShapeCaptured, true);
});
