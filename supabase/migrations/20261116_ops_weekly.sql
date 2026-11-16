-- 운영부 주간업무보고 (PR-A1) — 테이블 12개 + RLS + 시드 + 비공개 버킷 + 순번 교체 함수
-- 설계: docs/superpowers/specs/2026-11-16-ops-weekly-report-design.md
-- 쓰기 정책 0개 = 쓰기는 server action 이 service_role 로만 한다. authenticated 는 열람(select)만.
-- dev_status.service_id 는 Moa 서비스ID 정수, FK 없음 — closing_services 는 스크랩 미러다.
begin;

create table if not exists public.ops_weekly_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  label_year int not null,
  label_month int not null check (label_month between 1 and 12),
  label_week int not null check (label_week between 1 and 6),
  duty_email text,
  summary_this text not null default '',
  summary_next text not null default '',
  status text not null default 'open' check (status in ('open','reported')),
  reported_at timestamptz,
  reported_by text,
  reopened_at timestamptz,
  reopened_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ops_weekly_weeks_set_updated_at on public.ops_weekly_weeks;
create trigger ops_weekly_weeks_set_updated_at before update on public.ops_weekly_weeks
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.ops_weekly_weeks(id) on delete cascade,
  operator_email text not null,
  status text not null default 'draft' check (status in ('draft','submitted','returned')),
  submitted_at timestamptz,
  returned_at timestamptz,
  returned_by text,
  return_reason text,
  snapshot jsonb,
  checked_tabs text[] not null default '{}',
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, operator_email)
);

drop trigger if exists ops_weekly_reports_set_updated_at on public.ops_weekly_reports;
create trigger ops_weekly_reports_set_updated_at before update on public.ops_weekly_reports
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_area_notes (
  report_id uuid not null references public.ops_weekly_reports(id) on delete cascade,
  area text not null check (area in ('application','pims','project','tf','leave')),
  this_week text not null default '',
  next_week text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (report_id, area)
);

drop trigger if exists ops_weekly_area_notes_set_updated_at on public.ops_weekly_area_notes;
create trigger ops_weekly_area_notes_set_updated_at before update on public.ops_weekly_area_notes
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_item_overrides (
  report_id uuid not null references public.ops_weekly_reports(id) on delete cascade,
  item_key text not null,
  area text not null check (area in ('application','pims','leave')),
  note text not null default '',
  excluded boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (report_id, item_key)
);

drop trigger if exists ops_weekly_item_overrides_set_updated_at on public.ops_weekly_item_overrides;
create trigger ops_weekly_item_overrides_set_updated_at before update on public.ops_weekly_item_overrides
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_manual_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.ops_weekly_reports(id) on delete cascade,
  area text not null check (area in ('application','pims','leave')),
  group_key text,
  title text not null,
  note text not null default '',
  period_start date,
  period_end date,
  leave_kind text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_weekly_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'project' check (kind in ('project','tf')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ops_weekly_projects_set_updated_at on public.ops_weekly_projects;
create trigger ops_weekly_projects_set_updated_at before update on public.ops_weekly_projects
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_project_owners (
  project_id uuid not null references public.ops_weekly_projects(id) on delete cascade,
  operator_email text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, operator_email)
);

create table if not exists public.ops_weekly_project_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.ops_weekly_reports(id) on delete cascade,
  project_id uuid not null references public.ops_weekly_projects(id) on delete restrict,
  stage text check (stage in ('기획','요구분석','설계','개발','테스트','배포','운영','보류')),
  this_week text not null default '',
  next_week text not null default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (report_id, project_id)
);

drop trigger if exists ops_weekly_project_entries_set_updated_at on public.ops_weekly_project_entries;
create trigger ops_weekly_project_entries_set_updated_at before update on public.ops_weekly_project_entries
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_duty_rotation (
  position int primary key check (position >= 0),
  operator_email text not null unique
);

create table if not exists public.ops_weekly_settings (
  id boolean primary key default true check (id),
  rotation_anchor_week date check (rotation_anchor_week is null or extract(isodow from rotation_anchor_week) = 1),
  excluded_writer_emails text[] not null default '{}',
  updated_by text,
  updated_at timestamptz not null default now()
);

