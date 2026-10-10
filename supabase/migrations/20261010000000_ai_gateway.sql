-- AI gateway: response cache and per-user daily token metering.
-- Content-free usage; the cache stores model OUTPUT only, keyed by a hash, never prompts.
-- RLS is on with no policies: only the service role (server) can read or write.

create table if not exists public.ai_cache (
  key text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  task text not null,
  version text not null,
  value jsonb not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists ai_cache_expires_idx on public.ai_cache (expires_at);
create index if not exists ai_cache_user_idx on public.ai_cache (user_id);

create table if not exists public.ai_usage (
  user_id uuid references auth.users(id) on delete cascade not null,
  day date not null,
  task text not null,
  calls integer not null default 0,
  fallbacks integer not null default 0,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  primary key (user_id, day, task)
);

-- Running total per user per day, used for the cap. One row, so the check is atomic.
create table if not exists public.ai_budget (
  user_id uuid references auth.users(id) on delete cascade not null,
  day date not null,
  tokens integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_cache enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_budget enable row level security;

-- Reserve tokens atomically. Returns false (and reserves nothing) if the cap would be exceeded.
create or replace function public.ai_reserve_tokens(p_user uuid, p_day date, p_tokens integer, p_cap integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into public.ai_budget (user_id, day, tokens) values (p_user, p_day, 0)
    on conflict (user_id, day) do nothing;
  update public.ai_budget set tokens = tokens + p_tokens
    where user_id = p_user and day = p_day and tokens + p_tokens <= p_cap
    returning true into ok;
  return coalesce(ok, false);
end $$;

-- Swap the reservation for real usage.
create or replace function public.ai_settle_usage(p_user uuid, p_day date, p_task text, p_reserved integer, p_in integer, p_out integer, p_fallback boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.ai_budget set tokens = greatest(0, tokens - p_reserved + p_in + p_out)
    where user_id = p_user and day = p_day;
  insert into public.ai_usage (user_id, day, task, calls, fallbacks, tokens_in, tokens_out)
    values (p_user, p_day, p_task, 1, case when p_fallback then 1 else 0 end, p_in, p_out)
    on conflict (user_id, day, task) do update set
      calls = ai_usage.calls + 1,
      fallbacks = ai_usage.fallbacks + case when p_fallback then 1 else 0 end,
      tokens_in = ai_usage.tokens_in + p_in,
      tokens_out = ai_usage.tokens_out + p_out;
end $$;

create or replace function public.ai_cache_touch(p_key text)
returns void language sql security definer set search_path = public as $$
  update public.ai_cache set hits = hits + 1 where key = p_key;
$$;

revoke all on function public.ai_reserve_tokens(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_settle_usage(uuid, date, text, integer, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.ai_cache_touch(text) from public, anon, authenticated;

-- Housekeeping: call from the existing daily cron.
create or replace function public.ai_cache_purge() returns void language sql security definer set search_path = public as $$
  delete from public.ai_cache where expires_at < now();
  delete from public.ai_usage where day < current_date - 90;
  delete from public.ai_budget where day < current_date - 3;
$$;
revoke all on function public.ai_cache_purge() from public, anon, authenticated;

-- Cross-instance rate limit (fixed window). Replaces the in-memory limiter, which does not work on serverless.
create table if not exists public.ai_rate (
  user_id uuid references auth.users(id) on delete cascade not null,
  bucket text not null,
  window_start timestamptz not null,
  n integer not null default 0,
  primary key (user_id, bucket)
);
alter table public.ai_rate enable row level security;

create or replace function public.ai_rate_hit(p_user uuid, p_bucket text, p_limit integer, p_window_sec integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare cur integer;
begin
  insert into public.ai_rate (user_id, bucket, window_start, n) values (p_user, p_bucket, now(), 1)
    on conflict (user_id, bucket) do update set
      n = case when ai_rate.window_start < now() - make_interval(secs => p_window_sec) then 1 else ai_rate.n + 1 end,
      window_start = case when ai_rate.window_start < now() - make_interval(secs => p_window_sec) then now() else ai_rate.window_start end
    returning n into cur;
  return cur <= p_limit;
end $$;
revoke all on function public.ai_rate_hit(uuid, text, integer, integer) from public, anon, authenticated;
