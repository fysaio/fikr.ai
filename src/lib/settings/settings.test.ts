import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, isQuiet, mergeSettings } from './settings.ts';

const at = (h: number, m = 0, d = 10) => new Date(2026, 9, d, h, m); // 10 Oct 2026 is a Saturday

test('late night crosses midnight', () => {
  assert.equal(isQuiet(at(23, 30), DEFAULT_SETTINGS), true);
  assert.equal(isQuiet(at(6, 59), DEFAULT_SETTINGS), true);
  assert.equal(isQuiet(at(7, 0), DEFAULT_SETTINGS), false);
  assert.equal(isQuiet(at(12), DEFAULT_SETTINGS), false);
});
test('quiet for today applies only today', () => {
  const s = { ...DEFAULT_SETTINGS, quietToday: '2026-10-10' };
  assert.equal(isQuiet(at(12), s), true);
  assert.equal(isQuiet(at(12, 0, 11), s), false);
});
test('weekends and classes', () => {
  const w = { ...DEFAULT_SETTINGS, quiet: { ...DEFAULT_SETTINGS.quiet, weekends: true } };
  assert.equal(isQuiet(at(12), w), true);
  const c = { ...DEFAULT_SETTINGS, quiet: { ...DEFAULT_SETTINGS.quiet, classes: true } };
  assert.equal(isQuiet(at(10, 0, 12), c), true); // Monday
  assert.equal(isQuiet(at(10, 0, 10), c), false); // Saturday
});
test('merge fills gaps and ignores junk', () => {
  assert.deepEqual(mergeSettings(null), DEFAULT_SETTINGS);
  assert.equal(mergeSettings({ speak: { reflection: true } }).speak.orientation, true);
});
