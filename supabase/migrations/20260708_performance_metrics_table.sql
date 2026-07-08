-- 성과지표 (performance_metrics) — assignment당 N개, weight 합=80(정수 points).
-- 정량 소스(source_key) 자동집계 + before/after 수동입력 혼합. 성과리포트 80% 축.
begin;

create table if not exists public.performance_metrics (
  id             uuid primary key default uuid_generate_v4(),
  assignment_id  uuid not null references public.performance_assignments(id) on delete cascade,
  name           text not null,                         -- 지표명 (예: '반복 수동업무 자동화 시간 20% 단축')
  weight         integer not null default 0 check (weight >= 0 and weight <= 80),  -- 가중치 points
  source_key     text,                                  -- aggregators/registry 키 또는 null(수동)
  before_value   numeric,                               -- before/after 수동입력
  after_value    numeric,
  achievement    numeric check (achievement is null or (achievement >= 0 and achievement <= 100)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists performance_metrics_assignment_idx
  on public.performance_metrics (assignment_id);

drop trigger if exists performance_metrics_set_updated_at on public.performance_metrics;
create trigger performance_metrics_set_updated_at
  before update on public.performance_metrics
  for each row execute function public.set_updated_at();

commit;

notify pgrst, 'reload schema';
