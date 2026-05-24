-- 성과리포트 — 검토/점검/평가 (performance_reviews)
-- 8단계 중 step=3..7의 모든 검토·점검·평가 row를 담는 단일 테이블.
-- step=3 계획검토 (evaluator)
-- step=4 중간점검 (evaluatee)
-- step=5 점검검토 (evaluator)
-- step=6 자기평가 (evaluatee)
-- step=7 종합평가 (evaluator)  — grade_performance / grade_competency 입력
--
-- 등급 S/A/B/C/D × 2축(성과평가 / 역량평가) — 종합평가 단계에서만 채워짐.

begin;

create table if not exists public.performance_reviews (
  id                  uuid primary key default uuid_generate_v4(),
  assignment_id       uuid not null references public.performance_assignments(id) on delete cascade,
  step                smallint not null check (step in (3, 4, 5, 6, 7)),
  role                text not null check (role in ('evaluator', 'evaluatee')),
  body                text,
  score               numeric(5,2) null,
  grade_performance   text null check (grade_performance in ('S','A','B','C','D')),
  grade_competency    text null check (grade_competency in ('S','A','B','C','D')),
  created_at          timestamptz not null default now(),
  -- step×role 정합: 짝수 step(4,6) = evaluatee, 홀수 step(3,5,7) = evaluator
  constraint performance_reviews_step_role_match
    check (
      (step in (3, 5, 7) and role = 'evaluator')
      or (step in (4, 6) and role = 'evaluatee')
    ),
  -- grade는 step=7 종합평가에서만 의미 있음
  constraint performance_reviews_grade_step
    check (
      (step = 7) or (grade_performance is null and grade_competency is null)
    )
);

create index if not exists performance_reviews_assignment_id_idx
  on public.performance_reviews (assignment_id);

create index if not exists performance_reviews_step_idx
  on public.performance_reviews (step);

commit;

notify pgrst, 'reload schema';
