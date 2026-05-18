-- projects 테이블 RLS + GRANT
-- 정책: 본인 only — created_by_email = JWT email OR is_admin()
-- my-todo 재설계 v1: 프로젝트 공유 X (다른 사용자 row 안 보임)
-- is_admin() helper: operators 마이그 20260510b에 정의됨

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.projects enable row level security;

------------------------------------------------------------
-- 2) select — 본인 또는 admin
------------------------------------------------------------

drop policy if exists "projects_select_own_or_admin" on public.projects;
create policy "projects_select_own_or_admin"
  on public.projects for select
  to authenticated
  using (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 3) insert — 본인 강제 (created_by_email = JWT email) 또는 admin
------------------------------------------------------------

drop policy if exists "projects_insert_own_or_admin" on public.projects;
create policy "projects_insert_own_or_admin"
  on public.projects for insert
  to authenticated
  with check (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 4) update — 본인 또는 admin
------------------------------------------------------------

drop policy if exists "projects_update_own_or_admin" on public.projects;
create policy "projects_update_own_or_admin"
  on public.projects for update
  to authenticated
  using (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 5) delete — 본인 또는 admin
------------------------------------------------------------

drop policy if exists "projects_delete_own_or_admin" on public.projects;
create policy "projects_delete_own_or_admin"
  on public.projects for delete
  to authenticated
  using (
    public.is_admin()
    or created_by_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 6) GRANT
------------------------------------------------------------

grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;

commit;

notify pgrst, 'reload schema';
