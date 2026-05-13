-- backup_requests 테이블 RLS + GRANT
-- 정책: SELECT 전원 read / INSERT·UPDATE·DELETE = admin OR 본인 requester
-- ai_work / posts 패턴 일관 (is_admin() helper 재사용)
-- 주의: OR 조건 풀어쓰기 — CASE 문은 SQL Editor 파서와 충돌 (학습된 함정)

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.backup_requests enable row level security;

------------------------------------------------------------
-- 2) select — 운영부 전체 read (brainstorm: 전원 접근)
------------------------------------------------------------

drop policy if exists "backup_requests_select_all" on public.backup_requests;
create policy "backup_requests_select_all"
  on public.backup_requests for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert — admin OR 본인 requester
------------------------------------------------------------

drop policy if exists "backup_requests_insert" on public.backup_requests;
create policy "backup_requests_insert"
  on public.backup_requests for insert
  to authenticated
  with check (
    public.is_admin()
    or requester_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 4) update — admin OR 본인 requester
------------------------------------------------------------

drop policy if exists "backup_requests_update" on public.backup_requests;
create policy "backup_requests_update"
  on public.backup_requests for update
  to authenticated
  using (
    public.is_admin()
    or requester_email = (auth.jwt() ->> 'email')
  )
  with check (
    public.is_admin()
    or requester_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 5) delete — admin OR 본인 requester
------------------------------------------------------------

drop policy if exists "backup_requests_delete" on public.backup_requests;
create policy "backup_requests_delete"
  on public.backup_requests for delete
  to authenticated
  using (
    public.is_admin()
    or requester_email = (auth.jwt() ->> 'email')
  );

------------------------------------------------------------
-- 6) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, update, delete on public.backup_requests to authenticated;
grant all on public.backup_requests to service_role;

commit;

------------------------------------------------------------
-- 7) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'backup_requests';
-- 기대: backup_requests_select_all / _insert / _update / _delete (4개)
