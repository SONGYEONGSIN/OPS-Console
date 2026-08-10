-- ai_work — 공동작업자(collaborator_emails) 컬럼 추가.
-- 함께 작업한 운영자를 이메일 배열로 남긴다. 표시 전용이라 RLS 변경 없음.
-- 이름이 아니라 이메일을 저장하는 이유: 이름은 바뀌고 이메일은 안 바뀐다(author_email과 동일 규칙).
-- not null default '{}' — 기존 row는 빈 배열('없음')이 되어 백필이 필요 없다.

begin;

alter table public.ai_work
  add column if not exists collaborator_emails text[] not null default '{}';

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_name = 'ai_work' and column_name = 'collaborator_emails';
-- 기대: 1건 / ARRAY / NO
