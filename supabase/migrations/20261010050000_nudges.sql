-- Fikr-started nudges: log of what was sent and whether it was opened, plus the timer state the sender must respect.
alter table public.nudge_log add column if not exists key text;
alter table public.nudge_log add column if not exists title text;
alter table public.nudge_log add column if not exists local_day text;
alter table public.nudge_log add column if not exists opened_at timestamptz;
create index if not exists nudge_log_user_sent_idx on public.nudge_log (user_id, sent_at desc);

-- While a timer runs the person is not interrupted. The app writes the end time; null means no timer.
alter table public.profiles add column if not exists focus_until timestamptz;
