-- 계약정보 — 구조화 폼(jsonb 오브젝트: title/type/progress/status/memo). contract_info_md는 폐기 대체.
begin;
alter table public.handover_records
  add column if not exists contract_info jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
commit;
