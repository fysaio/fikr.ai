-- A number the user typed for a person in People. Fikr never contacts this person.
alter table public.memories add column if not exists phone text;
