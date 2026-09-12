-- 운영자 배정 칸 세 개 — 배정 대상 여부 · 연차 그룹 · 경력 시작일.
-- 설계: docs/superpowers/specs/2026-09-12-work-assignment-design.md §5.2

begin;

alter table public.operators
  -- 배정 대상 여부. **파생하지 않는다** — 테스트 계정 2개가 team='운영2팀'/role='매니저'
  -- 로 실 운영자와 구별되지 않아 어떤 규칙도 그것을 걸러내지 못한다(설계 §3.4).
  -- default false: 새로 들어온 사람에게 대학이 저절로 배정되는 일이 없다.
  add column if not exists assignable boolean not null default false,
  -- 연차 그룹. 순서는 입사일로 재현되지만 **경계는 사람 판단**이라 저장한다.
  -- check 를 걸지 않는다 — 그룹이 하나 늘 때 마이그레이션을 잊으면 조직 화면
  -- 저장이 500 으로 죽는다. 값은 features/assignments/tenure.ts 의 as const + zod.
  add column if not exists tenure_group text,
  -- 배정 근거가 되는 경력 시작일. hired_at 은 인사 사실이라 건드리지 않는다 —
  -- 재입사자는 hired_at 이 최근이어서 연차를 그대로 쓰면 신입으로 읽힌다.
  add column if not exists career_start_at date;

comment on column public.operators.career_start_at is
  '배정 근거용 경력 시작일. null 이면 hired_at 을 쓴다(단일 정의: features/assignments/tenure.ts careerStartOf).';

-- 시드 — **이름으로 한다.** 시드 대상 한 명은 시드 SQL 의 이메일 도메인과 코드의
-- 도메인이 다르고 라이브 행은 그 뒤 편집됐다. 이메일로 시드하면 그 행을 놓친다(§3.3).
-- ⚠️ PostgREST 경로에는 safeupdate 가 켜져 있다 — WHERE 없는 UPDATE/DELETE 는 거부된다.
--    아래는 모두 WHERE 가 있다. 전체를 대상으로 해야 할 때는 `where true` 를 쓴다.
update public.operators set assignable = true, tenure_group = '1-1'
 where name in ('한효진','윤지혜');
update public.operators set assignable = true, tenure_group = '1-2'
 where name in ('박시현','김슬기');
update public.operators set assignable = true, tenure_group = '2'
 where name in ('김지영','이해영');
update public.operators set assignable = true, tenure_group = '3'
 where name in ('정윤나','임종우');
update public.operators set assignable = true, tenure_group = '4'
 where name in ('전혜인','김유민');
update public.operators set assignable = true, tenure_group = '5'
 where name in ('기자의','김지현');
update public.operators set assignable = true, tenure_group = '6'
 where name in ('김지나','김승현','전지은');

update public.operators set career_start_at = '2011-02-07' where name = '김슬기';

-- 새 컬럼은 스키마 캐시를 갱신하지 않으면 조회에 안 보인다.
-- **commit 앞에 둔다** — 원장 마이그레이션과 문자 우편함 선례와 같은 자리다.
notify pgrst, 'reload schema';

commit;

-- 그룹 값은 '1-1' < '1-2' < '2' < … < '6' 으로 **문자열 정렬이 곧 연차 순서**다
-- (한 자리 숫자라 성립). 화면 라벨(1그룹1)은 tenure.ts 의 as const 가 갖는다.

-- 검증 (수동, SQL Editor):
-- select count(*) from public.operators where assignable;                  -- 기대 15
-- select tenure_group, count(*), string_agg(name, ',' order by name)
--   from public.operators where assignable group by 1 order by 1;          -- 기대 7행 (2·2·2·2·2·2·3)
-- select name, hired_at, career_start_at from public.operators
--  where career_start_at is not null;                                      -- 기대 1행
-- 15 가 아니면 이름이 시드와 다른 행이 있다 — 그 행을 찾아 고친다(추측해 채우지 않는다).
