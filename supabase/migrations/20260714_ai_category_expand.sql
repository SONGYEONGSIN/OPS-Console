-- ai_work / ai_tips category CHECK 확장 — productivity(생산성), devtool(개발도구) 추가
-- 기존 값은 그대로 허용 (하위호환 확장)

alter table public.ai_work
  drop constraint if exists ai_work_category_check;

alter table public.ai_work
  add constraint ai_work_category_check
  check (category in (
    'code', 'doc', 'analysis', 'design',
    'translation', 'meeting', 'automation',
    'productivity', 'devtool', 'etc'
  ));

alter table public.ai_tips
  drop constraint if exists ai_tips_category_check;

alter table public.ai_tips
  add constraint ai_tips_category_check
  check (category in (
    'code', 'doc', 'analysis', 'design',
    'translation', 'meeting', 'automation',
    'productivity', 'devtool', 'etc'
  ));

-- 검증 (SQL Editor에서 실행 후 확인):
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname in ('ai_work_category_check', 'ai_tips_category_check');
-- 기대: 두 제약 모두 productivity, devtool 포함
