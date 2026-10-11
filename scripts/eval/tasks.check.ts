// Task schema and cache-key checks. tasks.ts uses the @/ alias, which plain node cannot resolve, so these run through tsx:
//   npm run test:tasks
import test from 'node:test';
import assert from 'node:assert/strict';
import { chatTask, chatOutput, chatInput, onboardingTask, onboardingOutput, onboardingInput } from '../../src/lib/ai/tasks';

const baseChat = { nowDay: '2026-10-11', message: 'hi there', history: [], context: [] };
const baseOb = { nowDay: '2026-10-11', history: [{ q: 'What is on your mind?', a: 'My defence is Sunday.' }], facts: [], target: 'project', readiness: {}, complete: false, venting: false };

test('chat: an extra fact, a bad fact or an unknown intent does not throw the reply away', () => {
  const r = chatOutput.parse({
    intent: 'banana', reply: 'Noted.', ui: { type: 'weird', options: ['a', 'b'] },
    facts: [
      { category: 'people', text: 'Aisha owes me a reply' },
      { category: 'nope', text: 'bad category' },
      { category: 'goals', text: 'Finish the proposal' },
      { category: 'goals', text: 'A third valid fact' },
    ],
  });
  assert.equal(r.intent, 'unclear'); assert.equal(r.ui?.type, 'none'); assert.equal(r.facts.length, 2);
});

test('chat: a 2000 character message stays valid as history next turn', () => {
  const r = chatInput.parse({ ...baseChat, history: [{ role: 'user', text: 'x'.repeat(2000) }] });
  assert.equal(r.history[0].text.length, 1500);
});

test('chat: yes after a question reaches the model, bare thanks does not', () => {
  const asked = chatInput.parse({ ...baseChat, message: 'yes', history: [{ role: 'assistant', text: 'Want a reminder at 3?' }] });
  assert.equal(chatTask.shortcut?.(asked), null);
  assert.ok(chatTask.shortcut?.(chatInput.parse({ ...baseChat, message: 'thanks' })));
});

test('onboarding: seven facts from the model are trimmed to three, not rejected', () => {
  const facts = Array.from({ length: 7 }, (_, i) => ({ category: 'projects', value: `f${i}` }));
  assert.equal(onboardingOutput.parse({ next_question: 'Who is involved?', ui_spec: { type: 'text' }, facts }).facts.length, 3);
});

test('onboarding: too many facts or turns are clipped instead of failing the whole turn', () => {
  const facts = Array.from({ length: 80 }, (_, i) => ({ id: `f${i}`, category: 'projects', value: 'v'.repeat(900) }));
  const history = Array.from({ length: 40 }, () => ({ q: 'q'.repeat(900), a: 'a'.repeat(3000) }));
  const r = onboardingInput.parse({ ...baseOb, facts, history });
  assert.equal(r.facts.length, 60); assert.equal(r.history.length, 30);
  assert.equal(r.facts[0].value.length, 400); assert.equal(r.history[0].a.length, 2000);
});

test('onboarding: cache key separates long answers that share a 500 character start', () => {
  const start = 'a'.repeat(600);
  const x = onboardingInput.parse({ ...baseOb, history: [{ q: 'q', a: start + ' one' }] });
  const y = onboardingInput.parse({ ...baseOb, history: [{ q: 'q', a: start + ' two' }] });
  assert.notDeepEqual(onboardingTask.cache!.keyOf(x), onboardingTask.cache!.keyOf(y));
});

test('the onboarding prompt stays short and no longer asks for slots', async () => {
  const { ONBOARDING_SYSTEM_PROMPT } = await import('../../src/config/onboarding-prompts');
  assert.ok(ONBOARDING_SYSTEM_PROMPT.length < 4000, `prompt is ${ONBOARDING_SYSTEM_PROMPT.length} chars`);
  assert.ok(!ONBOARDING_SYSTEM_PROMPT.includes('"slots"'));
});
