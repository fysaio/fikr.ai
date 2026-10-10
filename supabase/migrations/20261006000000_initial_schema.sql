-- Fikr: Phase 1 Initial Schema
-- Online Supabase Migration
-- RLS enabled for all tables, client-generated UUIDs supported

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  age_verified boolean not null default false,
  timezone text default 'UTC',
  nudge_level text default 'Morning, and when it helps',
  quiet_start text default '22:00',
  quiet_end text default '07:00',
  theme text default 'dark',
  created_at timestamptz not null default now()
);

-- 2. MEMORIES
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('people', 'projects', 'goals', 'commitments', 'places', 'prefs', 'history', 'patterns')),
  text text not null,
  confidence text not null check (confidence in ('known', 'stated', 'observed', 'hypothesized')),
  source text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'rejected', 'deleted')),
  when_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. TASKS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  starts_at timestamptz,
  duration_min integer not null default 25,
  why text default '',
  status text not null default 'open' check (status in ('open', 'done', 'moved')),
  source text not null default 'user' check (source in ('ai', 'user')),
  created_at timestamptz not null default now()
);

-- 4. ENTRIES
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  message text not null,
  kind text,
  transcript jsonb not null default '[]'::jsonb,
  outcome text default '',
  queued boolean not null default false,
  created_at timestamptz not null default now()
);

-- 5. FOCUS_SESSIONS
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null default now(),
  planned_min integer not null default 25,
  actual_min integer
);

-- 6. CHECKINS
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. PUSH_SUBSCRIPTIONS
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  keys jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 8. NUDGE_LOG
create table if not exists public.nudge_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete cascade,
  type text not null,
  sent_at timestamptz not null default now(),
  constraint nudge_log_user_task_type_key unique (user_id, task_id, type)
);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.tasks enable row level security;
alter table public.entries enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.checkins enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.nudge_log enable row level security;

-- RLS Policies

-- profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can delete own profile" on public.profiles
  for delete using (auth.uid() = id);

-- memories
create policy "Users can view own memories" on public.memories
  for select using (auth.uid() = user_id);

create policy "Users can insert own memories" on public.memories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own memories" on public.memories
  for update using (auth.uid() = user_id);

create policy "Users can delete own memories" on public.memories
  for delete using (auth.uid() = user_id);

-- tasks
create policy "Users can view own tasks" on public.tasks
  for select using (auth.uid() = user_id);

create policy "Users can insert own tasks" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "Users can update own tasks" on public.tasks
  for update using (auth.uid() = user_id);

create policy "Users can delete own tasks" on public.tasks
  for delete using (auth.uid() = user_id);

-- entries
create policy "Users can view own entries" on public.entries
  for select using (auth.uid() = user_id);

create policy "Users can insert own entries" on public.entries
  for insert with check (auth.uid() = user_id);

create policy "Users can update own entries" on public.entries
  for update using (auth.uid() = user_id);

create policy "Users can delete own entries" on public.entries
  for delete using (auth.uid() = user_id);

-- focus_sessions
create policy "Users can view own focus_sessions" on public.focus_sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own focus_sessions" on public.focus_sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own focus_sessions" on public.focus_sessions
  for update using (auth.uid() = user_id);

create policy "Users can delete own focus_sessions" on public.focus_sessions
  for delete using (auth.uid() = user_id);

-- checkins
create policy "Users can view own checkins" on public.checkins
  for select using (auth.uid() = user_id);

create policy "Users can insert own checkins" on public.checkins
  for insert with check (auth.uid() = user_id);

create policy "Users can update own checkins" on public.checkins
  for update using (auth.uid() = user_id);

create policy "Users can delete own checkins" on public.checkins
  for delete using (auth.uid() = user_id);

-- push_subscriptions
create policy "Users can view own push_subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can insert own push_subscriptions" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own push_subscriptions" on public.push_subscriptions
  for update using (auth.uid() = user_id);

create policy "Users can delete own push_subscriptions" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- nudge_log
create policy "Users can view own nudge_log" on public.nudge_log
  for select using (auth.uid() = user_id);

create policy "Users can insert own nudge_log" on public.nudge_log
  for insert with check (auth.uid() = user_id);

create policy "Users can update own nudge_log" on public.nudge_log
  for update using (auth.uid() = user_id);

create policy "Users can delete own nudge_log" on public.nudge_log
  for delete using (auth.uid() = user_id);

-- Helper function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, age_verified)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), coalesce((new.raw_user_meta_data->>'age_verified')::boolean, false))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to run after a new auth.users row is inserted
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes for performance
create index if not exists idx_memories_user_id on public.memories (user_id);
create index if not exists idx_memories_category on public.memories (user_id, category);
create index if not exists idx_tasks_user_id on public.tasks (user_id, status);
create index if not exists idx_entries_user_id on public.entries (user_id, created_at desc);
create index if not exists idx_focus_sessions_user_id on public.focus_sessions (user_id);
create index if not exists idx_checkins_user_id_date on public.checkins (user_id, date desc);
