-- Citizen Connect pilot schema (PRD §9.1). Mock or redacted letters only:
-- this Supabase project is outside India and must never hold real citizen data.

create table if not exists public.applications (
  token        text primary key,
  venue        text not null,
  status       text not null,
  captured_at  timestamptz not null,
  department   text,
  sla_due_at   timestamptz,
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  data         jsonb not null
);

create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_department_idx on public.applications (department);
create index if not exists applications_captured_at_idx on public.applications (captured_at desc);

-- Only the server (service role) touches this table; no anon/authenticated access.
alter table public.applications enable row level security;

-- Private bucket for page images.
insert into storage.buckets (id, name, public)
values ('pages', 'pages', false)
on conflict (id) do nothing;
