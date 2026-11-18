-- 주간보고 개발 구분에 'deployed'(리얼배포 끝, 접수 시작 전)를 더한다.
-- 이 구분은 개발·테스트 어느 묶음에도 들지 않는다 — 오픈 주가 오면 접수기간으로 차주 오픈 예정에 든다.
-- 20261116_ops_weekly.sql 의 check 는 이름 없는 칸 check 라 Postgres 기본 이름(<표>_<칸>_check)을 받았다.
-- 다시 돌려도 결과가 같다(drop if exists + add).
alter table public.ops_weekly_dev_status
  drop constraint if exists ops_weekly_dev_status_stage_check;
alter table public.ops_weekly_dev_status
  add constraint ops_weekly_dev_status_stage_check
  check (stage in ('dev','test','deployed'));
