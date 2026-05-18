-- handover_records RLS — backup_requests 패턴 mirror (PR-8 PR-A)

begin;

alter table public.handover_records enable row level security;

drop policy if exists "handover_read_authenticated" on public.handover_records;
create policy "handover_read_authenticated"
  on public.handover_records for select to authenticated using (true);

drop policy if exists "handover_write_admin_member" on public.handover_records;
create policy "handover_write_admin_member"
  on public.handover_records for insert to authenticated
  with check (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission in ('admin', 'member')
  ));

drop policy if exists "handover_update_admin_member" on public.handover_records;
create policy "handover_update_admin_member"
  on public.handover_records for update to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission in ('admin', 'member')
  ));

drop policy if exists "handover_delete_admin" on public.handover_records;
create policy "handover_delete_admin"
  on public.handover_records for delete to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission = 'admin'
  ));

grant select on public.handover_records to authenticated;
grant insert, update, delete on public.handover_records to authenticated;
grant all on public.handover_records to service_role;

notify pgrst, 'reload schema';

commit;
