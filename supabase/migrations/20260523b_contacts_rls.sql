-- contacts RLS — select authenticated 전원 / insert/update/delete admin OR member (viewer 차단)
-- services RLS(20260520b) 1:1 복제 패턴

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.contacts enable row level security;

------------------------------------------------------------
-- 2) Policies
------------------------------------------------------------

-- select: authenticated 전원 (viewer 포함, 운영부 공개 조회)
drop policy if exists contacts_select_authenticated on public.contacts;
create policy contacts_select_authenticated
  on public.contacts
  for select
  to authenticated
  using (true);

-- insert: admin OR member (viewer 차단)
drop policy if exists contacts_insert_operator on public.contacts;
create policy contacts_insert_operator
  on public.contacts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.operators op
      where op.email = (select auth.jwt() ->> 'email')
        and (op.permission = 'admin' or op.permission = 'member')
    )
  );

-- update: admin OR member
drop policy if exists contacts_update_operator on public.contacts;
create policy contacts_update_operator
  on public.contacts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.operators op
      where op.email = (select auth.jwt() ->> 'email')
        and (op.permission = 'admin' or op.permission = 'member')
    )
  )
  with check (
    exists (
      select 1 from public.operators op
      where op.email = (select auth.jwt() ->> 'email')
        and (op.permission = 'admin' or op.permission = 'member')
    )
  );

-- delete: admin OR member
drop policy if exists contacts_delete_operator on public.contacts;
create policy contacts_delete_operator
  on public.contacts
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.operators op
      where op.email = (select auth.jwt() ->> 'email')
        and (op.permission = 'admin' or op.permission = 'member')
    )
  );

------------------------------------------------------------
-- 3) GRANT
------------------------------------------------------------

grant select, insert, update, delete on public.contacts to authenticated;
grant all on public.contacts to service_role;

notify pgrst, 'reload schema';

commit;
