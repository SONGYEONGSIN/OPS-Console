-- incidents — 사고 보고 도메인 (PR-6)
-- 학년도 단위 관리 + 본문 4섹션 + 부서별 고정 보고자 매핑.
-- 시트 226 row import는 후속 PR.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.incidents (
  id              uuid primary key default gen_random_uuid(),
  year            integer not null,
  university_name text not null,
  app_type        text not null check (app_type in ('공통원서','일반원서','공공원서')),
  category        text not null,
  occurred_date   date,
  resolved_date   date,
  title           text not null,
  cause_summary   text,
  root_cause      text,
  resolution      text,
  prevention      text,
  department      text not null check (department in ('운영부-운영1팀','운영부-운영2팀')),
  assignee_email  text not null,
  assignee_name   text not null,
  reporter_email  text not null,
  reporter_name   text not null,
  status          text not null default '미처리' check (status in ('미처리','처리중','처리완료','보류')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists incidents_year_idx       on public.incidents (year desc);
create index if not exists incidents_status_idx     on public.incidents (status);
create index if not exists incidents_department_idx on public.incidents (department);
create index if not exists incidents_created_at_idx on public.incidents (created_at desc);

------------------------------------------------------------
-- 3) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.incidents;
-- → 0
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'incidents';
-- → 20 columns
