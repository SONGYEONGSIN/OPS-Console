-- 운영자 시스템 권한 — admin-only RLS 가드 + GRANT
-- 선행: 20260510_operators_permission.sql (permission 컬럼 + 시드 backfill) 실행 완료 가정.
--
-- Supabase Dashboard SQL Editor에서 전체 선택 후 한 번에 RUN:
--   https://supabase.com/dashboard/project/xvfckvihilmkkhzmqxnu/sql

begin;

------------------------------------------------------------
-- 1) helper — JWT email로 현재 사용자가 admin인지 검사
--    security definer 로 RLS 우회 (무한 재귀 차단).
--    search_path 명시 (CVE 회피 + schema injection 방지).
------------------------------------------------------------

create or replace function public.is_admin()
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public, auth, pg_temp
as $$
begin
  return exists (
    select 1
    from public.operators
    where email = (auth.jwt() ->> 'email')
      and permission = 'admin'
  );
end;
$$;

-- 함수 실행 권한 — authenticated가 호출 가능해야 RLS 정책에서 사용 가능
grant execute on function public.is_admin() to authenticated;

------------------------------------------------------------
-- 2) 기존 insert/update 정책 drop & 재생성 (admin only)
--    operators_select 는 그대로 (모두 read 가능).
------------------------------------------------------------

drop policy if exists "operators_insert" on public.operators;
drop policy if exists "operators_update" on public.operators;

create policy "operators_admin_insert"
  on public.operators for insert
  to authenticated
  with check (public.is_admin());

create policy "operators_admin_update"
  on public.operators for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

------------------------------------------------------------
-- 3) delete 정책 신규 (admin only)
------------------------------------------------------------

drop policy if exists "operators_admin_delete" on public.operators;
create policy "operators_admin_delete"
  on public.operators for delete
  to authenticated
  using (public.is_admin());

------------------------------------------------------------
-- 4) GRANT — RLS 정책만으론 부족 (학습된 함정 — 42501)
------------------------------------------------------------

grant delete on public.operators to authenticated;

commit;

------------------------------------------------------------
-- 5) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- 1) admin claim으로 update 1 row 성공
-- 2) member claim으로 update 0 rows (RLS 차단)
-- 3) member claim으로 delete 0 rows (RLS 차단)
-- 4) authenticated가 is_admin() 호출 가능 (grant execute 확인)
