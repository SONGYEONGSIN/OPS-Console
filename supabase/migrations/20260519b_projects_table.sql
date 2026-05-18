-- projects 테이블 — my-todo Tab2 (Project Management) parent 도메인
-- 1단계 sub-task는 별도 project_tasks 테이블 (20260519d). RLS는 20260519c.
-- 본인 only: created_by_email 기준 RLS

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.projects (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null check (char_length(name) >= 1),
  description       text,
  owner_email       text not null,                                -- 프로젝트 책임자 (operators.email)
  start_at          date,                                         -- Gantt start
  end_at            date,                                         -- Gantt end
  priority          text not null default 'medium'
                    check (priority in ('low', 'medium', 'high')),
  progress          smallint not null default 0
                    check (progress between 0 and 100),
  status            text not null default 'todo'
                    check (status in ('todo', 'in_progress', 'done', 'blocked')),
  created_by_email  text not null,                                -- 작성자 (RLS 기준)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint projects_end_after_start
    check (end_at is null or start_at is null or end_at >= start_at)
);

------------------------------------------------------------
-- 2) updated_at 자동 (operators 마이그의 set_updated_at 재사용)
------------------------------------------------------------

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 3) 인덱스
------------------------------------------------------------

create index if not exists projects_owner_email_idx
  on public.projects (owner_email);

create index if not exists projects_created_by_email_idx
  on public.projects (created_by_email);

create index if not exists projects_start_at_idx
  on public.projects (start_at);

------------------------------------------------------------
-- 4) 시드 — 본인(송영석) 2건
------------------------------------------------------------

insert into public.projects
  (name, description, owner_email, start_at, end_at, priority, progress, status, created_by_email)
values
  ('신제품 프로모션 기간 매출 100억', '이번 분기 핵심 프로모션 캠페인 운영',
   'ys1114@jinhakapply.com', '2026-05-20', '2026-06-30',
   'high', 30, 'in_progress', 'ys1114@jinhakapply.com'),
  ('운영 자동화 R&D', 'AI 도구 기반 운영 효율화 검토',
   'ys1114@jinhakapply.com', '2026-05-25', '2026-07-15',
   'medium', 10, 'todo', 'ys1114@jinhakapply.com')
on conflict do nothing;

commit;

notify pgrst, 'reload schema';
