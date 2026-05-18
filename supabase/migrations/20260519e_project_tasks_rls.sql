-- project_tasks 테이블 RLS + GRANT
-- 정책: parent projects의 created_by_email = JWT email OR is_admin()
-- EXISTS subquery로 parent 권한 위임 (자식 row는 부모 권한을 상속)
-- v1 데이터량 작아 subquery 성능 무시. scale 시 비정규화 옵션 고려.

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.project_tasks enable row level security;

------------------------------------------------------------
-- 2) select — parent project 본인 또는 admin
------------------------------------------------------------

drop policy if exists "project_tasks_select_own_or_admin" on public.project_tasks;
create policy "project_tasks_select_own_or_admin"
  on public.project_tasks for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id
        and p.created_by_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 3) insert — parent project 본인 또는 admin (with check)
------------------------------------------------------------

drop policy if exists "project_tasks_insert_own_or_admin" on public.project_tasks;
create policy "project_tasks_insert_own_or_admin"
  on public.project_tasks for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id
        and p.created_by_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 4) update — 동일
------------------------------------------------------------

drop policy if exists "project_tasks_update_own_or_admin" on public.project_tasks;
create policy "project_tasks_update_own_or_admin"
  on public.project_tasks for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id
        and p.created_by_email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id
        and p.created_by_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 5) delete — 동일
------------------------------------------------------------

drop policy if exists "project_tasks_delete_own_or_admin" on public.project_tasks;
create policy "project_tasks_delete_own_or_admin"
  on public.project_tasks for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id
        and p.created_by_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 6) GRANT
------------------------------------------------------------

grant select, insert, update, delete on public.project_tasks to authenticated;
grant all on public.project_tasks to service_role;

commit;

notify pgrst, 'reload schema';
