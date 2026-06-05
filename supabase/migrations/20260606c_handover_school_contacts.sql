-- 컨텍(학교담당자) — 구조화 연락처 리스트(jsonb). school_contact_md(자유 텍스트)는 폐기 대체.
begin;
alter table public.handover_records
  add column if not exists school_contacts jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
commit;
