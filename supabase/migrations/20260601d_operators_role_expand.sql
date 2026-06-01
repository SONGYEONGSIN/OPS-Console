-- operators.role CHECK 제약 확장 — '본부장','사장' 추가
-- 기존 제약은 20260509_operators_table.sql 에서 인라인(익명) 생성 → Postgres 자동 명명: operators_role_check
-- 경위서 결재라인(본부장/사장)을 operators로 표현하기 위해 직급 enum 확장.

begin;

alter table public.operators drop constraint if exists operators_role_check;
alter table public.operators add constraint operators_role_check
  check (role in ('부장','팀장','TL','매니저','본부장','사장'));

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.operators'::regclass and conname = 'operators_role_check';
-- → check (role = any (array['부장','팀장','TL','매니저','본부장','사장']))
