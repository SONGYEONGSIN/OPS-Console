-- 신입 OJT 회차(cohort) 테이블
-- admin이 신입 합류 시 회차 생성, trainee/mentor email로 RLS 매칭.
-- sessions 테이블은 본 epic 외 — 후속 epic.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.onboarding_cohorts (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  trainee_email   text not null,                                  -- 신입 (operators.email 기대)
  mentor_email    text,                                           -- 사수 (nullable — 미정 가능)
  start_date      date not null,
  end_date        date,                                           -- nullable — 진행 중
  status          text not null default 'planned'
                  check (status in ('planned', 'in_progress', 'completed')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists onboarding_cohorts_set_updated_at on public.onboarding_cohorts;
create trigger onboarding_cohorts_set_updated_at
before update on public.onboarding_cohorts
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists onboarding_cohorts_trainee_idx
  on public.onboarding_cohorts (trainee_email);

create index if not exists onboarding_cohorts_mentor_idx
  on public.onboarding_cohorts (mentor_email);

create index if not exists onboarding_cohorts_status_start_idx
  on public.onboarding_cohorts (status, start_date desc);

------------------------------------------------------------
-- 3) 시드 — 김지나 사원 회차 1건 (시드 메모 5/14 OJT 시작)
------------------------------------------------------------

insert into public.onboarding_cohorts
  (title, trainee_email, mentor_email, start_date, end_date, status, notes, created_at)
values
  ('2026 Q2 신입 OJT — 김지나 (운영2팀)',
   'kjn@jinhakapply.com', 'ys1114@jinhakapply.com',
   '2026-05-14', '2026-05-25', 'in_progress',
   '운영2팀 합류. 첫 주는 OJT, 5/26부터 정상 시프트 투입 예정.',
   '2026-05-10T00:00:00+09:00');

commit;

------------------------------------------------------------
-- 4) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select count(*), status from public.onboarding_cohorts group by status;
-- 기대: in_progress 1
