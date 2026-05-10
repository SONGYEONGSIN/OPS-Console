-- posts 테이블 RLS + GRANT
-- 정책: 모두 read / notice = admin only insert·update·delete / feedback = admin or 본인 author
-- 기존 is_admin() plpgsql helper 재사용 (operators 마이그레이션 20260510b).
--
-- 주의: 도메인 분기는 OR 조건으로 풀어쓴다 (CASE 문은 Supabase SQL Editor 파서와 충돌).
--   조건: public.is_admin() OR (domain='feedback' AND author_email = JWT email)
--   → notice는 admin만 통과 (feedback 분기는 false), feedback은 admin OR 본인 author.

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.posts enable row level security;

------------------------------------------------------------
-- 2) select — 모두 read 가능
------------------------------------------------------------

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert — admin OR (feedback + 본인 author)
------------------------------------------------------------

drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert"
  on public.posts for insert
  to authenticated
  with check (
    public.is_admin()
    or (domain = 'feedback' and author_email = (auth.jwt() ->> 'email'))
  );

------------------------------------------------------------
-- 4) update — 동일 조건
------------------------------------------------------------

drop policy if exists "posts_update" on public.posts;
create policy "posts_update"
  on public.posts for update
  to authenticated
  using (
    public.is_admin()
    or (domain = 'feedback' and author_email = (auth.jwt() ->> 'email'))
  )
  with check (
    public.is_admin()
    or (domain = 'feedback' and author_email = (auth.jwt() ->> 'email'))
  );

------------------------------------------------------------
-- 5) delete — 동일 조건
------------------------------------------------------------

drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete"
  on public.posts for delete
  to authenticated
  using (
    public.is_admin()
    or (domain = 'feedback' and author_email = (auth.jwt() ->> 'email'))
  );

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'posts';
-- 기대: posts_select_all / posts_insert / posts_update / posts_delete (4개)
