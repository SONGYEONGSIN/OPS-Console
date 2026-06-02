-- ai_work — 기능설명(feature_desc) 컬럼 추가.
-- 인스펙터 '요약' 항목 아래에 입력하는 자유 텍스트(선택).
-- 요약(summary_md)은 not null이지만 기능설명은 신규 항목이라 기존 row 호환 위해 nullable.

begin;

alter table public.ai_work
  add column if not exists feature_desc text;

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select column_name from information_schema.columns
--   where table_name = 'ai_work' and column_name = 'feature_desc';  -- → 1건
