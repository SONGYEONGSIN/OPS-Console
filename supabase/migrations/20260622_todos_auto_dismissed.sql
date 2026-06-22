-- todos.auto_dismissed 컬럼 추가 — 자동 등록(source_service_id 보유) todo의 soft-delete 표시.
-- 사용자가 자동 등록 항목을 지우면 hard delete 대신 auto_dismissed=true로 마킹 →
-- 동기화 재생성 방지(멱등 존재 체크가 dismissed 포함) + 목록에 '삭제됨'으로 추적.
-- 수동 todo(source 없음)는 종전대로 hard delete.

begin;

alter table public.todos
  add column if not exists auto_dismissed boolean not null default false;

-- 동기화 멱등 조회(source_service_id 존재 여부)와 dismissed 필터에 사용.
create index if not exists todos_auto_dismissed_idx
  on public.todos (auto_dismissed);

commit;

notify pgrst, 'reload schema';
