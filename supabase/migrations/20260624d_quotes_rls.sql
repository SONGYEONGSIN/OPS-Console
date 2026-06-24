-- quotes RLS — read 전원 / insert·update admin·member / delete admin
begin;

alter table public.quotes enable row level security;

drop policy if exists "quotes_read_authenticated" on public.quotes;
create policy "quotes_read_authenticated"
  on public.quotes for select to authenticated using (true);

drop policy if exists "quotes_write_admin_member" on public.quotes;
create policy "quotes_write_admin_member"
  on public.quotes for insert to authenticated
  with check (
    exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission in ('admin', 'member')
    )
  );

drop policy if exists "quotes_update_admin_member" on public.quotes;
create policy "quotes_update_admin_member"
  on public.quotes for update to authenticated
  using (
    exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission in ('admin', 'member')
    )
  );

drop policy if exists "quotes_delete_admin" on public.quotes;
create policy "quotes_delete_admin"
  on public.quotes for delete to authenticated
  using (
    exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission = 'admin'
    )
  );

grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;

notify pgrst, 'reload schema';

commit;
