-- 운영부 조직구성 테이블 GRANT 추가 (permission denied 42501 해결)
--
-- Supabase Dashboard SQL Editor에서 실행:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql

-- RLS 정책은 이미 있지만 PostgreSQL GRANT가 없으면 authenticated role이
-- 테이블에 접근 자체를 못 함. 두 가지 모두 필요.

grant usage on schema public to authenticated, anon;
grant select, insert, update on public.operators to authenticated;
grant usage, select on all sequences in schema public to authenticated;
