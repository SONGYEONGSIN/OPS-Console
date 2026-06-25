-- 견적서 문서 양식(Phase 2) — 유형 + 문서 jsonb
begin;
alter table public.quotes
  add column if not exists quote_type text not null default 'dev',
  add column if not exists document jsonb;
commit;
notify pgrst, 'reload schema';
