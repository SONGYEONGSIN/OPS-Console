-- performance_goals RLS + GRANT
-- 정책:
-- - SELECT: 본인 관련 assignment(evaluator/evaluatee) OR admin
-- - INSERT/UPDATE/DELETE: 해당 assignment의 evaluator OR admin

begin;

alter table public.performance_goals enable row level security;

grant select, insert, update, delete on public.performance_goals to authenticated;
grant all on public.performance_goals to service_role;

drop policy if exists "performance_goals_select_related" on public.performance_goals;
create policy "performance_goals_select_related"
  on public.performance_goals for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and (
          a.evaluator_email = (auth.jwt() ->> 'email')
          or a.evaluatee_email = (auth.jwt() ->> 'email')
        )
    )
  );

drop policy if exists "performance_goals_insert_evaluator" on public.performance_goals;
create policy "performance_goals_insert_evaluator"
  on public.performance_goals for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and a.evaluator_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "performance_goals_update_evaluator" on public.performance_goals;
create policy "performance_goals_update_evaluator"
  on public.performance_goals for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and a.evaluator_email = (auth.jwt() ->> 'email')
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and a.evaluator_email = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "performance_goals_delete_evaluator" on public.performance_goals;
create policy "performance_goals_delete_evaluator"
  on public.performance_goals for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and a.evaluator_email = (auth.jwt() ->> 'email')
    )
  );

commit;

notify pgrst, 'reload schema';
