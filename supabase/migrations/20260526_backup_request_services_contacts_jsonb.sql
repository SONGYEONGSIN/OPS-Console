-- PR-5: backup_request_services.contacts 객체화
-- text[] (라벨 string 배열) → jsonb (contactDetailSchema 객체 배열)
-- 메일/PDF 본문에 이메일·전화 노출 위해 contact row 스냅샷 저장.
-- 운영 데이터 ~1건 (테스트) — backfill 없이 DROP + ADD (PR-4 패턴 동일).

begin;

------------------------------------------------------------
-- 1) 기존 contacts text[] 제거 (PR-4)
------------------------------------------------------------

alter table public.backup_request_services
  drop column if exists contacts;

------------------------------------------------------------
-- 2) 신 contacts jsonb 추가 — 객체 배열
--    형식: [{contact_id, customer_name, university_name, email, phone}]
------------------------------------------------------------

alter table public.backup_request_services
  add column contacts jsonb not null default '[]'::jsonb;

------------------------------------------------------------
-- 3) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 쿼리 (수동):
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'backup_request_services' and column_name = 'contacts';
-- → 1 row: contacts | jsonb
