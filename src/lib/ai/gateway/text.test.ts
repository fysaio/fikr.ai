import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeCrisis, isTrivialAck } from './text.ts';

test('safety gate catches English crisis phrasing', () => {
  for (const s of [
    'I want to kill myself',
    "I don't want to live anymore",
    'I just want to die',
    'honestly everyone would be better off without me',
    "I can't keep going",
    "there's no point in living",
    'I have been cutting myself',
    'I keep thinking about suicide',
    'he is going to hurt her',
  ]) assert.equal(looksLikeCrisis(s), true, s);
});

test('safety gate catches Nigerian Pidgin phrasing', () => {
  for (const s of [
    'I no wan live again',
    'I wan die',
    'I don tire for this life',
    'make I die',
    'I wan kill mysef',
    'life no dey worth am',
  ]) assert.equal(looksLikeCrisis(s), true, s);
});

test('safety gate does not fire on ordinary or opposite meanings', () => {
  for (const s of [
    'I no wan die o, abeg help me sort my week',
    'I go finish am tonight',
    'My phone dey die, I need to charge it',
    'life no dey sweet but we move',
    'The proposal is killing me with stress about the deadline',
    'I want to live closer to campus',
    'I need to end the call with my supervisor by 3',
    'Tell Aisha I will reply',
    '',
  ]) assert.equal(looksLikeCrisis(s), false, s);
});

test('trivial acknowledgements', () => {
  assert.equal(isTrivialAck('Thanks!'), true);
  assert.equal(isTrivialAck('ok.'), true);
  assert.equal(isTrivialAck('ok but can we talk about Zara'), false);
});

test('ack: yes or ok after a question is an answer, not an acknowledgement', () => {
  assert.equal(isTrivialAck('yes', 'Want me to remind you at 3pm?'), false);
  assert.equal(isTrivialAck('ok', 'Shall I set a reminder?'), false);
  assert.equal(isTrivialAck('Thanks!'), true);
  assert.equal(isTrivialAck('yes'), true);
  assert.equal(isTrivialAck('yes', "I'll remember that."), false);
});

test('ack: a short run of filler words is an acknowledgement, anything with content is not', () => {
  assert.equal(isTrivialAck('Ok thanks, that helps.'), true);
  assert.equal(isTrivialAck('great, thank you so much'), true);
  assert.equal(isTrivialAck('ok thanks, remind me at 3'), false);
  assert.equal(isTrivialAck('thanks Aisha'), false);
});
