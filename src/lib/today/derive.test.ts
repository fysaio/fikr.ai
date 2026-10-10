import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt12, mmss, snoozeUntil, soonTask, telLink, visibleTasks, waDigits, waLink, isEvening } from './derive.ts';

const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m);

test('12-hour times', () => {
  assert.equal(fmt12('10:15'), '10:15 AM'); assert.equal(fmt12('15:30'), '3:30 PM');
  assert.equal(fmt12('00:05'), '12:05 AM'); assert.equal(fmt12('12:00'), '12:00 PM'); assert.equal(fmt12('nope'), 'nope');
});

test('whatsapp and call links use digits only, never invent a number', () => {
  assert.equal(waLink('+234 801 234 5678'), 'https://wa.me/2348012345678');
  assert.equal(waDigits('08012345678'), '2348012345678');
  assert.equal(telLink('+2348012345678'), 'tel:+2348012345678');
  assert.equal(waLink(''), null); assert.equal(waLink('123'), null); assert.equal(waLink(undefined), null);
});

test('visible tasks hide done and snoozed, sorted by time', () => {
  const now = at(9);
  const tasks = [
    { id: 1, title: 'late', at: '19:00' }, { id: 2, title: 'early', at: '10:15' }, { id: 3, title: 'done', at: '08:00', status: 'done' as const },
    { id: 4, title: 'snoozed', at: '11:00', hidden_until: at(18).toISOString() }, { id: 5, title: 'tapped done', at: '12:00' }, { id: 6, title: 'untimed' },
  ];
  assert.deepEqual(visibleTasks(tasks, { 5: true }, now).map((t) => t.title), ['early', 'late', 'untimed']);
  assert.ok(visibleTasks(tasks, {}, at(18, 1)).some((t) => t.title === 'snoozed'));
});

test('soon window', () => {
  const t = [{ id: 1, title: 'x', at: '10:15' }];
  assert.ok(soonTask(t, at(10, 0))); assert.ok(soonTask(t, at(10, 20)));
  assert.equal(soonTask(t, at(9, 0)), null); assert.equal(soonTask(t, at(10, 40)), null);
});

test('evening default is 8:30 PM', () => { assert.ok(!isEvening(at(20, 29))); assert.ok(isEvening(at(20, 30))); });

test('snooze targets', () => {
  assert.equal(snoozeUntil('evening', at(9)).getHours(), 18);
  assert.equal(snoozeUntil('tomorrow', at(9)).getDate(), 11);
  assert.ok(snoozeUntil('evening', at(19)).getTime() > at(19).getTime());
});

test('timer text', () => { assert.equal(mmss(1452), '24:12'); assert.equal(mmss(-5), '00:00'); });
