-- operators.role CHECK 제약 확장 — '이사' 추가
-- 기존: 부장/팀장/TL/매니저/본부장/사장 (20260601d). 임원 직급 '이사' 추가.

begin;

alter table public.operators drop constraint if exists operators_role_check;
alter table public.operators add constraint operators_role_check
  check (role in ('부장','팀장','TL','매니저','본부장','사장','이사'));

notify pgrst, 'reload schema';

commit;
