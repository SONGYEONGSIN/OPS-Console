-- operators.team 체크 제약에 '기획팀' 추가.
--
-- 배경: 미수채권 시트의 담당자 칸에 운영부가 아닌 인원(본부장 직속 기획팀)이 등장한다.
-- 학교담당자 독려 메일은 담당자 이름 → 이메일 매핑이 되어야 담당자 명의로 발송되는데,
-- 매핑에 실패한 행은 조용히 제외되어 그 담당자의 미수건은 한 번도 독려되지 않았다.
--
-- 팀 뉴스레터의 생일·근속 기념일은 부서(department='운영부') 기준으로 걸러지므로
-- 운영부가 아닌 인원이 등재돼도 운영부 소식지에는 실리지 않는다 (team-briefing.ts).

begin;

alter table public.operators
  drop constraint if exists operators_team_check;
alter table public.operators
  add constraint operators_team_check
  check (team in ('운영1팀', '운영2팀', '기획팀'));

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.operators'::regclass and conname = 'operators_team_check';
-- 기대: check (team = any (array['운영1팀'::text, '운영2팀'::text, '기획팀'::text]))
