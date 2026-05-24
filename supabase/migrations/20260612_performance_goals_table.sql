-- 성과리포트 — 목표 (performance_goals)
-- 8단계 중 step=1(목표설정) 산출물. 한 assignment에 N건.
-- weight 합계는 1.0(=100%)이 일반적이나 시스템은 강제 안 함(평가자 책임).

begin;

create table if not exists public.performance_goals (
  id              uuid primary key default uuid_generate_v4(),
  assignment_id   uuid not null references public.performance_assignments(id) on delete cascade,
  title           text not null,
  body            text,
  weight          numeric(4,3) not null default 0
                  check (weight >= 0 and weight <= 1),
  created_at      timestamptz not null default now()
);

create index if not exists performance_goals_assignment_id_idx
  on public.performance_goals (assignment_id);

commit;

notify pgrst, 'reload schema';
