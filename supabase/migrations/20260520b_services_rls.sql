-- services RLS — select/insert/update/delete 모두 운영자(admin OR member)
-- viewer는 select만 허용 (read-only 조회). admin/member는 mutation 가능.
-- service_role은 import script 전용 bypass (RLS bypass 권한 보유).

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.services enable row level security;

------------------------------------------------------------
-- 2) Policies
------------------------------------------------------------

-- select: authenticated 전원 (viewer 포함, 운영부 공개 조회)
drop policy if exists services_select_authenticated on public.services;
create policy services_select_authenticated
  on public.services
  for select
  to authenticated
  using (true);

-- insert: admin OR member (viewer 차단)
drop policy if exists services_insert_operator on public.services;
create policy services_insert_operator
  on public.services
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
drop policy if exists services_update_operator on public.services;
create policy services_update_operator
  on public.services
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
drop policy if exists services_delete_operator on public.services;
create policy services_delete_operator
  on public.services
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

grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;

notify pgrst, 'reload schema';

commit;