drop trigger if exists ops_weekly_settings_set_updated_at on public.ops_weekly_settings;
create trigger ops_weekly_settings_set_updated_at before update on public.ops_weekly_settings
for each row execute function public.set_updated_at();

create table if not exists public.ops_weekly_recipients (
  email text primary key,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ops_weekly_dev_status (
  service_id integer primary key,
  stage text not null check (stage in ('dev','test')),
  raw_label text,
  collected_at timestamptz not null
);

create index if not exists ops_weekly_reports_week_idx on public.ops_weekly_reports (week_id);
create index if not exists ops_weekly_project_entries_project_idx on public.ops_weekly_project_entries (project_id);
create index if not exists ops_weekly_manual_items_report_idx on public.ops_weekly_manual_items (report_id);
create index if not exists ops_weekly_project_owners_email_idx on public.ops_weekly_project_owners (operator_email);

alter table public.ops_weekly_weeks enable row level security;
revoke all on public.ops_weekly_weeks from public, anon, authenticated;
grant select on public.ops_weekly_weeks to authenticated;
grant all on public.ops_weekly_weeks to service_role;
drop policy if exists "ops_weekly_weeks_select" on public.ops_weekly_weeks;
create policy "ops_weekly_weeks_select" on public.ops_weekly_weeks for select to authenticated using (true);

alter table public.ops_weekly_reports enable row level security;
revoke all on public.ops_weekly_reports from public, anon, authenticated;
grant select on public.ops_weekly_reports to authenticated;
grant all on public.ops_weekly_reports to service_role;
drop policy if exists "ops_weekly_reports_select" on public.ops_weekly_reports;
create policy "ops_weekly_reports_select" on public.ops_weekly_reports for select to authenticated using (true);

alter table public.ops_weekly_area_notes enable row level security;
revoke all on public.ops_weekly_area_notes from public, anon, authenticated;
grant select on public.ops_weekly_area_notes to authenticated;
grant all on public.ops_weekly_area_notes to service_role;
drop policy if exists "ops_weekly_area_notes_select" on public.ops_weekly_area_notes;
create policy "ops_weekly_area_notes_select" on public.ops_weekly_area_notes for select to authenticated using (true);

alter table public.ops_weekly_item_overrides enable row level security;
revoke all on public.ops_weekly_item_overrides from public, anon, authenticated;
grant select on public.ops_weekly_item_overrides to authenticated;
grant all on public.ops_weekly_item_overrides to service_role;
drop policy if exists "ops_weekly_item_overrides_select" on public.ops_weekly_item_overrides;
create policy "ops_weekly_item_overrides_select" on public.ops_weekly_item_overrides for select to authenticated using (true);

alter table public.ops_weekly_manual_items enable row level security;
revoke all on public.ops_weekly_manual_items from public, anon, authenticated;
grant select on public.ops_weekly_manual_items to authenticated;
grant all on public.ops_weekly_manual_items to service_role;
drop policy if exists "ops_weekly_manual_items_select" on public.ops_weekly_manual_items;
create policy "ops_weekly_manual_items_select" on public.ops_weekly_manual_items for select to authenticated using (true);

alter table public.ops_weekly_projects enable row level security;
revoke all on public.ops_weekly_projects from public, anon, authenticated;
grant select on public.ops_weekly_projects to authenticated;
grant all on public.ops_weekly_projects to service_role;
drop policy if exists "ops_weekly_projects_select" on public.ops_weekly_projects;
create policy "ops_weekly_projects_select" on public.ops_weekly_projects for select to authenticated using (true);

alter table public.ops_weekly_project_owners enable row level security;
revoke all on public.ops_weekly_project_owners from public, anon, authenticated;
grant select on public.ops_weekly_project_owners to authenticated;
grant all on public.ops_weekly_project_owners to service_role;
drop policy if exists "ops_weekly_project_owners_select" on public.ops_weekly_project_owners;
create policy "ops_weekly_project_owners_select" on public.ops_weekly_project_owners for select to authenticated using (true);

alter table public.ops_weekly_project_entries enable row level security;
revoke all on public.ops_weekly_project_entries from public, anon, authenticated;
grant select on public.ops_weekly_project_entries to authenticated;
grant all on public.ops_weekly_project_entries to service_role;
drop policy if exists "ops_weekly_project_entries_select" on public.ops_weekly_project_entries;
create policy "ops_weekly_project_entries_select" on public.ops_weekly_project_entries for select to authenticated using (true);

alter table public.ops_weekly_duty_rotation enable row level security;
revoke all on public.ops_weekly_duty_rotation from public, anon, authenticated;
grant select on public.ops_weekly_duty_rotation to authenticated;
grant all on public.ops_weekly_duty_rotation to service_role;
drop policy if exists "ops_weekly_duty_rotation_select" on public.ops_weekly_duty_rotation;
create policy "ops_weekly_duty_rotation_select" on public.ops_weekly_duty_rotation for select to authenticated using (true);

alter table public.ops_weekly_settings enable row level security;
revoke all on public.ops_weekly_settings from public, anon, authenticated;
grant select on public.ops_weekly_settings to authenticated;
grant all on public.ops_weekly_settings to service_role;
drop policy if exists "ops_weekly_settings_select" on public.ops_weekly_settings;
create policy "ops_weekly_settings_select" on public.ops_weekly_settings for select to authenticated using ((select public.is_admin()));

alter table public.ops_weekly_recipients enable row level security;
revoke all on public.ops_weekly_recipients from public, anon, authenticated;
grant select on public.ops_weekly_recipients to authenticated;
grant all on public.ops_weekly_recipients to service_role;
drop policy if exists "ops_weekly_recipients_select" on public.ops_weekly_recipients;
create policy "ops_weekly_recipients_select" on public.ops_weekly_recipients for select to authenticated using ((select public.is_admin()));

alter table public.ops_weekly_dev_status enable row level security;
revoke all on public.ops_weekly_dev_status from public, anon, authenticated;
grant select on public.ops_weekly_dev_status to authenticated;
grant all on public.ops_weekly_dev_status to service_role;
drop policy if exists "ops_weekly_dev_status_select" on public.ops_weekly_dev_status;
create policy "ops_weekly_dev_status_select" on public.ops_weekly_dev_status for select to authenticated using (true);

insert into public.ops_weekly_projects (name, kind, sort_order) values
  ('PIMS','project',10),
  ('접수관리자','project',20),
  ('내부관리자','project',30),
  ('경쟁률','project',40),
  ('생성툴','project',50),
  ('매출 분석','project',60),
  ('정산 · 진학캐쉬','project',70),
  ('초중고','project',80),
  ('인증','project',90),
  ('대교협 연계','project',100),
  ('추천인 검증','project',110),
  ('보증보험','project',120),
  ('실적증명','project',130),
  ('계약서','project',140),
  ('유의사항','project',150)
on conflict (name) do nothing;

insert into public.ops_weekly_settings (id) values (true) on conflict (id) do nothing;

-- 비공개 버킷: 로그인한 사람만 본다. 읽기는 서버가 서명 URL 로 내보낸다.
insert into storage.buckets (id, name, public) values ('ops-weekly', 'ops-weekly', false)
on conflict (id) do update set public = false;

drop policy if exists "ops_weekly_objects_service_only" on storage.objects;
create policy "ops_weekly_objects_service_only" on storage.objects
  for all to service_role
  using (bucket_id = 'ops-weekly') with check (bucket_id = 'ops-weekly');

-- 순번표 전체 교체. 지우기와 넣기를 한 호출(=한 트랜잭션)로 묶어, 중간에 실패해도 순번표가 빈 채로 남지 않는다.
-- `where true` 는 장식이 아니다 — Supabase PostgREST 경로는 safeupdate 가 켜져 있어
-- plpgsql 안의 WHERE 없는 DELETE 를 21000 으로 거부한다(SQL Editor 에선 통과해서 못 본다).
-- security definer 가 아니다: 부르는 쪽이 service_role 이고 테이블 권한(grant all)이 이미 있다.
create or replace function public.ops_weekly_replace_rotation(emails text[])
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  delete from public.ops_weekly_duty_rotation where true;
  insert into public.ops_weekly_duty_rotation (position, operator_email)
  select (t.ord - 1)::int, t.e from unnest(emails) with ordinality as t(e, ord);
end;
$$;
revoke execute on function public.ops_weekly_replace_rotation(text[]) from public, anon, authenticated;
grant  execute on function public.ops_weekly_replace_rotation(text[]) to service_role;

notify pgrst, 'reload schema';

commit;
