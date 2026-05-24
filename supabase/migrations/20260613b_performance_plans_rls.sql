-- performance_plans RLS + GRANT
-- 정책:
-- - SELECT: goal → assignment 본인 관련 OR admin
-- - INSERT/UPDATE/DELETE: 해당 assignment의 evaluatee OR admin

begin;

alter table public.performance_plans enable row level security;

grant select, insert, update, delete on public.performance_plans to authenticated;
grant all on public.performance_plans to service_role;

drop policy if exists "performance_plans_select_related" on public.performance_plans;
create policy "performance_plans_select_related"
  on public.performance_plans for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.performance_goals g
      join public.performance_assignments a on a.id = g.assignment_id
      where g.id = goal_id
        and (
          a.evaluator_email = (auth.jwt() ->> 'email')
          or a.evaluatee_email = (auth.jwt() ->> 'email')
        )
    )
  );

drop policy if exists "performance_plans_insert_evaluatee" on public.performance_plans;
create policy "performance_plans_insert_evaluatee"
  on public.performance_plans for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.performance_goals g
      join public.performance_assignments a on a.id = g.assignment_id
      where g.id = goal_id
        and a.evaluatee_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "performance_plans_update_evaluatee" on public.performance_plans;
create policy "performance_plans_update_evaluatee"
  on public.performance_plans for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.performance_goals g
      join public.performance_assignments a on a.id = g.assignment_id
      where g.id = goal_id
        and a.evaluatee_email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.performance_goals g
      join public.performance_assignments a on a.id = g.assignment_id
      where g.id = goal_id
        and a.evaluatee_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "performance_plans_delete_evaluatee" on public.performance_plans;
create policy "performance_plans_delete_evaluatee"
  on public.performance_plans for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.performance_goals g
      join public.performance_assignments a on a.id = g.assignment_id
      where g.id = goal_id
        and a.evaluatee_email = (auth.jwt() ->> 'email')
    )
  );

commit;

notify pgrst, 'reload schema';
