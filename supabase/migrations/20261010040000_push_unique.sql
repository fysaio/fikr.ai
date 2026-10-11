-- One row per device. Re-subscribing replaces the keys instead of adding a duplicate.
delete from public.push_subscriptions a using public.push_subscriptions b
  where a.user_id = b.user_id and a.endpoint = b.endpoint and a.created_at < b.created_at;
create unique index if not exists push_subscriptions_user_endpoint_idx on public.push_subscriptions (user_id, endpoint);
