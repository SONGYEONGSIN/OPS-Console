-- 계약자료 체크리스트 — 필요 계약서류 체크 항목(jsonb). contract_data_md는 메모로 유지.
begin;
alter table public.handover_records
  add column if not exists contract_data_checklist jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
commit;
