/**
 * AI eval runner. Sends fixed scenarios through the REAL onboarding and chat code (gateway, safety gate, rules,
 * validation, repair, fallback) and prints what a person would see, plus mechanical checks and a rubric to read.
 *
 *   npm run eval:ai                       run everything once
 *   npm run eval:ai -- --only ch-rant,ob-vent
 *   npm run eval:ai -- --kind chat        or onboarding
 *   npm run eval:ai -- --repeat 3         run each scenario 3 times (checks consistency)
 *   npm run eval:ai -- --raw              also print the raw JSON for every scenario
 *   npm run eval:ai -- --delay 800        wait between calls (ms), for rate-limited keys
 *
 * Reads LLM_API_KEY, LLM_MODEL, LLM_BASE_URL, LLM_FALLBACK_* and LLM_REASONING from .env.local or the environment.
 * Never touches the database. Writes the full results to scripts/eval/out/ (git-ignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* Load .env.local (no dependency). Real environment variables win. Database keys are dropped on purpose. */
function loadEnv(file: string) {
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  return true;
}
const loaded = loadEnv('.env.local') || loadEnv('.env');
delete process.env.SUPABASE_SERVICE_ROLE_KEY; // eval runs never use the database, cache or budget
(process.env as Record<string, string | undefined>).NODE_ENV ||= 'test'; // silences per-call gateway logs

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : 'true';
};
const only = arg('only')?.split(',').map((s) => s.trim());
const kind = arg('kind');
const repeat = Math.max(1, Number(arg('repeat') ?? 1));
const delayMs = Number(arg('delay') ?? 2500);
const raw = arg('raw') === 'true';

type Status = 'PASS' | 'FAIL' | 'FALLBACK' | 'ERROR';
interface RunRecord {
  id: string; kind: string; title: string; rep: number; status: Status;
  source: string; model: string | null; retried: boolean; latencyMs: number; tokensIn: number; tokensOut: number;
  visible: string; failed: string[]; passed: number; total: number; rubric: string[]; result: unknown;
  /** Why the gateway fell back (rate_limited, provider_failed, invalid_output, budget, timeout). Empty otherwise. */
  reason: string;
  /** Per provider failure, e.g. "primary:400:json_validate_failed fallback:429". Status and short code only. Empty otherwise. */
  detail: string;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Imported after env is loaded: providers are read from the environment when the gateway first starts.
  const { SCENARIOS, words } = await import('./eval/scenarios');
  const { runOnboardingTurn, runChatTurn } = await import('../src/lib/ai');
  const { loadProviders } = await import('../src/lib/ai/gateway/providers');
  const { onGatewayEvent } = await import('../src/lib/ai/gateway/gateway');
  let lastReason = '';
  let lastDetail = '';
  onGatewayEvent((e) => { lastReason = e.reason ?? ''; lastDetail = e.detail ?? ''; });

  const providers = loadProviders();
  console.log(`\nEnv file: ${loaded ? 'loaded' : 'none found'}`);
  if (providers.length === 0) {
    console.log('No model key found (LLM_API_KEY). Model scenarios will show FALLBACK. Rule and safety scenarios still run.\n');
  } else {
    for (const p of providers) console.log(`Provider ${p.name}: ${p.model} @ ${p.baseURL}`);
    console.log(`Reasoning effort (gpt-oss only): ${process.env.LLM_REASONING ?? 'low'}\n`);
  }

  const picked = SCENARIOS.filter((s) => (!only || only.includes(s.id)) && (!kind || s.kind === kind));
  if (picked.length === 0) { console.log('No scenarios matched.'); process.exit(1); }

  const NOW = '2026-10-09T10:15:00+01:00';
  const records: RunRecord[] = [];

