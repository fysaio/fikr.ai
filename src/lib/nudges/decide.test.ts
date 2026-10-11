import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, zonedNow, DAILY_CAP, type Candidate, type Context } from './decide.ts';
import { buildCandidates } from './candidates.ts';
import { DEFAULT_SETTINGS } from '../settings/settings.ts';

const at = (h: number, m = 0, d = 12) => new Date(2026, 9, d, h, m); // Monday 12 Oct 2026
const cand = (kind: Candidate['kind'], key: string, priority = 1): Candidate => ({ kind, key, title: 't', body: 'b', url: '/today', priority });
const ctx = (over: Partial<Context> = {}): Context => ({ now: at(11), settings: DEFAULT_SETTINGS, sentToday: 0, lastSentAt: null, timerRunning: false, ignoredRun: {}, sentKeys: new Set(), ...over });

test('sends the highest priority allowed nudge', () => {
  const d = decide([cand('orientation', 'o', 3), cand('people', 'p', 5)], ctx());
  assert.ok('send' in d && d.send.kind === 'people');
});
test('daily cap is two', () => {
  assert.equal(DAILY_CAP, 2);
  assert.deepEqual(decide([cand('people', 'p')], ctx({ sentToday: 2 })), { silence: 'daily cap' });
  assert.ok('send' in decide([cand('people', 'p')], ctx({ sentToday: 1 })));
});
test('quiet times, timer and spacing', () => {
  assert.deepEqual(decide([cand('people', 'p')], ctx({ now: at(23) })), { silence: 'quiet time' });
  assert.deepEqual(decide([cand('people', 'p')], ctx({ timerRunning: true })), { silence: 'timer running' });
  assert.deepEqual(decide([cand('people', 'p')], ctx({ lastSentAt: at(10, 30) })), { silence: 'too soon after the last one' });
  assert.ok('send' in decide([cand('people', 'p')], ctx({ lastSentAt: at(8, 30) })));
});
test('a kind the person turned off never sends', () => {
  const off = { ...DEFAULT_SETTINGS, speak: { ...DEFAULT_SETTINGS.speak, people: false } };
  assert.deepEqual(decide([cand('people', 'p')], ctx({ settings: off })), { silence: 'nothing worth it' });
  assert.deepEqual(decide([cand('reflection', 'r')], ctx()), { silence: 'nothing worth it' }); // off by default
});
test('three ignored in a row stops that kind', () => {
  assert.deepEqual(decide([cand('people', 'p')], ctx({ ignoredRun: { people: 3 } })), { silence: 'nothing worth it' });
  assert.ok('send' in decide([cand('people', 'p'), cand('moment', 'm')], ctx({ ignoredRun: { people: 3 } })));
});
test('the same thing is never sent twice', () => {
  assert.deepEqual(decide([cand('people', 'p')], ctx({ sentKeys: new Set(['p']) })), { silence: 'nothing worth it' });
});
test('zonedNow gives the wall clock in the zone', () => {
  const z = zonedNow(new Date('2026-10-12T22:30:00Z'), 'Africa/Lagos'); // UTC+1
  assert.equal(z.getHours(), 23); assert.equal(z.getDate(), 12);
});

const task = (over: object) => ({ id: 'a', title: 'Reply to Aisha', starts_at: null, status: 'open', why: 'You said you would.', kind: 'follow', contact_name: 'Aisha', hidden_until: null, ...over });
test('candidates: people, moment, orientation follow the rules', () => {
  const now = at(12, 5);
  const c = buildCandidates({ now, local: now, day: '2026-10-12', patterns: [], tasks: [task({ starts_at: at(12).toISOString() }), task({ id: 'b', title: 'Proposal', kind: 'due', contact_name: null, starts_at: at(12, 30).toISOString() })] });
  assert.deepEqual(c.map((x) => x.kind).sort(), ['moment', 'people']);
  assert.equal(c.find((x) => x.kind === 'people')?.title, 'Aisha is waiting on a reply');
  const m = at(8, 0);
  const o = buildCandidates({ now: m, local: m, day: '2026-10-12', patterns: [], tasks: [task({ kind: 'due', contact_name: null, starts_at: at(10, 15).toISOString(), title: 'Research proposal' })] });
  assert.ok(o.some((x) => x.kind === 'orientation' && x.title === 'First up: Research proposal' && x.body.startsWith('At 10:15 AM')));
});
test('candidates: snoozed and done things are skipped, titles carry no counts', () => {
  const now = at(12, 5);
  const c = buildCandidates({ now, local: now, day: 'x', patterns: [], tasks: [task({ starts_at: at(12).toISOString(), hidden_until: at(18).toISOString() }), task({ id: 'z', status: 'done', starts_at: at(12).toISOString() })] });
  assert.equal(c.length, 0);
});
