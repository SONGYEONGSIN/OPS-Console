-- 정산 — 전형료/계산서 구조화 폼(jsonb 오브젝트). payment_*_md는 폐기 대체.
begin;
alter table public.handover_records
  add column if not exists payment_fee jsonb not null default '{}'::jsonb,
  add column if not exists payment_invoice jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
commit;
