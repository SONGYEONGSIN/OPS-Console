-- 성과리포트 — 실행계획 (performance_plans)
-- 8단계 중 step=2(실행계획) 산출물. goal 1건 ↔ plan 1건.

begin;

create table if not exists public.performance_plans (
  id          uuid primary key default uuid_generate_v4(),
  goal_id     uuid not null references public.performance_goals(id) on delete cascade,
  body        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint performance_plans_goal_unique unique (goal_id)
);

drop trigger if exists performance_plans_set_updated_at on public.performance_plans;
create trigger performance_plans_set_updated_at
before update on public.performance_plans
for each row execute function public.set_updated_at();

create index if not exists performance_plans_goal_id_idx
  on public.performance_plans (goal_id);

commit;

notify pgrst, 'reload schema';
