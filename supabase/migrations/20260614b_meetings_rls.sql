-- meetings RLS + GRANT. read 전원 / insert 전원 / update·delete 작성자 본인 또는 admin operator.

begin;

alter table public.meetings enable row level security;

drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings
  for select to authenticated using (true);

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert to authenticated with check (true);

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings
  for update to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email' and o.permission = 'admin'
    )
  );

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings
  for delete to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email' and o.permission = 'admin'
    )
  );

grant select, insert, update, delete on public.meetings to authenticated;

notify pgrst, 'reload schema';

commit;
