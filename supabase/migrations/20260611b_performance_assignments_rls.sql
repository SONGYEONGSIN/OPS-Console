-- performance_assignments RLS + GRANT
-- 정책:
-- - SELECT: 본인이 evaluator OR evaluatee OR admin
-- - INSERT: admin only (사이클 시작 시 admin이 매핑 생성)
-- - UPDATE: admin OR evaluator (current_step 전진은 평가자가 검토 시 advance)
-- - DELETE: admin only

begin;

alter table public.performance_assignments enable row level security;

grant select, insert, update, delete on public.performance_assignments to authenticated;
grant all on public.performance_assignments to service_role;

drop policy if exists "performance_assignments_select_related" on public.performance_assignments;
create policy "performance_assignments_select_related"
  on public.performance_assignments for select
  to authenticated
  using (
    public.is_admin()
    or evaluator_email = (auth.jwt() ->> 'email')
    or evaluatee_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "performance_assignments_insert_admin" on public.performance_assignments;
create policy "performance_assignments_insert_admin"
  on public.performance_assignments for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "performance_assignments_update_evaluator_or_admin" on public.performance_assignments;
create policy "performance_assignments_update_evaluator_or_admin"
  on public.performance_assignments for update
  to authenticated
  using (
    public.is_admin()
    or evaluator_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.is_admin()
    or evaluator_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "performance_assignments_delete_admin" on public.performance_assignments;
create policy "performance_assignments_delete_admin"
  on public.performance_assignments for delete
  to authenticated
  using (public.is_admin());

commit;

notify pgrst, 'reload schema';
