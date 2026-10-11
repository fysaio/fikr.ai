-- Task card fields the app already uses, plus the server-side time lock.
alter table public.tasks add column if not exists kind text check (kind in ('follow', 'due', 'free'));
alter table public.tasks add column if not exists tag_text text;
alter table public.tasks add column if not exists contact_name text;
alter table public.tasks add column if not exists contact_phone text;
alter table public.tasks add column if not exists hidden_until timestamptz;

-- A timed follow-up or free window cannot be marked done before its time.
-- The check uses the database clock, so changing the phone clock does nothing.
create or replace function public.enforce_task_time_lock() returns trigger
language plpgsql as $$
begin
  if new.kind in ('follow', 'free') and new.starts_at is not null then
    if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') and new.starts_at > now() then
      raise exception 'time_lock: opens at %', new.starts_at using errcode = 'P0001';
    end if;
    -- Moving a locked task earlier is how the lock could be dodged. Only the service role may do it.
    if tg_op = 'UPDATE' and old.starts_at is not null and old.starts_at > now()
       and new.starts_at < old.starts_at and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'time_lock: cannot move a locked task earlier' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tasks_time_lock on public.tasks;
create trigger tasks_time_lock before insert or update on public.tasks
  for each row execute function public.enforce_task_time_lock();
