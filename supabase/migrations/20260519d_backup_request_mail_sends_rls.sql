-- backup_request_mail_sends RLS + GRANT
-- 정책: SELECT 전원 read (이력 투명성) / INSERT·UPDATE·DELETE admin only
-- 실제 메일 발송 server action은 service_role bypass로 row 적재 (receivables 패턴 일관)

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.backup_request_mail_sends enable row level security;

------------------------------------------------------------
-- 2) select — 전원 read
------------------------------------------------------------

drop policy if exists "backup_request_mail_sends_select_all" on public.backup_request_mail_sends;
create policy "backup_request_mail_sends_select_all"
  on public.backup_request_mail_sends for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert/update/delete — admin only (server action은 service_role bypass)
------------------------------------------------------------

drop policy if exists "backup_request_mail_sends_insert_admin" on public.backup_request_mail_sends;
create policy "backup_request_mail_sends_insert_admin"
  on public.backup_request_mail_sends for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "backup_request_mail_sends_update_admin" on public.backup_request_mail_sends;
create policy "backup_request_mail_sends_update_admin"
  on public.backup_request_mail_sends for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "backup_request_mail_sends_delete_admin" on public.backup_request_mail_sends;
create policy "backup_request_mail_sends_delete_admin"
  on public.backup_request_mail_sends for delete
  to authenticated
  using (public.is_admin());

------------------------------------------------------------
-- 4) GRANT
------------------------------------------------------------

grant select on public.backup_request_mail_sends to authenticated;
grant insert, update, delete on public.backup_request_mail_sends to authenticated;
grant all on public.backup_request_mail_sends to service_role;

commit;

------------------------------------------------------------
-- 5) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'backup_request_mail_sends';
-- 기대: select_all / insert_admin / update_admin / delete_admin (4개)
