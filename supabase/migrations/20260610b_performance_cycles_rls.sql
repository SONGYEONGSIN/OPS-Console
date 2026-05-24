-- performance_cycles RLS + GRANT
-- 정책: 모두 read / INSERT·UPDATE·DELETE admin only.

begin;

alter table public.performance_cycles enable row level security;

------------------------------------------------------------
-- 1) GRANT — authenticated가 RLS 정책으로 가드된 SELECT/INSERT/UPDATE/DELETE 호출 가능
--    (RLS 통과해도 GRANT 없으면 42501 'permission denied'로 막힘 — 학습된 함정 회피)
------------------------------------------------------------

grant select, insert, update, delete on public.performance_cycles to authenticated;
grant all on public.performance_cycles to service_role;

------------------------------------------------------------
-- 2) 정책 4건 (SELECT all / INSERT·UPDATE·DELETE admin only)
------------------------------------------------------------

drop policy if exists "performance_cycles_select_all" on public.performance_cycles;
create policy "performance_cycles_select_all"
  on public.performance_cycles for select
  to authenticated
  using (true);

drop policy if exists "performance_cycles_insert_admin" on public.performance_cycles;
create policy "performance_cycles_insert_admin"
  on public.performance_cycles for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "performance_cycles_update_admin" on public.performance_cycles;
create policy "performance_cycles_update_admin"
  on public.performance_cycles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "performance_cycles_delete_admin" on public.performance_cycles;
create policy "performance_cycles_delete_admin"
  on public.performance_cycles for delete
  to authenticated
  using (public.is_admin());

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select policyname, cmd from pg_policies
--   where tablename = 'performance_cycles' order by 1, 2;
-- 기대: 4행 (select / insert / update / delete)
