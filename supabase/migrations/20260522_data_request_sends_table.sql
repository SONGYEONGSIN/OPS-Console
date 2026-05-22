-- data_request_sends — 자료 요청 메일 발송 이력 (Phase 1: sent/failed/dry_run, Phase 2: scheduled)
begin;

create table if not exists public.data_request_sends (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  university_name text not null,
  sender_email text not null,
  to_email text not null,
  to_name text,
  cc jsonb not null default '[]'::jsonb,
  subject text not null,
  body text not null,
  status text not null default 'sent',
  scheduled_at timestamptz,
  sent_at timestamptz,
  error text,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists data_request_sends_created_by_idx
  on public.data_request_sends (created_by_email, created_at desc);
create index if not exists data_request_sends_scheduled_idx
  on public.data_request_sends (status, scheduled_at);

alter table public.data_request_sends enable row level security;

drop policy if exists "data_request_sends_select_own_or_admin" on public.data_request_sends;
create policy "data_request_sends_select_own_or_admin"
  on public.data_request_sends for select to authenticated
  using (public.is_admin() or created_by_email = (auth.jwt() ->> 'email'));

grant select on public.data_request_sends to authenticated;
grant all on public.data_request_sends to service_role;

commit;
notify pgrst, 'reload schema';
