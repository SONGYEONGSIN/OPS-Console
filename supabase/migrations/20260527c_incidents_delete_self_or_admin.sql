-- incidents delete 권한 확장 — admin OR 본인(assignee_email = 현재 사용자 email)
-- 사고보고는 작성자(=assignee)가 본인 사고를 삭제할 수 있어야 한다.
-- admin은 모든 사고 삭제 가능 (감독 권한 유지).

begin;

drop policy if exists "incidents_delete_admin" on public.incidents;
drop policy if exists "incidents_delete_admin_or_assignee" on public.incidents;

create policy "incidents_delete_admin_or_assignee"
  on public.incidents for delete
  to authenticated
  using (
    public.is_admin()
    OR assignee_email = (auth.jwt() ->> 'email')
  );

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd, qual from pg_policies
--   where tablename = 'incidents' and cmd = 'DELETE';
-- 기대: incidents_delete_admin_or_assignee 1건. qual에 is_admin() OR assignee_email 매칭
