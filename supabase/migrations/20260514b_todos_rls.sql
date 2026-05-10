-- todos 테이블 RLS + GRANT
-- 정책: 본인 only — assignee_email = JWT email OR is_admin() (admin overview 허용)
-- 모든 작업(select/insert/update/delete) 동일 조건. is_admin() plpgsql helper 재사용.
-- OR 풀어쓰기 — CASE는 SQL Editor 파서와 충돌 (학습된 함정).

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.todos enable row level security;

------------------------------------------------------------
-- 2) select — 본인 OR admin
------------------------------------------------------------

drop policy if exists "todos_select_own_or_admin" on public.todos;
create policy "todos_select_own_or_admin"
  on public.todos for select
  to authenticated
  using (
    assignee_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );

------------------------------------------------------------
-- 3) insert — 본인 OR admin
------------------------------------------------------------

drop policy if exists "todos_insert_own_or_admin" on public.todos;
create policy "todos_insert_own_or_admin"
  on public.todos for insert
  to authenticated
  with check (
    assignee_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );

------------------------------------------------------------
-- 4) update — 본인 OR admin
------------------------------------------------------------

drop policy if exists "todos_update_own_or_admin" on public.todos;
create policy "todos_update_own_or_admin"
  on public.todos for update
  to authenticated
  using (
    assignee_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  )
  with check (
    assignee_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );

------------------------------------------------------------
-- 5) delete — 본인 OR admin
------------------------------------------------------------

drop policy if exists "todos_delete_own_or_admin" on public.todos;
create policy "todos_delete_own_or_admin"
  on public.todos for delete
  to authenticated
  using (
    assignee_email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.todos to authenticated;
grant all on public.todos to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'todos';
-- 기대: todos_select_own_or_admin / _insert / _update / _delete (4개)
