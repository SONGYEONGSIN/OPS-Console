-- operators.team 체크 제약에 '영업팀' 추가.
--
-- 배경: 사고보고 메일을 4년제 대학이면 그 대학 영업자에게 참조로 보낸다(2026-11-24).
-- 총괄장 02. 배정리스트의 영업자 칸에는 이름만 있어서, 조직권한에 영업팀으로 등재된
-- 사람에서 같은 이름을 찾아 메일로 바꾼다.
--
-- 영업팀은 부서를 '영업부'로 둔다(앱이 등록·팀 변경 때 채운다) — 팀 뉴스레터의
-- 생일·근속 기념일은 department='운영부' 만 싣는다(team-briefing.ts).

begin;

alter table public.operators
  drop constraint if exists operators_team_check;
alter table public.operators
  add constraint operators_team_check
  check (team in ('운영1팀', '운영2팀', '기획팀', '영업팀'));

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.operators'::regclass and conname = 'operators_team_check';
-- 기대: check (team = any (array['운영1팀'::text, '운영2팀'::text, '기획팀'::text, '영업팀'::text]))
