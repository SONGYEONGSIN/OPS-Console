-- project_tasks 테이블 — projects 1단계 sub-task
-- 깊이 1단계 enforcement: parent_task_id 필드 없음 (스키마 차원에서 차단)
-- on delete cascade: parent project 삭제 시 children 자동 삭제
-- RLS는 20260519e — parent projects 본인 EXISTS 기준

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.project_tasks (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null
                    references public.projects(id) on delete cascade,
  name              text not null check (char_length(name) >= 1),
  assignee_email    text,                                         -- 담당자 (nullable, operators.email)
  start_at          date,
  end_at            date,
  priority          text not null default 'medium'
                    check (priority in ('low', 'medium', 'high')),
  progress          smallint not null default 0
                    check (progress between 0 and 100),
  status            text not null default 'todo'
                    check (status in ('todo', 'in_progress', 'done', 'blocked')),
  created_by_email  text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint project_tasks_end_after_start
    check (end_at is null or start_at is null or end_at >= start_at)
);

------------------------------------------------------------
-- 2) updated_at 자동
------------------------------------------------------------

drop trigger if exists project_tasks_set_updated_at on public.project_tasks;
create trigger project_tasks_set_updated_at
  before update on public.project_tasks
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 3) 인덱스
------------------------------------------------------------

create index if not exists project_tasks_project_id_idx
  on public.project_tasks (project_id);

create index if not exists project_tasks_start_at_idx
  on public.project_tasks (start_at);

create index if not exists project_tasks_assignee_email_idx
  on public.project_tasks (assignee_email);

------------------------------------------------------------
-- 4) 시드 — 20260519b의 2 projects에 sub-task 3건
------------------------------------------------------------

with parent_a as (
  select id from public.projects
  where name = '신제품 프로모션 기간 매출 100억' limit 1
),
parent_b as (
  select id from public.projects
  where name = '운영 자동화 R&D' limit 1
)
insert into public.project_tasks
  (project_id, name, assignee_email, start_at, end_at, priority, progress, status, created_by_email)
select id, '블로그 포스팅', 'ys1114@jinhakapply.com',
       '2026-05-22'::date, '2026-05-23'::date, 'medium', 50, 'in_progress',
       'ys1114@jinhakapply.com'
from parent_a
union all
select id, '카드뉴스 포스팅', 'ys1114@jinhakapply.com',
       '2026-05-24'::date, '2026-05-25'::date, 'medium', 0, 'todo',
       'ys1114@jinhakapply.com'
from parent_a
union all
select id, '도구 후보 리서치', 'ys1114@jinhakapply.com',
       '2026-05-25'::date, '2026-05-29'::date, 'low', 20, 'in_progress',
       'ys1114@jinhakapply.com'
from parent_b
on conflict do nothing;

commit;

notify pgrst, 'reload schema';
