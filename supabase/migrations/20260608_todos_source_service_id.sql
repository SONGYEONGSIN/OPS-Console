-- todos.source_service_id 컬럼 추가 — services 기반 자동 todo 등록 시 services.id link.
-- nullable: 자유 todo는 source 없음 (services와 무관)
-- on delete set null: services 삭제 시 todos 보존, link만 끊김

begin;

alter table public.todos
  add column if not exists source_service_id uuid
    references public.services(id) on delete set null;

create index if not exists todos_source_service_id_idx
  on public.todos (source_service_id);

commit;

notify pgrst, 'reload schema';
