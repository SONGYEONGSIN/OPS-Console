-- incidents RLS — backup_requests 패턴 mirror (PR-6)
-- authenticated read 모두 / write admin·member / delete admin

begin;

alter table public.incidents enable row level security;

------------------------------------------------------------
-- 정책
------------------------------------------------------------

drop policy if exists "incidents_read_authenticated" on public.incidents;
create policy "incidents_read_authenticated"
  on public.incidents for select to authenticated using (true);

drop policy if exists "incidents_write_admin_member" on public.incidents;
create policy "incidents_write_admin_member"
  on public.incidents for insert to authenticated
  with check (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission in ('admin', 'member')
  ));

drop policy if exists "incidents_update_admin_member" on public.incidents;
create policy "incidents_update_admin_member"
  on public.incidents for update to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission in ('admin', 'member')
  ));

drop policy if exists "incidents_delete_admin" on public.incidents;
create policy "incidents_delete_admin"
  on public.incidents for delete to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission = 'admin'
  ));

------------------------------------------------------------
-- GRANT (RLS와 별개로 PostgREST 통과용)
------------------------------------------------------------

grant select on public.incidents to authenticated;
grant insert, update, delete on public.incidents to authenticated;
grant all on public.incidents to service_role;

------------------------------------------------------------
-- PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- 1) viewer 권한 사용자로 INSERT 시도 → RLS 차단
-- 2) admin/member로 INSERT → OK
-- 3) admin/member SELECT 모두 → OK (전원 가시)
