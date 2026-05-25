-- reports RLS + GRANT
-- select: authenticated 모두 (운영부 공유 자료)
-- insert/update/delete: admin OR member (viewer 제외). server는 service_role 우회.

begin;

alter table public.reports enable row level security;

drop policy if exists "reports_select" on public.reports;
create policy "reports_select"
  on public.reports for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member', 'viewer')
    )
  );

drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert"
  on public.reports for insert
  to authenticated
  with check (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

drop policy if exists "reports_update" on public.reports;
create policy "reports_update"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "reports_delete" on public.reports;
create policy "reports_delete"
  on public.reports for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;

commit;
notify pgrst, 'reload schema';
