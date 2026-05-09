-- service_role 스크립트(toggle-permission, restore-operator, inspect-user 등) 동작 보장
-- Supabase 새 테이블은 service_role에 명시 GRANT 안 하면 'permission denied' 발생.
-- RLS는 service_role bypass되지만 PostgreSQL 자체 권한은 별개.

grant all on public.operators to service_role;

notify pgrst, 'reload schema';
