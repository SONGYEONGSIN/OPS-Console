-- automation_settings 테이블 — 운영 자동화 실행 on/off 토글 영속화
-- job_id별 enabled 플래그. 기본 false (수동 우선).
-- 읽기: admin (is_admin) — 자동화 실행 메뉴는 admin 전용
-- 쓰기: server action이 service_role(admin client)로 upsert. RLS write 정책은 방어용(admin).
-- cron(scripts/insights-fetch.mjs)은 service_role로 enabled를 읽어 OFF/없음이면 skip.

begin;

create table if not exists public.automation_settings (
  job_id text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.automation_settings enable row level security;

drop policy if exists "automation_settings_select_admin" on public.automation_settings;
create policy "automation_settings_select_admin"
  on public.automation_settings for select
  to authenticated
  using (public.is_admin());

drop policy if exists "automation_settings_write_admin" on public.automation_settings;
create policy "automation_settings_write_admin"
  on public.automation_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.automation_settings to authenticated;
grant all on public.automation_settings to service_role;

commit;

notify pgrst, 'reload schema';
