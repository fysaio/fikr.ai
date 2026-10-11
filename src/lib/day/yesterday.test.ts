import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYesterday, hoursMinutes, count } from './yesterday.ts';

const now = new Date(2026, 9, 9, 8, 0);
const y = (h: number) => new Date(2026, 9, 8, h, 0).toISOString();
const base = { now, tasks: [], done: {}, doneAt: {}, focus: [], days: [], open: [] };

test('empty yesterday is intro and close only', () => {
  assert.deepEqual(buildYesterday(base).map((c) => c.kind), ['intro', 'close']);
});
test('done, focus, people and open build cards in order', () => {
  const cards = buildYesterday({
    ...base,
    tasks: [{ id: 1, title: 'Call Mum', kind: 'follow', contact_name: 'Mum' }, { id: 2, title: 'Today thing' }],
    done: { 1: true, 2: true }, doneAt: { 1: y(10), 2: new Date(2026, 9, 9, 7).toISOString() },
    focus: [{ taskId: '3', title: 'Reading', minutes: 45, at: y(9) }, { taskId: '4', title: 'Proposal', minutes: 25, at: y(11) }],
    open: [{ id: 5, title: 'Reply to Aisha', kind: 'follow', contact_name: 'Aisha', at: '12:00' }],
  });
  assert.deepEqual(cards.map((c) => c.kind), ['intro', 'done', 'focus', 'people', 'open', 'close']);
  const done = cards[1]; assert.equal(done.kind === 'done' && done.items.length, 1);
  const f = cards[2]; assert.ok(f.kind === 'focus' && f.total === '1h10' && f.line.includes('All before noon'));
  const p = cards[3]; assert.ok(p.kind === 'people' && p.names[0] === 'Mum' && p.waiting[0] === 'Aisha');
});
test('formatting', () => { assert.equal(hoursMinutes(70), '1h10'); assert.equal(hoursMinutes(25), '25'); assert.equal(count(2), 'Two'); });
