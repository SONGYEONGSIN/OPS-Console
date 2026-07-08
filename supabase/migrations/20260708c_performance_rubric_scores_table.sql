-- 관리자 루브릭 점수 (performance_rubric_scores) — 성과리포트 20% 축.
-- criterion(태도·문화/협업/문제해결)별 1~5 척도 + 근거 코멘트. assignment×criterion 유니크.
begin;

create table if not exists public.performance_rubric_scores (
  id             uuid primary key default uuid_generate_v4(),
  assignment_id  uuid not null references public.performance_assignments(id) on delete cascade,
  criterion      text not null check (criterion in ('태도·문화', '협업', '문제해결')),
  score          integer not null check (score >= 1 and score <= 5),
  comment        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (assignment_id, criterion)
);

create index if not exists performance_rubric_scores_assignment_idx
  on public.performance_rubric_scores (assignment_id);

drop trigger if exists performance_rubric_scores_set_updated_at on public.performance_rubric_scores;
create trigger performance_rubric_scores_set_updated_at
  before update on public.performance_rubric_scores
  for each row execute function public.set_updated_at();

commit;

notify pgrst, 'reload schema';
