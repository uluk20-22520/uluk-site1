create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  local_id text,
  created_at timestamptz not null default now(),
  status text not null default 'new',
  name text not null,
  phone text not null,
  company text default '',
  service text default '',
  channel text default '',
  comment text default '',
  page text default '',
  source text default 'website',
  raw_payload jsonb default '{}'::jsonb
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

-- Быстрый режим для простого статического сайта.
-- Любой посетитель сайта с anon key сможет создавать, читать, обновлять и удалять заявки.
-- Для реального production лучше заменить эти policy на Edge Functions или авторизацию.

drop policy if exists "public insert leads" on public.leads;
create policy "public insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

drop policy if exists "public read leads" on public.leads;
create policy "public read leads"
  on public.leads
  for select
  to anon
  using (true);

drop policy if exists "public update leads" on public.leads;
create policy "public update leads"
  on public.leads
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "public delete leads" on public.leads;
create policy "public delete leads"
  on public.leads
  for delete
  to anon
  using (true);
