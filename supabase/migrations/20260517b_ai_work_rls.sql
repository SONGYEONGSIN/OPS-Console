-- ai_work 테이블 RLS + GRANT
-- 정책: SELECT 전원 read / INSERT·UPDATE·DELETE = admin OR 본인 author
-- posts 패턴 일관 (is_admin() helper 재사용)
-- 주의: OR 조건 풀어쓰기 — CASE 문은 SQL Editor 파서와 충돌 (학습된 함정)

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.ai_work enable row level security;

------------------------------------------------------------
-- 2) select — 운영부 전체 read (brainstorm 결정: 운영부 공개 고정)
------------------------------------------------------------

drop policy if exists "ai_work_select_all" on public.ai_work;
create policy "ai_work_select_all"
  on public.ai_work for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert — admin OR 본인 author
------------------------------------------------------------

drop policy if exists "ai_work_insert" on public.ai_work;
create policy "ai_work_insert"
  on public.ai_work for insert
  to authenticated
  with check (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 4) update — 동일 조건
------------------------------------------------------------

drop policy if exists "ai_work_update" on public.ai_work;
create policy "ai_work_update"
  on public.ai_work for update
  to authenticated
  using (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 5) delete — 동일 조건
------------------------------------------------------------

drop policy if exists "ai_work_delete" on public.ai_work;
create policy "ai_work_delete"
  on public.ai_work for delete
  to authenticated
  using (
    public.is_admin()
    or author_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.ai_work to authenticated;
grant all on public.ai_work to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'ai_work';
-- 기대: ai_work_select_all / _insert / _update / _delete (4개)
-- select has_table_privilege('authenticated', 'public.ai_work', 'INSERT');
-- 기대: t
