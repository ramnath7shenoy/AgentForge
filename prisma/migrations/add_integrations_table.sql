-- Universal Connector: integrations table
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists public.integrations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null,
  access_token text not null,
  refresh_token text,
  metadata     jsonb default '{}',
  expires_at   timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint integrations_user_provider_unique unique (user_id, provider)
);

create index if not exists integrations_user_id_idx on public.integrations (user_id);

-- Auto-update updated_at on row changes
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger integrations_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

-- Row Level Security: users can only access their own integrations
alter table public.integrations enable row level security;

create policy "Users manage their own integrations"
  on public.integrations
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
