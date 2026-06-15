-- automation_runs RLS + GRANT.
-- read: 인증 전원(자동화 페이지는 admin 컨텍스트라 service_role read가 실경로지만 방어적 정책).
-- insert: service_role 전용 (서버: cron route / 수동 action의 admin client).

begin;

alter table public.automation_runs enable row level security;

drop policy if exists automation_runs_read on public.automation_runs;
create policy automation_runs_read on public.automation_runs
  for select to authenticated using (true);

grant select on public.automation_runs to authenticated;
grant select, insert on public.automation_runs to service_role;

notify pgrst, 'reload schema';

commit;
