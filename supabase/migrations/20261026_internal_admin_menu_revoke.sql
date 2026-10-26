-- 내부관리자 메뉴를 지정자 전용으로 바꾸며, 이미 퍼진 부여를 걷는다.
--
-- 20260511_operators_allowed_menus.sql 이 TL·매니저 전원의 allowed_menus 에
-- 'internal-admin' 을 심었다. 앱의 판정만 '지정자 전용' 으로 바꾸면 그 전원에게
-- 그대로 열린다 — 규칙은 allowed_menus 에 slug 가 있는지를 보기 때문이다.
--
-- 적용 순서: 이 SQL 먼저 → 그 다음 지정할 운영자에게 slug 부여.
-- 순서가 반대면 방금 부여한 것까지 걷힌다.

begin;

update public.operators
   set allowed_menus = array_remove(allowed_menus, 'internal-admin')
 where 'internal-admin' = any(allowed_menus);

commit;
