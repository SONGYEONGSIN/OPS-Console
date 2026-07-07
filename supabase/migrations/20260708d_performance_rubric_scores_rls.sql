-- performance_rubric_scores RLS + GRANT
-- - SELECT: 본인 관련 assignment(evaluator/evaluatee) OR admin
-- - INSERT/UPDATE/DELETE: 관리자(evaluator) OR admin (팀원은 본인 루브릭 채점 불가)
begin;

alter table public.performance_rubric_scores enable row level security;

grant select, insert, update, delete on public.performance_rubric_scores to authenticated;
grant all on public.performance_rubric_scores to service_role;

create or replace function public._prs_is_evaluator(a_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.performance_assignments a
    where a.id = a_id and a.evaluator_email = (auth.jwt() ->> 'email')
  );
$$;

create or replace function public._prs_is_involved(a_id uuid) returns boolean
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

drop policy if exists "performance_rubric_select_related" on public.performance_rubric_scores;
create policy "performance_rubric_select_related"
  on public.performance_rubric_scores for select to authenticated
  using (public.is_admin() or public._prs_is_involved(assignment_id));

drop policy if exists "performance_rubric_insert_evaluator" on public.performance_rubric_scores;
create policy "performance_rubric_insert_evaluator"
  on public.performance_rubric_scores for insert to authenticated
  with check (public.is_admin() or public._prs_is_evaluator(assignment_id));

drop policy if exists "performance_rubric_update_evaluator" on public.performance_rubric_scores;
create policy "performance_rubric_update_evaluator"
  on public.performance_rubric_scores for update to authenticated
  using (public.is_admin() or public._prs_is_evaluator(assignment_id))
  with check (public.is_admin() or public._prs_is_evaluator(assignment_id));

drop policy if exists "performance_rubric_delete_evaluator" on public.performance_rubric_scores;
create policy "performance_rubric_delete_evaluator"
  on public.performance_rubric_scores for delete to authenticated
  using (public.is_admin() or public._prs_is_evaluator(assignment_id));

commit;

notify pgrst, 'reload schema';
