-- incidents.app_type CHECK 확장 — 'PIMS' 추가 (PR-7)
-- 운영 도메인 의미상 PIMS는 카테고리가 아닌 시스템 구분.

begin;

alter table public.incidents
  drop constraint if exists incidents_app_type_check;

alter table public.incidents
  add constraint incidents_app_type_check
  check (app_type in ('공통원서','일반원서','공공원서','PIMS'));

notify pgrst, 'reload schema';

commit;

-- 검증:
-- insert into public.incidents (..., app_type, ...) values (..., 'PIMS', ...)
-- → 통과

-- 사후 정합성 (선택):
-- update public.incidents set app_type = 'PIMS' where category = 'PIMS';
-- → 기존 import row 중 시트 분류=PIMS였던 2건을 구분으로 이동
