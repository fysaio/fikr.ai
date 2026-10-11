import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrivialAck, looksLikeCrisis } from './text.ts';

test('ack: plain thanks needs no model', () => {
  assert.ok(isTrivialAck('Thanks!'));
  assert.ok(isTrivialAck('ok'));
});

test('ack: yes after a question is an answer, not an acknowledgement', () => {
  assert.equal(isTrivialAck('yes', 'Want me to remind you at 3pm?'), false);
  assert.equal(isTrivialAck('no', 'Should I set it for tomorrow?'), false);
  assert.equal(isTrivialAck('ok', 'Shall I set a reminder?'), false);
});

test('ack: yes with no earlier question is still free', () => {
  assert.equal(isTrivialAck('yes'), true);
  assert.equal(isTrivialAck('yes', "I'll remember that."), false); // something was said, so it is not a bare yes
});

test('crisis gate catches the design example and common phrasings', () => {
  for (const t of [
    "Honestly I don't know what I'm doing anymore. Sometimes I feel like I can't keep going.",
    'i want to die', 'I wan die', 'better off dead', 'there is no point in living', 'I want to kill myself',
  ]) assert.equal(looksLikeCrisis(t), true, t);
});

test('crisis gate leaves ordinary venting alone', () => {
  for (const t of [
    "I can't keep going to the gym because of my defence.",
    "I can't go on the trip with Aisha.",
    'My supervisor has not replied and I am stressed.',
    'Remind me to kill the old draft.',
  ]) assert.equal(looksLikeCrisis(t), false, t);
});
