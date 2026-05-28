-- project_tasks에 checklist jsonb 컬럼 추가
-- 형식: [{ id: uuid, text: string, done: boolean }] 배열
-- 진행률(progress)은 actions.ts에서 (체크 완료 수 / 전체 수) × 100 으로 자동 산출
-- 기존 row는 빈 배열 default — backfill 불필요

begin;

alter table public.project_tasks
  add column if not exists checklist jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';

commit;

-- 검증 쿼리:
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'project_tasks'
--    and column_name = 'checklist';
-- 기대: 1 row | checklist | jsonb | '[]'::jsonb
