-- backup_request_services — 서비스 단위 재구조화
-- backup_request_services에 contacts text[] + note_md text 추가.
-- backup_requests.contacts text[]는 서비스로 이전 후 DROP (운영 데이터 0건이라 backfill 없음).

begin;

------------------------------------------------------------
-- 1) backup_request_services 컬럼 추가 (nullable / default '{}')
------------------------------------------------------------

alter table public.backup_request_services
  add column if not exists note_md text,
  add column if not exists contacts text[] not null default '{}';

------------------------------------------------------------
-- 2) backup_requests.contacts 제거 (서비스 단위로 이전)
------------------------------------------------------------

alter table public.backup_requests
  drop column if exists contacts;

------------------------------------------------------------
-- 3) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 쿼리 (수동):
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'backup_requests' and column_name = 'contacts';
-- → 0 row (DROP 확인)
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'backup_request_services'
--    and column_name in ('note_md','contacts');
-- → 2 row
