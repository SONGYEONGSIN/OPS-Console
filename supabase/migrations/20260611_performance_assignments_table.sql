-- 성과리포트 — 평가 배정 (performance_assignments)
-- 사이클 안에서 (evaluator, evaluatee) 쌍이 진행하는 8단계 워크플로우 단위.
-- current_step 1..8 (1=목표설정, 2=실행계획, 3=계획검토, 4=중간점검,
--                    5=점검검토, 6=자기평가, 7=종합평가, 8=완료).

begin;

create table if not exists public.performance_assignments (
  id                uuid primary key default uuid_generate_v4(),
  cycle_id          uuid not null references public.performance_cycles(id) on delete cascade,
  evaluator_email   text not null,                                    -- 평가자 (팀장/부장)
  evaluatee_email   text not null,                                    -- 팀원 (운영자)
  current_step      smallint not null default 1
                    check (current_step between 1 and 8),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint performance_assignments_pair_unique
    unique (cycle_id, evaluatee_email)
);

-- updated_at 자동
drop trigger if exists performance_assignments_set_updated_at on public.performance_assignments;
create trigger performance_assignments_set_updated_at
before update on public.performance_assignments
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 인덱스
------------------------------------------------------------

create index if not exists performance_assignments_cycle_id_idx
  on public.performance_assignments (cycle_id);

create index if not exists performance_assignments_evaluator_email_idx
  on public.performance_assignments (evaluator_email);

create index if not exists performance_assignments_evaluatee_email_idx
  on public.performance_assignments (evaluatee_email);

create index if not exists performance_assignments_current_step_idx
  on public.performance_assignments (current_step);

commit;

notify pgrst, 'reload schema';
