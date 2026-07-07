-- performance_metrics RLS + GRANT
-- - SELECT: 본인 관련 assignment(evaluator/evaluatee) OR admin
-- - INSERT/UPDATE/DELETE: 관련 당사자(evaluator OR evaluatee) OR admin
--   (팀원이 지표·가중치 작성, 관리자가 달성률 보정 — 협업)
begin;

alter table public.performance_metrics enable row level security;

grant select, insert, update, delete on public.performance_metrics to authenticated;
grant all on public.performance_metrics to service_role;

create or replace function public._pm_is_involved(a_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.performance_assignments a
    where a.id = a_id
      and (
        a.evaluator_email = (auth.jwt() ->> 'email')
        or a.evaluatee_email = (auth.jwt() ->> 'email')
      )
  );
$$;

drop policy if exists "performance_metrics_select_related" on public.performance_metrics;
create policy "performance_metrics_select_related"
  on public.performance_metrics for select to authenticated
  using (public.is_admin() or public._pm_is_involved(assignment_id));

drop policy if exists "performance_metrics_insert_involved" on public.performance_metrics;
create policy "performance_metrics_insert_involved"
  on public.performance_metrics for insert to authenticated
  with check (public.is_admin() or public._pm_is_involved(assignment_id));

drop policy if exists "performance_metrics_update_involved" on public.performance_metrics;
create policy "performance_metrics_update_involved"
  on public.performance_metrics for update to authenticated
  using (public.is_admin() or public._pm_is_involved(assignment_id))
  with check (public.is_admin() or public._pm_is_involved(assignment_id));

drop policy if exists "performance_metrics_delete_involved" on public.performance_metrics;
create policy "performance_metrics_delete_involved"
  on public.performance_metrics for delete to authenticated
  using (public.is_admin() or public._pm_is_involved(assignment_id));

commit;

notify pgrst, 'reload schema';
