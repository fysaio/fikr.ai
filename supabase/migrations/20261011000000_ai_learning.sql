-- AI learning counters. Content-free. Lets us measure, per task and day:
--   how often plain code or the cache answered (zero tokens),
--   how many calls needed a repair retry (the 2x cost case),
--   how many prompt tokens the provider served from its own prefix cache.
alter table public.ai_usage add column if not exists rule_hits integer not null default 0;
alter table public.ai_usage add column if not exists cache_hits integer not null default 0;
alter table public.ai_usage add column if not exists repairs integer not null default 0;
alter table public.ai_usage add column if not exists cached_tokens_in integer not null default 0;

-- Replaces the 7-argument version. Drop the old one so a stale caller fails loudly instead of skipping the new counters.
drop function if exists public.ai_settle_usage(uuid, date, text, integer, integer, integer, boolean);

create or replace function public.ai_settle_usage(p_user uuid, p_day date, p_task text, p_reserved integer, p_in integer, p_out integer, p_fallback boolean, p_cached_in integer default 0, p_repaired boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ai_budget set tokens = greatest(0, tokens - p_reserved + p_in + p_out)
    where user_id = p_user and day = p_day;
  insert into public.ai_usage (user_id, day, task, calls, fallbacks, tokens_in, tokens_out, cached_tokens_in, repairs)
    values (p_user, p_day, p_task, 1, case when p_fallback then 1 else 0 end, p_in, p_out, p_cached_in, case when p_repaired then 1 else 0 end)
    on conflict (user_id, day, task) do update set
      calls = ai_usage.calls + 1,
      fallbacks = ai_usage.fallbacks + case when p_fallback then 1 else 0 end,
      tokens_in = ai_usage.tokens_in + p_in,
      tokens_out = ai_usage.tokens_out + p_out,
      cached_tokens_in = ai_usage.cached_tokens_in + p_cached_in,
      repairs = ai_usage.repairs + case when p_repaired then 1 else 0 end;
end $$;

create or replace function public.ai_note_event(p_user uuid, p_day date, p_task text, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ai_usage (user_id, day, task, rule_hits, cache_hits)
    values (p_user, p_day, p_task, case when p_kind = 'rule' then 1 else 0 end, case when p_kind = 'cache' then 1 else 0 end)
    on conflict (user_id, day, task) do update set
      rule_hits = ai_usage.rule_hits + case when p_kind = 'rule' then 1 else 0 end,
      cache_hits = ai_usage.cache_hits + case when p_kind = 'cache' then 1 else 0 end;
end $$;

revoke all on function public.ai_settle_usage(uuid, date, text, integer, integer, integer, boolean, integer, boolean) from public, anon, authenticated;
revoke all on function public.ai_note_event(uuid, date, text, text) from public, anon, authenticated;

-- Per-task rollup for the last 7 days. Read it in the SQL editor:  select * from public.ai_report;
create or replace view public.ai_report as
select task,
       sum(calls) as model_calls,
       sum(rule_hits) as rule_hits,
       sum(cache_hits) as cache_hits,
       round(100.0 * sum(rule_hits + cache_hits) / nullif(sum(calls + rule_hits + cache_hits), 0), 1) as free_pct,
       round(100.0 * sum(fallbacks) / nullif(sum(calls), 0), 1) as fallback_pct,
       round(100.0 * sum(repairs) / nullif(sum(calls), 0), 1) as repair_pct,
       round(sum(tokens_in)::numeric / nullif(sum(calls), 0)) as avg_tokens_in,
       round(sum(tokens_out)::numeric / nullif(sum(calls), 0)) as avg_tokens_out,
       round(100.0 * sum(cached_tokens_in) / nullif(sum(tokens_in), 0), 1) as provider_cached_pct
from public.ai_usage
where day >= current_date - 7
group by task;
revoke all on public.ai_report from public, anon, authenticated;
