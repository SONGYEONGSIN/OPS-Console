-- onboarding_checklist_items RLS.
-- read: authenticated 모두 (trainee/mentor/admin 공통). 어차피 onboarding_cohorts도 동일 정책.
-- insert/update: 본인 cohort(trainee_email=me) 또는 admin
-- delete: admin만

begin;

alter table public.onboarding_checklist_items enable row level security;

drop policy if exists "ocli_read_authenticated" on public.onboarding_checklist_items;
create policy "ocli_read_authenticated"
  on public.onboarding_checklist_items for select to authenticated using (true);

drop policy if exists "ocli_insert_own_or_admin" on public.onboarding_checklist_items;
create policy "ocli_insert_own_or_admin"
  on public.onboarding_checklist_items for insert to authenticated
  with check (
    exists (
      select 1 from public.onboarding_cohorts c
      where c.id = onboarding_checklist_items.cohort_id
        and c.trainee_email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission = 'admin'
    )
  );

drop policy if exists "ocli_update_own_or_admin" on public.onboarding_checklist_items;
create policy "ocli_update_own_or_admin"
  on public.onboarding_checklist_items for update to authenticated
  using (
    exists (
      select 1 from public.onboarding_cohorts c
      where c.id = onboarding_checklist_items.cohort_id
        and c.trainee_email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission = 'admin'
    )
  );

drop policy if exists "ocli_delete_admin" on public.onboarding_checklist_items;
create policy "ocli_delete_admin"
  on public.onboarding_checklist_items for delete to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission = 'admin'
  ));

grant select on public.onboarding_checklist_items to authenticated;
grant insert, update, delete on public.onboarding_checklist_items to authenticated;
grant all on public.onboarding_checklist_items to service_role;

notify pgrst, 'reload schema';

commit;
