-- receivables_operator_mail_sends RLS + GRANT
-- select: admin OR member  (이력 조회는 admin/member 가능, viewer 차단)
-- insert/update/delete: admin only  (단, server action은 service_role로 우회하여 insert)

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.receivables_operator_mail_sends enable row level security;

------------------------------------------------------------
-- 2) select — admin OR member
------------------------------------------------------------

drop policy if exists "receivables_operator_mail_sends_select" on public.receivables_operator_mail_sends;
create policy "receivables_operator_mail_sends_select"
  on public.receivables_operator_mail_sends for select
  to authenticated
  using (
    exists (
      select 1
      from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

------------------------------------------------------------
-- 3) insert — admin only
------------------------------------------------------------

drop policy if exists "receivables_operator_mail_sends_insert_admin" on public.receivables_operator_mail_sends;
create policy "receivables_operator_mail_sends_insert_admin"
  on public.receivables_operator_mail_sends for insert
  to authenticated
  with check (public.is_admin());

------------------------------------------------------------
-- 4) update — admin only
------------------------------------------------------------

drop policy if exists "receivables_operator_mail_sends_update_admin" on public.receivables_operator_mail_sends;
create policy "receivables_operator_mail_sends_update_admin"
  on public.receivables_operator_mail_sends for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

------------------------------------------------------------
-- 5) delete — admin only
------------------------------------------------------------

drop policy if exists "receivables_operator_mail_sends_delete_admin" on public.receivables_operator_mail_sends;
create policy "receivables_operator_mail_sends_delete_admin"
  on public.receivables_operator_mail_sends for delete
  to authenticated
  using (public.is_admin());

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501 회피)
------------------------------------------------------------

grant select, insert, update, delete on public.receivables_operator_mail_sends to authenticated;
grant all on public.receivables_operator_mail_sends to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'receivables_operator_mail_sends';
-- 기대: _select / _insert_admin / _update_admin / _delete_admin (4건)
