-- 서류제출 체크리스트 — 제출서류 체크 항목(jsonb). docs_md는 메모로 유지.
begin;
alter table public.handover_records
  add column if not exists docs_checklist jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
commit;
