import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The gateway is the only door to a model. This test fails if new code talks to a provider directly.
 * Legacy files are listed so they cannot grow; remove them from the list as they are deleted.
 */
const ALLOWED = new Set([
  'src/lib/ai/gateway/providers.ts',
  // legacy, operator-only, behind adminGuard:
  'src/lib/llm/client.ts', 'src/lib/llm/wrapper.ts', 'src/lib/ai/provider.ts',
  'src/app/api/test-llm/route.ts', 'src/app/api/run-acceptance-tests/route.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n)) out.push(p);
  }
  return out;
}

test('only the gateway (and listed legacy files) may import a model client', () => {
  const offenders = walk('src').filter((f) => {
    if (ALLOWED.has(f)) return false;
    const s = readFileSync(f, 'utf8');
    return /from ['"]openai['"]/.test(s) || /\b(getLLMClient|getAIClient|callAI|callModel)\b/.test(s);
  });
  assert.deepEqual(offenders, []);
});

test('legacy operator routes are guarded', () => {
  for (const f of ['src/app/api/test-llm/route.ts', 'src/app/api/run-acceptance-tests/route.ts', 'src/app/api/metrics/route.ts']) {
    assert.match(readFileSync(f, 'utf8'), /adminGuard\(req\)/, f);
  }
});

test('every AI route requires a signed-in user and a rate limit', () => {
  for (const f of ['src/app/api/chat/route.ts', 'src/app/api/onboarding/route.ts']) {
    const s = readFileSync(f, 'utf8');
    assert.match(s, /getAuthedUser\(\)/, f);
    assert.match(s, /allow\(user\.id/, f);
  }
});

test('system prompts contain no per-user interpolation', () => {
  const s = readFileSync('src/config/chat-prompt.ts', 'utf8');
  const dyn = [...s.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(dyn.filter((d) => d !== 'PRODUCT_NAME'), []);
});
