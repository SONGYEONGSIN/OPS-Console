-- 목표 기반 성과 리포트 — 목표를 담을 자리.
--
-- 지금까지 달성률(`achievement`)은 **사람이 손으로 넣는 값**이었다. 목표값이 없어서
-- 계산할 근거가 없었다 — "목표 기반"이 성립하지 않았다.

alter table public.performance_metrics
  -- 이 지표의 목표. 실적/목표로 달성률이 저절로 나온다.
  add column if not exists target_value numeric,
  -- 건·시간·% 등. 숫자만 있으면 무엇을 세는지 모른다.
  add column if not exists unit text,
  -- 줄이는 게 목표인 지표가 있다(사고 건수·처리 시간). 그때는 적을수록 잘한 것이다.
  add column if not exists lower_is_better boolean not null default false;

-- 사이클에 기간이 없어 집계가 연도를 하드코딩(1/1~12/31)하고 있었다.
-- 우리 성과 기간은 학년도(3/1 ~ 익년 2월말)라 그대로는 맞지 않는다.
alter table public.performance_cycles
  add column if not exists period_start date,
  add column if not exists period_end date;

-- 조직 목표 — 본부/팀 단위. 개인 목표를 여기서 분해한다.
--
-- 개인 목표(performance_goals)는 assignment 에 매달려 있어 "팀 전체가 무엇을
-- 목표로 하는가"를 담을 수 없었다. 별도 표인 이유가 그것이다.
create table if not exists public.performance_org_goals (
  id uuid primary key default gen_random_uuid(),
  -- 본부인지 팀인지. 개인은 performance_goals 가 담는다.
  scope text not null check (scope in ('division', 'team')),
  -- scope='team' 이면 팀 이름, 'division' 이면 본부 이름.
  owner_name text not null,
  period_start date not null,
  period_end date not null,
  title text not null,
  target_value numeric,
  unit text,
  -- 집계로 실적을 낼 수 있으면 aggregators/registry 의 키.
  source_key text,
  lower_is_better boolean not null default false,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.performance_org_goals enable row level security;

-- 조직 목표는 팀 전체가 본다 — 숨길 이유가 없고, 가려 두면 아무도 안 본다.
drop policy if exists performance_org_goals_read on public.performance_org_goals;
create policy performance_org_goals_read on public.performance_org_goals
  for select to authenticated using (true);

-- 쓰기는 서버(admin)만. 목표는 아무나 고치면 안 된다.
drop policy if exists performance_org_goals_service on public.performance_org_goals;
create policy performance_org_goals_service on public.performance_org_goals
  for all to service_role using (true) with check (true);

-- **GRANT 를 빼면 RLS 를 통과해도 42501 로 막힌다.** 정책과 권한은 다른 것이다.
grant select on public.performance_org_goals to authenticated;
grant all on public.performance_org_goals to service_role;

create index if not exists performance_org_goals_period_idx
  on public.performance_org_goals (period_start, period_end);
