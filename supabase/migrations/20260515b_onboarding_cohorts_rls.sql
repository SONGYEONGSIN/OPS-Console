-- onboarding_cohorts RLS + GRANT
-- select: admin OR trainee_email = JWT email OR mentor_email = JWT email
-- insert/update/delete: admin only (단순화 — UI에서도 admin 작성 버튼만)
--
-- OR 풀어쓰기 (CASE는 SQL Editor 파서와 충돌 — 학습된 함정).

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.onboarding_cohorts enable row level security;

------------------------------------------------------------
-- 2) select — admin OR 본인(trainee/mentor)
------------------------------------------------------------

drop policy if exists "onboarding_cohorts_select" on public.onboarding_cohorts;
create policy "onboarding_cohorts_select"
  on public.onboarding_cohorts for select
  to authenticated
  using (
    public.is_admin()
    or trainee_email = (auth.jwt() ->> 'email')
    or mentor_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 3) insert — admin only
------------------------------------------------------------

drop policy if exists "onboarding_cohorts_insert_admin" on public.onboarding_cohorts;
create policy "onboarding_cohorts_insert_admin"
  on public.onboarding_cohorts for insert
  to authenticated
  with check (public.is_admin());

------------------------------------------------------------
-- 4) update — admin only
------------------------------------------------------------

drop policy if exists "onboarding_cohorts_update_admin" on public.onboarding_cohorts;
create policy "onboarding_cohorts_update_admin"
  on public.onboarding_cohorts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

------------------------------------------------------------
-- 5) delete — admin only
------------------------------------------------------------

drop policy if exists "onboarding_cohorts_delete_admin" on public.onboarding_cohorts;
create policy "onboarding_cohorts_delete_admin"
  on public.onboarding_cohorts for delete
  to authenticated
  using (public.is_admin());

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.onboarding_cohorts to authenticated;
grant all on public.onboarding_cohorts to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'onboarding_cohorts';
-- 기대: _select / _insert_admin / _update_admin / _delete_admin (4개)
