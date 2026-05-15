-- backup_request_services — 서비스별 백업자 분리 (PR-3)
-- 1명 일괄 백업자(backup_requests.substitute_*)에서 서비스별 독립 백업자로 확장.
-- 기존 row는 backup_requests.substitute_*로 backfill (back-compat).
-- 미지정 시 backup_requests.substitute_*가 default fallback (server action에서 채움).

begin;

------------------------------------------------------------
-- 1) 컬럼 추가 (nullable)
------------------------------------------------------------

alter table public.backup_request_services
  add column if not exists substitute_email text,
  add column if not exists substitute_name  text;

------------------------------------------------------------
-- 2) Backfill — 기존 join row를 parent backup_requests.substitute_*로 채움
------------------------------------------------------------

update public.backup_request_services s
   set substitute_email = b.substitute_email,
       substitute_name  = b.substitute_name
  from public.backup_requests b
 where s.backup_request_id = b.id
   and s.substitute_email is null;

------------------------------------------------------------
-- 3) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 쿼리 (수동):
-- select count(*) filter (where substitute_email is null) as null_count
--   from public.backup_request_services;
-- → 0 이어야 함
