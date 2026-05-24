-- performance_reviews RLS + GRANT
-- 정책:
-- - SELECT: assignment 본인 관련(evaluator/evaluatee) OR admin
-- - INSERT 가드: step×role 매트릭스 + 해당 role의 본인만
--     step=3,5,7 → evaluator (assignment.evaluator_email = jwt email)
--     step=4,6   → evaluatee (assignment.evaluatee_email = jwt email)
-- - UPDATE/DELETE: 작성한 본인 role + 해당 assignment
--
-- (테이블 check constraint로 step×role 자체 정합은 이미 강제됨.
--  RLS는 추가로 jwt email = 해당 role email인지 확인)

begin;

alter table public.performance_reviews enable row level security;

grant select, insert, update, delete on public.performance_reviews to authenticated;
grant all on public.performance_reviews to service_role;

drop policy if exists "performance_reviews_select_related" on public.performance_reviews;
create policy "performance_reviews_select_related"
  on public.performance_reviews for select
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

drop policy if exists "performance_reviews_insert_role_match" on public.performance_reviews;
create policy "performance_reviews_insert_role_match"
  on public.performance_reviews for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and (
          (role = 'evaluator' and a.evaluator_email = (auth.jwt() ->> 'email'))
          or (role = 'evaluatee' and a.evaluatee_email = (auth.jwt() ->> 'email'))
        )
    )
  );

drop policy if exists "performance_reviews_update_self" on public.performance_reviews;
create policy "performance_reviews_update_self"
  on public.performance_reviews for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and (
          (role = 'evaluator' and a.evaluator_email = (auth.jwt() ->> 'email'))
          or (role = 'evaluatee' and a.evaluatee_email = (auth.jwt() ->> 'email'))
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and (
          (role = 'evaluator' and a.evaluator_email = (auth.jwt() ->> 'email'))
          or (role = 'evaluatee' and a.evaluatee_email = (auth.jwt() ->> 'email'))
        )
    )
  );

drop policy if exists "performance_reviews_delete_self" on public.performance_reviews;
create policy "performance_reviews_delete_self"
  on public.performance_reviews for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.performance_assignments a
      where a.id = assignment_id
        and (
          (role = 'evaluator' and a.evaluator_email = (auth.jwt() ->> 'email'))
          or (role = 'evaluatee' and a.evaluatee_email = (auth.jwt() ->> 'email'))
        )
    )
  );

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies
--   where tablename = 'performance_reviews' order by 1, 2;
-- 기대: 4행 (select / insert / update / delete)
