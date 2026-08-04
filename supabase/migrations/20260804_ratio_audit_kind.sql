-- 경쟁률 점검을 두 종류로 분리 — 스케줄 점검(TEST 서버 세팅·문구)과
-- 페이지 점검(REAL 서버 HTML 링크 상태)은 실행 버튼·이력·알림을 따로 가진다.
--
-- 기존 행은 전부 스케줄 점검이었으므로 default 'schedule'로 채운다.

begin;

alter table public.ratio_audit_requests
  add column if not exists kind text not null default 'schedule';
alter table public.ratio_audit_requests
  drop constraint if exists ratio_audit_requests_kind_check;
alter table public.ratio_audit_requests
  add constraint ratio_audit_requests_kind_check
  check (kind in ('schedule', 'page'));

alter table public.ratio_audit_runs
  add column if not exists kind text not null default 'schedule';
alter table public.ratio_audit_runs
  drop constraint if exists ratio_audit_runs_kind_check;
alter table public.ratio_audit_runs
  add constraint ratio_audit_runs_kind_check
  check (kind in ('schedule', 'page'));

-- 이력 화면이 종류별로 최근 실행을 찾는다.
create index if not exists ratio_audit_runs_kind_ran_at_idx
  on public.ratio_audit_runs (kind, ran_at desc);

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select column_name, column_default from information_schema.columns
--  where table_name in ('ratio_audit_requests','ratio_audit_runs') and column_name = 'kind';
