-- news 테이블 RLS + GRANT
-- 정책: SELECT 전원 read / INSERT·UPDATE·DELETE 정책 없음 → authenticated 차단
-- 쓰기는 service_role (RLS bypass)만 가능 — news-collect 잡이 사용

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.news enable row level security;

------------------------------------------------------------
-- 2) select — 운영부 전체 read
------------------------------------------------------------

drop policy if exists "news_select_all" on public.news;
create policy "news_select_all"
  on public.news for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated는 RLS로 자동 차단
-- service_role은 RLS bypass라 news-collect 잡이 그대로 쓰기 가능

------------------------------------------------------------
-- 3) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select on public.news to authenticated;
grant all on public.news to service_role;

commit;

------------------------------------------------------------
-- 4) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'news';
-- 기대: news_select_all (1개)
-- select has_table_privilege('authenticated', 'public.news', 'SELECT');  -- 기대: t
-- select has_table_privilege('authenticated', 'public.news', 'INSERT');  -- 기대: f
