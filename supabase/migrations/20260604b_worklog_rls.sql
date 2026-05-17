-- worklog RLS — read: authenticated 전체 / write: service_role only (server action 경유)
-- 직접 insert/update/delete 차단 (UI에서 변조 불가, 로그는 append-only)

begin;

alter table public.worklog enable row level security;

drop policy if exists "worklog_read_authenticated" on public.worklog;
create policy "worklog_read_authenticated"
  on public.worklog for select to authenticated using (true);

-- insert/update/delete 정책 없음 → authenticated에서 차단. service_role만 가능.

grant select on public.worklog to authenticated;
grant all on public.worklog to service_role;

notify pgrst, 'reload schema';

commit;
