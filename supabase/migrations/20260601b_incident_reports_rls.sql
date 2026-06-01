-- incident_reports RLS + GRANT
-- 정책: SELECT/INSERT 전원 authenticated (작성 자유)
--       UPDATE 작성자(author)·결재자(approver) 본인 또는 admin operator
--       DELETE 작성자 본인 또는 admin operator
-- 실제 메일 발송/서버 작업은 service_role bypass로 처리 (incidents 패턴 일관)

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.incident_reports enable row level security;

------------------------------------------------------------
-- 2) select — 전원 read
------------------------------------------------------------

drop policy if exists incident_reports_read on public.incident_reports;
create policy incident_reports_read on public.incident_reports
  for select to authenticated using (true);

------------------------------------------------------------
-- 3) insert — 전원 작성
------------------------------------------------------------

drop policy if exists incident_reports_insert on public.incident_reports;
create policy incident_reports_insert on public.incident_reports
  for insert to authenticated with check (true);

------------------------------------------------------------
-- 4) update — author·approver 본인 또는 admin
------------------------------------------------------------

drop policy if exists incident_reports_update on public.incident_reports;
create policy incident_reports_update on public.incident_reports
  for update to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or approver_email = auth.jwt() ->> 'email'
    or exists (select 1 from public.operators o where o.email = auth.jwt() ->> 'email' and o.permission = 'admin')
  );

------------------------------------------------------------
-- 5) delete — author 본인 또는 admin
------------------------------------------------------------

drop policy if exists incident_reports_delete on public.incident_reports;
create policy incident_reports_delete on public.incident_reports
  for delete to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (select 1 from public.operators o where o.email = auth.jwt() ->> 'email' and o.permission = 'admin')
  );

------------------------------------------------------------
-- 6) GRANT
------------------------------------------------------------

grant select, insert, update, delete on public.incident_reports to authenticated;
grant all on public.incident_reports to service_role;

------------------------------------------------------------
-- 7) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'incident_reports';
-- → read / insert / update / delete (4개)
