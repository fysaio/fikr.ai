import test from 'node:test';
import assert from 'node:assert/strict';
import { chatTask, chatOutput, chatInput, onboardingTask, onboardingOutput, onboardingInput } from './tasks.ts';

const baseChat = { nowDay: '2026-10-11', message: 'hi there', history: [], context: [] };

test('chat: an extra fact or a bad fact does not throw the reply away', () => {
  const r = chatOutput.parse({
    intent: 'banana', reply: 'Noted.', ui: { type: 'weird', options: ['a', 'b'] },
    facts: [
      { category: 'people', text: 'Aisha owes me a reply' },
      { category: 'nope', text: 'bad category' },
      { category: 'goals', text: 'Finish the proposal' },
      { category: 'goals', text: 'A third valid fact' },
    ],
  });
  assert.equal(r.intent, 'unclear');
  assert.equal(r.ui?.type, 'none');
  assert.equal(r.facts.length, 2);
});

test('chat: a 2000 character message stays valid as history next turn', () => {
  const long = 'x'.repeat(2000);
  const r = chatInput.parse({ ...baseChat, history: [{ role: 'user', text: long }] });
  assert.equal(r.history[0].text.length, 1500);
});

test('chat: yes after a question reaches the model, bare thanks does not', () => {
  const asked = chatInput.parse({ ...baseChat, message: 'yes', history: [{ role: 'assistant', text: 'Want a reminder at 3?' }] });
  assert.equal(chatTask.shortcut?.(asked), null);
  const thanks = chatInput.parse({ ...baseChat, message: 'thanks' });
  assert.ok(chatTask.shortcut?.(thanks));
});

test('chat: cache key changes when memory changes', () => {
  const a = chatInput.parse({ ...baseChat, context: [{ id: '1', category: 'people', text: 'Aisha' }] });
  const b = chatInput.parse({ ...baseChat, context: [{ id: '1', category: 'people', text: 'Aisha' }, { id: '2', category: 'goals', text: 'Pass' }] });
  assert.notDeepEqual(chatTask.cache!.keyOf(a), chatTask.cache!.keyOf(b));
});

const baseOb = { nowDay: '2026-10-11', history: [{ q: 'What is on your mind?', a: 'My defence is Sunday.' }], facts: [], target: 'project', readiness: {}, complete: false, venting: false };

test('onboarding: seven facts from the model are trimmed to three, not rejected', () => {
  const facts = Array.from({ length: 7 }, (_, i) => ({ category: 'projects', value: `f${i}` }));
  const r = onboardingOutput.parse({ next_question: 'Who is involved?', ui_spec: { type: 'text' }, facts });
  assert.equal(r.facts.length, 3);
});

test('onboarding: too many facts or turns are clipped instead of failing the whole turn', () => {
  const facts = Array.from({ length: 80 }, (_, i) => ({ id: `f${i}`, category: 'projects', value: 'v'.repeat(900) }));
  const history = Array.from({ length: 40 }, () => ({ q: 'q'.repeat(900), a: 'a'.repeat(3000) }));
  const r = onboardingInput.parse({ ...baseOb, facts, history });
  assert.equal(r.facts.length, 60); assert.equal(r.history.length, 30);
  assert.equal(r.facts[0].value.length, 400); assert.equal(r.history[0].a.length, 2000);
});

test('onboarding: a crisis message gets the fixed support reply with no model call', () => {
  const i = onboardingInput.parse({ ...baseOb, history: [{ q: 'q', a: "Sometimes I feel like I can't keep going." }] });
  const out = onboardingTask.safe!(i);
  assert.equal(out.safety, true); assert.equal(out.slot_target, 'support');
  assert.ok(out.next_question.includes('A real person can'));
});

test('onboarding: cache key separates long answers that share a 500 character start', () => {
  const start = 'a'.repeat(600);
  const x = onboardingInput.parse({ ...baseOb, history: [{ q: 'q', a: start + ' one' }] });
  const y = onboardingInput.parse({ ...baseOb, history: [{ q: 'q', a: start + ' two' }] });
  assert.notDeepEqual(onboardingTask.cache!.keyOf(x), onboardingTask.cache!.keyOf(y));
});

test('prompt versions were bumped with the prompt rewrite', () => {
  assert.equal(onboardingTask.version, '3'); assert.equal(chatTask.version, '2');
});
