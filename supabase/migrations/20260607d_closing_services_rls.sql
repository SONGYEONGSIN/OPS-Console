-- closing_services RLS — 운영부 전원 read, 쓰기는 service_role(인제스트 API)만.
-- (insight_videos 패턴: select to authenticated using(true) / 쓰기 정책 없음)

begin;

alter table public.closing_services enable row level security;

drop policy if exists "closing_services_select" on public.closing_services;
create policy "closing_services_select"
  on public.closing_services for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated 차단, service_role(RLS bypass)만 쓰기(인제스트 API).

grant select on public.closing_services to authenticated;
grant all on public.closing_services to service_role;

commit;

notify pgrst, 'reload schema';
