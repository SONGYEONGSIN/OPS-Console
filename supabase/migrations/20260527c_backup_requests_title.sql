-- PR-7: backup_requests.title — 사용자가 EditForm에서 수정 가능한 제목 저장 컬럼.
-- 이전: page.tsx의 deriveTitle()로 매번 derive → 수정해도 저장 안 됨.
-- 이후: title 컬럼에 저장. NULL이면 deriveTitle fallback.

begin;

alter table public.backup_requests
  add column if not exists title text;

notify pgrst, 'reload schema';

commit;

-- 검증:
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='backup_requests' and column_name='title';
-- → 1 row: title | text