  for (const s of picked) {
    for (let rep = 1; rep <= repeat; rep++) {
      const userId = `eval-${s.id}-${rep}`; // distinct per run so the in-memory cache never replays an answer
      let result: unknown; let visible = ''; let source = 'model'; let model: string | null = null; let retried = false;
      let latencyMs = 0; let tokensIn = 0; let tokensOut = 0; let fell = false;
      const t0 = Date.now();
      let err: string | null = null;
      try {
        if (s.kind === 'onboarding') {
          const r = await runOnboardingTurn(s.history, s.facts ?? [], NOW, userId);
          result = r; model = r.metadata.model; retried = r.metadata.retried; latencyMs = r.metadata.latencyMs || Date.now() - t0;
          tokensIn = r.metadata.tokensIn; tokensOut = r.metadata.tokensOut; fell = r.metadata.fallbackUsed;
          source = model === 'rule' ? 'rule' : model === 'cache' ? 'cache' : fell ? 'fallback' : 'model';
          const ui = r.ui_spec as { options?: unknown[]; items?: unknown[] };
          visible = [r.reflection, r.next_question, ...(ui.options ?? []).map((o) => (typeof o === 'string' ? o : (o as { label: string; sub?: string }).label + ' ' + ((o as { sub?: string }).sub ?? ''))), ...(ui.items ?? []).map(String)].filter(Boolean).join(' | ');
        } else {
          const r = await runChatTurn(userId, s.message, s.history ?? [], s.context ?? [], NOW);
          result = r; model = r.metadata.model; retried = r.metadata.retried; latencyMs = r.metadata.latencyMs || Date.now() - t0;
          tokensIn = r.metadata.tokensIn; tokensOut = r.metadata.tokensOut; source = r.source; fell = r.source === 'fallback';
          visible = [r.reply, r.outcome_line, ...(r.ui?.options ?? [])].filter(Boolean).join(' | ');
        }
      } catch (e) { err = (e as Error).message; }

      const failed: string[] = []; let passed = 0; const total = s.checks.length;
      let status: Status;
      if (err) { status = 'ERROR'; failed.push(`threw: ${err}`); }
      else if (fell && !s.expectRule) { status = 'FALLBACK'; }
      else {
        for (const [name, test] of s.checks as Array<[string, (r: unknown, t: string) => boolean]>) {
          try { if (test(result, visible)) passed++; else failed.push(name); } catch (e) { failed.push(`${name} (check crashed: ${(e as Error).message})`); }
        }
        if (s.expectRule && source !== 'rule') failed.unshift(`expected a rule to answer, got ${source}`);
        status = failed.length ? 'FAIL' : 'PASS';
      }

      const rec: RunRecord = { id: s.id, kind: s.kind, title: s.title, rep, status, source, model, retried, latencyMs, tokensIn, tokensOut, visible, failed, passed, total, rubric: s.rubric, result, reason: source === 'fallback' ? lastReason : '', detail: source === 'fallback' ? lastDetail : '' };
      records.push(rec);

      const mark = { PASS: 'PASS    ', FAIL: 'FAIL    ', FALLBACK: 'FALLBACK', ERROR: 'ERROR   ' }[status];
      console.log(`${mark} ${s.id}${repeat > 1 ? ` #${rep}` : ''}  ${s.title}`);
      console.log(`         ${source}${model && source === 'model' ? ` (${model})` : ''}  ${latencyMs}ms  ${tokensIn}/${tokensOut} tokens${retried ? '  REPAIRED' : ''}`);
      console.log(`         shows: ${visible || '(nothing)'}${visible ? `   [${words(visible.split(' | ')[0])} words in first line]` : ''}`);
      if (source === 'fallback' && lastReason) console.log(`         why it fell back: ${lastReason}${lastDetail ? `  [${lastDetail}]` : ''}${lastReason === 'rate_limited' ? '  (the provider said slow down; this run says nothing about quality for this scenario)' : ''}`);
      for (const f of failed) console.log(`         x ${f}`);
      if (status !== 'FALLBACK') for (const r of s.rubric) console.log(`         read: ${r}`);
      if (raw || status === 'FAIL' || status === 'ERROR') console.log(JSON.stringify(result, null, 2).split('\n').map((l) => '         ' + l).join('\n'));
      console.log('');
      // Pause after EVERY call that may have reached a provider, including failures. Sleeping only after successes let a
      // rate-limited key be hammered, so one 429 turned every later scenario into a fast fallback and hid the real answers.
      if (providers.length && source !== 'rule') await sleep(lastReason === 'rate_limited' ? Math.max(delayMs, 20000) : delayMs);
    }
  }

  /* ----------------------------------------------------------- summary */
  const by = (st: Status) => records.filter((r) => r.status === st).length;
  const model = records.filter((r) => r.source === 'model');
  const lat = model.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p = (q: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0);
  const models = new Map<string, number>();
  for (const r of model) models.set(r.model ?? '?', (models.get(r.model ?? '?') ?? 0) + 1);

  console.log('================ SUMMARY ================');
  console.log(`runs ${records.length}   PASS ${by('PASS')}   FAIL ${by('FAIL')}   FALLBACK ${by('FALLBACK')}   ERROR ${by('ERROR')}`);
  console.log(`rule-answered ${records.filter((r) => r.source === 'rule').length}   model-answered ${model.length}   fallback rate ${pct(by('FALLBACK'), records.length)}`);
  console.log(`repair rate (model calls that needed a retry): ${pct(model.filter((r) => r.retried).length, model.length)}`);
  console.log(`latency of model calls: median ${p(0.5)}ms   p95 ${p(0.95)}ms   tokens in/out total ${records.reduce((a, r) => a + r.tokensIn, 0)}/${records.reduce((a, r) => a + r.tokensOut, 0)}`);
  if (models.size) console.log(`answered by: ${[...models].map(([m, n]) => `${m} x${n}`).join(', ')}  (a second name means the fallback provider took over)`);
  const fb = records.filter((r) => r.status === 'FALLBACK');
  if (fb.length) {
    const why = new Map<string, number>();
    for (const r of fb) { const k = `${r.reason || 'unknown'}${r.detail ? ` [${r.detail}]` : ''}`; why.set(k, (why.get(k) ?? 0) + 1); }
    console.log(`fallback causes: ${[...why].map(([k, n]) => `${k} x${n}`).join('; ')}`);
  }
  const bad = records.filter((r) => r.status === 'FAIL' || r.status === 'ERROR');
  if (bad.length) { console.log('\nNeeds attention:'); for (const r of bad) console.log(`  ${r.id}${repeat > 1 ? ` #${r.rep}` : ''}: ${r.failed.join('; ')}`); }

  const dir = join('scripts', 'eval', 'out');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), providers: providers.map((x) => ({ name: x.name, model: x.model })), records }, null, 2));
  console.log(`\nFull results saved to ${file}`);
  console.log('Paste the SUMMARY plus any FAIL or odd replies back, or attach that file.\n');
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
