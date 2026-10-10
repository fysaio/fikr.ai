-- Notification choices and quiet times, kept server side so scheduled sends can respect them.
alter table public.profiles add column if not exists speak jsonb not null default '{"orientation":true,"moment":true,"reflection":false,"people":true}'::jsonb;
alter table public.profiles add column if not exists quiet jsonb not null default '{"mornings":false,"classes":false,"prayer":false,"evenings":false,"weekends":false,"late":true}'::jsonb;
alter table public.profiles add column if not exists quiet_today date;
