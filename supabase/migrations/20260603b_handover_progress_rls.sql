-- handover_progress RLS — backup_requests / handover_records 패턴 mirror (PR-B)

begin;

alter table public.handover_progress enable row level security;

drop policy if exists "hprog_read_authenticated" on public.handover_progress;
create policy "hprog_read_authenticated"
  on public.handover_progress for select to authenticated using (true);

drop policy if exists "hprog_write_admin_member" on public.handover_progress;
create policy "hprog_write_admin_member"
  on public.handover_progress for insert to authenticated
  with check (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission in ('admin', 'member')
  ));

drop policy if exists "hprog_update_admin_member" on public.handover_progress;
create policy "hprog_update_admin_member"
  on public.handover_progress for update to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission in ('admin', 'member')
  ));

drop policy if exists "hprog_delete_admin" on public.handover_progress;
create policy "hprog_delete_admin"
  on public.handover_progress for delete to authenticated
  using (exists (
    select 1 from public.operators o
    where o.email = auth.jwt() ->> 'email'
      and o.status = 'active'
      and o.permission = 'admin'
  ));

grant select on public.handover_progress to authenticated;
grant insert, update, delete on public.handover_progress to authenticated;
grant all on public.handover_progress to service_role;

notify pgrst, 'reload schema';

commit;
