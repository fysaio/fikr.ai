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
