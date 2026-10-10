-- Phase 1 Data Models Migration per Section 4.3

-- 1. ENTITIES
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('person', 'project', 'goal', 'place')),
  name text not null,
  relationship text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. FACTS
create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_id uuid references public.entities(id) on delete set null,
  category text not null check (category in ('people', 'projects', 'goals', 'commitments', 'prefs', 'places', 'history', 'patterns')),
  text text not null,
  epistemic text not null default 'stated' check (epistemic in ('known', 'stated', 'observed', 'hypothesized')),
  state text check (state in ('open', 'undecided', 'done', 'dropped')),
  due_text text,
  due_at timestamptz,
  due_precision text check (due_precision in ('exact', 'approx')),
  since_text text,
  evidence jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  source_ref text,
  supersedes_id uuid references public.facts(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'superseded', 'rejected', 'deleted')),
  observation_count integer not null default 0,
  first_observed_at timestamptz,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. SUPPRESSIONS
create table if not exists public.suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text_hash text not null,
  created_at timestamptz not null default now(),
  constraint user_text_hash_unique unique (user_id, text_hash)
);

-- 4. THINK_ENTRIES
create table if not exists public.think_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  thread_day date not null default current_date,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  intent text not null check (intent in ('heard', 'understand', 'decide', 'remember', 'act', 'unclear')),
  outcome_line text,
  created_at timestamptz not null default now()
);

-- 5. INTERVENTIONS
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null check (kind in ('orientation', 'contextual_action', 'reflection', 'relationship')),
  decision text not null check (decision in ('act', 'ask', 'suggest', 'silent')),
  source_fact_ids jsonb not null default '[]'::jsonb,
  text text not null,
  why text not null,
  silent_reason text,
  channel text not null default 'in_app' check (channel in ('in_app', 'push')),
  shown_at timestamptz,
  outcome text check (outcome in ('acted', 'dismissed', 'ignored', 'snoozed', 'useful', 'not_useful')),
  outcome_at timestamptz
);

-- 6. ONBOARDING_STATE
create table if not exists public.onboarding_state (
  user_id uuid references auth.users(id) on delete cascade primary key,
  user_turns integer not null default 0,
  skipped_slots jsonb not null default '[]'::jsonb,
  branch_state text not null default 'none' check (branch_state in ('none', 'offered', 'think_one', 'get_it_out', 'asked_permission')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete')),
  updated_at timestamptz not null default now()
);

-- 7. EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  metadata jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

-- Enable RLS
alter table public.entities enable row level security;
alter table public.facts enable row level security;
alter table public.suppressions enable row level security;
alter table public.think_entries enable row level security;
alter table public.interventions enable row level security;
alter table public.onboarding_state enable row level security;
alter table public.events enable row level security;
