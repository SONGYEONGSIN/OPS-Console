-- backup_request_services RLS — parent backup_requests 정책 mirror
-- 정책: SELECT 전원 read / INSERT·DELETE = admin OR 해당 backup_request의 본인 requester
-- (UPDATE는 미사용 — join row는 (backup_request_id, service_id) composite PK라 변경 의미 없음)
-- 주의: OR 조건 풀어쓰기 — CASE 문은 SQL Editor 파서와 충돌 (학습된 함정, 같은 패턴 backup_requests/services 일관)

begin;

------------------------------------------------------------
-- 1) RLS enable
------------------------------------------------------------

alter table public.backup_request_services enable row level security;

------------------------------------------------------------
-- 2) select — 운영부 전체 read (parent backup_requests 정책과 동일)
------------------------------------------------------------

drop policy if exists "backup_request_services_select_all" on public.backup_request_services;
create policy "backup_request_services_select_all"
  on public.backup_request_services for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 3) insert — admin OR 해당 backup_request의 본인 requester
------------------------------------------------------------

drop policy if exists "backup_request_services_insert" on public.backup_request_services;
create policy "backup_request_services_insert"
  on public.backup_request_services for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.backup_requests br
      where br.id = backup_request_id
        and br.requester_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 4) delete — admin OR 해당 backup_request의 본인 requester
------------------------------------------------------------

drop policy if exists "backup_request_services_delete" on public.backup_request_services;
create policy "backup_request_services_delete"
  on public.backup_request_services for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.backup_requests br
      where br.id = backup_request_id
        and br.requester_email = (auth.jwt() ->> 'email')
    )
  );

------------------------------------------------------------
-- 5) GRANT (학습된 함정 — 42501)
------------------------------------------------------------

grant select, insert, delete on public.backup_request_services to authenticated;
grant all on public.backup_request_services to service_role;

commit;

------------------------------------------------------------
-- 6) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies where tablename = 'backup_request_services';
-- 기대: 3개 (select_all / insert / delete)
--
-- has_table_privilege('authenticated','public.backup_request_services','INSERT') → t
