-- todos: my-todo 재설계 (Weekly Planner) 위한 메타 컬럼 추가 + 폐기 컬럼 정리
-- 추가: category(자유 입력 string) / progress(0..100) / status(enum)
-- 제거: source_service_id (services 기반 D-60 planner 흐름 폐기)
-- 호환성: 새 컬럼은 모두 nullable → 기존 데이터 무손상.
-- 사전 검증: source_service_id NOT NULL row 0건 확정 (scripts/todos-source-service-count.mjs)

begin;

------------------------------------------------------------
-- 1) 신규 컬럼 추가 (nullable)
------------------------------------------------------------

alter table public.todos
  add column if not exists category text;

alter table public.todos
  add column if not exists progress smallint
    check (progress is null or progress between 0 and 100);

alter table public.todos
  add column if not exists status text
    check (status is null or status in ('todo', 'in_progress', 'done', 'blocked'));

------------------------------------------------------------
-- 2) source_service_id 폐기 (FK + column + index)
------------------------------------------------------------

drop index if exists public.todos_source_service_id_idx;

alter table public.todos
  drop column if exists source_service_id;

commit;

notify pgrst, 'reload schema';
