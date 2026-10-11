# AI gateway

Every model call in Gist goes through `src/lib/ai/gateway/gateway.ts` (`runTask`). Nothing else may import a model client. `lockdown.test.ts` fails the build if something does.

## What a call goes through, cheapest first

1. **Input schema.** Zod validates and caps sizes. Bad input never reaches a model.
2. **Rule shortcut.** Plain code answers when the model adds nothing: onboarding venting branch (fixed choices), onboarding complete ("That's enough to start."), chat acknowledgements ("ok", "thanks"). Zero tokens.
3. **Safety gate.** A local check for self-harm or harm-to-others language returns fixed, careful copy. No model call, so it is fast and cannot be talked out of it. Add real helplines to `CRISIS_RESOURCES` in `src/config/flags.ts` before launch (it is empty).
4. **Cache.** Exact match on a SHA-256 of task, prompt version, user and normalised input. Memory first, then the `ai_cache` table. This catches double taps, retries and offline-outbox replays, which would otherwise pay twice. Cache entries hold model output only, never prompts.
5. **Single-flight.** Concurrent identical calls share one request.
6. **Budget.** Worst-case tokens are reserved atomically in Postgres (`ai_reserve_tokens`), then settled to real usage. Over the daily cap the user gets the fixed fallback copy, never an error. Set `AI_DAILY_TOKENS_PER_USER`.
7. **Provider chain.** Primary (Groq) then fallback (Gemini, OpenAI-compatible). 429 and 5xx move to the next provider. Output must pass the task's output schema; one repair retry is allowed on tasks that opt in.
8. **Fixed fallback.** Each task defines copy for total failure. Nothing the person wrote is lost.

## Where the tokens went, and what changed

| Before | After |
| --- | --- |
| Onboarding sent the full history and every fact as JSON each turn | Last 3 turns (clipped) plus one line per fact, capped at 20 |
| Chat made two calls per message (reply, then extraction) | One call returns the reply and up to 2 facts |
| Timestamp with seconds in every prompt (defeats any cache) | Date only |
| Retried invalid JSON by resending everything at temperature 0 | One bounded repair that includes only the bad output and the error |
| `maxTokens` 1200 for onboarding | 700, matching real output size |
| Per-user data inside prompts | System prompts are static strings. Per-user data is only in the user message, so the prefix is identical across users and providers that cache prefixes can use it |

I have not measured savings on live traffic. Check `/api/metrics` (needs `ADMIN_SECRET` in production) and the `ai_usage` table: compare `tokens_in` per task before and after, and watch `fallbacks / calls`.

## Fixes in the Gist pass (not yet run against live models)

| Problem | Fix |
| --- | --- |
| Onboarding prompt was about 2,160 tokens, sent every turn | Rewritten to about 780. Venting and crisis handling live in code, not in the prompt. `slots` removed from the output (code computes coverage) |
| Chat and onboarding rejected a whole good reply for one extra fact, a long string or an unknown intent | Lenient output schemas: extras trimmed, bad facts dropped, unknown intent becomes `unclear` |
| A 2000 character message passed as MESSAGE but failed as history next turn, so the person got the canned fallback | Inputs are clipped, not rejected |
| Onboarding error path returned `all_facts: []`, which wiped the client's facts | Returns the facts it received |
| "yes" after "Want a reminder?" was answered "Ok." by the ack shortcut | Yes and no only count as acknowledgements when nothing was asked |
| Shortcut ran before the safety gate, so a long crisis message could be taken for venting | Safety gate runs first. Onboarding now has one, with the fixed support copy from the design |
| Chat cache ignored Memory, so stale answers (and their facts) could replay | Memory digest is in the key. Onboarding key also holds the full latest answer and the venting flag |
| Two slow providers plus a repair could take 3x the timeout | `totalTimeoutMs` caps the whole run (default 1.5x). Late providers are skipped for the fixed fallback |
| Gemini 2.5 thinks by default and thinking tokens eat `max_tokens` | `reasoning_effort: none` for the fallback provider. Override with `LLM_FALLBACK_REASONING` (empty to omit) |
| Legacy decider used server time (UTC) for quiet hours and ignored the person's Settings | Uses their timezone, real quiet times and per-kind toggles |
| Prompt names changed from Fikr, but cached answers were keyed on the old prompt | Onboarding version 3, chat version 2 |

## Learning from real traffic

Run `supabase/migrations/20261011000000_ai_learning.sql`, then in the SQL editor:

`select * from public.ai_report;`

Per task, last 7 days: `free_pct` (rule plus cache, zero tokens), `fallback_pct`, `repair_pct` (the 2x cost case), `avg_tokens_in` and `avg_tokens_out`, and `provider_cached_pct` (prompt tokens the provider served from its own prefix cache, if it reports them). Change one thing, bump the task `version`, and compare the numbers before and after. If `repair_pct` is high, the prompt's output format is unclear. If `provider_cached_pct` stays 0 on a provider, that model does not prefix-cache and shortening the prompt is the only lever.

## Prompt versions

Each task has a `version`. Bump it whenever you change the prompt or output shape, or old cache entries will keep serving the old behaviour.

## Not done on purpose

- **Semantic (embedding) caching.** Personal messages rarely repeat in meaning, and an embedding call costs tokens too. Revisit if the metrics show repeat questions.
- **Streaming.** Not needed yet. Replies are short.
- **Fine-tuning or a smaller model for extraction.** Measure first. The gateway lets you give one task its own provider later.

## Operating it

- Run `supabase/migrations/20261010000000_ai_gateway.sql`. Call `select ai_cache_purge();` from your daily cron.
- `SUPABASE_SERVICE_ROLE_KEY` must be set on the server. Without it the gateway falls back to in-process cache, no budget and an in-memory rate limit, which is fine for local work and wrong for production.
- Rate limits are per user and shared across instances (`ai_rate_hit`). The old in-memory limiter is gone.
- `/api/*` is still public in `middleware.ts`. The AI routes check the session themselves. Other API routes should too.
- Tests: `npm test`.
