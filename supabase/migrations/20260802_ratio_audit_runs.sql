-- 경쟁률 세팅 점검 실행 이력. 판정 규칙이 파일럿에서 바뀌므로 상세는 payload jsonb로 둔다
-- (receivables_match_runs 와 동일 전략). 조회 화면은 규칙 안정화 후 별도 검토.

begin;

create table if not exists public.ratio_audit_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  scanned_count int not null,
  finding_count int not null,
  link_error_count int not null,
  status text not null,
  notified boolean not null default false,
  payload jsonb not null
);

alter table public.ratio_audit_runs
  drop constraint if exists ratio_audit_runs_status_check;
alter table public.ratio_audit_runs
  add constraint ratio_audit_runs_status_check
  check (status in ('ok', 'partial', 'failed'));

create index if not exists ratio_audit_runs_ran_at_idx
  on public.ratio_audit_runs (ran_at desc);

-- RLS — read: authenticated 전체(운영부 공개) / write: service_role only.
-- worklog 와 동일 정책. 이력은 append-only 로 UI에서 변조 불가.
alter table public.ratio_audit_runs enable row level security;

drop policy if exists "ratio_audit_runs_read_authenticated" on public.ratio_audit_runs;
create policy "ratio_audit_runs_read_authenticated"
  on public.ratio_audit_runs for select to authenticated using (true);

grant select on public.ratio_audit_runs to authenticated;
grant all on public.ratio_audit_runs to service_role;

notify pgrst, 'reload schema';

commit;
