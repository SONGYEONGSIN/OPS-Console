-- 계약 완료 건수 월별 스냅샷
-- 계약 시트에는 '완료로 바뀐 시각'이 없으므로(엑셀은 셀 변경시각 미기록),
-- 월별로 완료 건수를 스냅샷 저장하고 전월 대비 증감으로 '계약 체결' KPI를 산출한다.
-- 자동화 잡(contract-completion-snapshot)이 현재 월(ym) 스냅샷을 주기적으로 upsert.

begin;

create table if not exists public.contract_completion_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  -- KST 기준 월 'YYYY-MM' (월당 1행 upsert)
  ym              text not null unique,
  completed_count int not null default 0,
  captured_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists ccs_set_updated_at on public.contract_completion_snapshots;
create trigger ccs_set_updated_at
before update on public.contract_completion_snapshots
for each row execute function public.set_updated_at();

create index if not exists ccs_ym_desc_idx
  on public.contract_completion_snapshots (ym desc);

-- RLS: read = authenticated 전체 (운영부 공개) / write = service_role only (잡·서버 경유)
alter table public.contract_completion_snapshots enable row level security;

drop policy if exists ccs_read on public.contract_completion_snapshots;
create policy ccs_read
  on public.contract_completion_snapshots
  for select
  to authenticated
  using (true);

grant select on public.contract_completion_snapshots to authenticated;
-- 잡·서버(admin/service_role)는 RLS 우회하지만 테이블 GRANT는 별도 필요
grant all on public.contract_completion_snapshots to service_role;

commit;
