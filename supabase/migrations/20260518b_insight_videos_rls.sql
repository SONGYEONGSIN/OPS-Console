-- insight_videos 테이블 RLS + GRANT
-- 정책: SELECT 전원 read / INSERT·UPDATE·DELETE 정책 없음 → authenticated 차단
-- 쓰기는 service_role (RLS bypass)만 가능 — cron 스크립트가 사용

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.insight_videos enable row level security;

------------------------------------------------------------
-- 2) select — 운영부 전체 read (brainstorm 결정)
------------------------------------------------------------

drop policy if exists "insight_videos_select_all" on public.insight_videos;
create policy "insight_videos_select_all"
  on public.insight_videos for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated는 RLS로 자동 차단
-- service_role은 RLS bypass라 cron 스크립트가 그대로 쓰기 가능

------------------------------------------------------------
-- 3) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select on public.insight_videos to authenticated;
grant all on public.insight_videos to service_role;

commit;

------------------------------------------------------------
-- 4) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'insight_videos';
-- 기대: insight_videos_select_all (1개)
-- select has_table_privilege('authenticated', 'public.insight_videos', 'SELECT');
-- 기대: t
-- select has_table_privilege('authenticated', 'public.insight_videos', 'INSERT');
-- 기대: f
