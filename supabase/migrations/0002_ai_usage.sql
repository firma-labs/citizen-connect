-- Daily AI reading allowance, so a public pilot demo can't run up a large AI bill.
-- One row per day (India time); take_ai_read() is atomic across serverless instances.

create table if not exists public.ai_usage (
  day   date primary key,
  reads integer not null default 0
);

alter table public.ai_usage enable row level security;

-- Returns the new count, or -1 when today's limit is already reached.
create or replace function public.take_ai_read(p_day date, p_limit integer)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  insert into public.ai_usage (day, reads) values (p_day, 0) on conflict (day) do nothing;
  update public.ai_usage set reads = reads + 1
    where day = p_day and reads < p_limit
    returning reads into n;
  return coalesce(n, -1);
end;
$$;
