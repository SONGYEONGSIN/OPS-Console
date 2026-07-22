-- 원서접수 점검 체크리스트
create table if not exists checklist_rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references checklist_rounds(id) on delete cascade,
  department text not null check (department in ('기획파트','운영부','고객지원팀','개발부','영업부')),
  category text not null default '',
  title text not null,
  status text check (status in ('done','in_progress','todo','na')),
  note text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists checklist_items_round_dept_idx
  on checklist_items(round_id, department, sort_order);

create table if not exists checklist_share_tokens (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references checklist_rounds(id) on delete cascade,
  kind text not null check (kind in ('dept-fill','report')),
  department text check (department in ('기획파트','운영부','고객지원팀','개발부','영업부')),
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint dept_fill_requires_department
    check (kind <> 'dept-fill' or department is not null)
);
create index if not exists checklist_tokens_round_idx on checklist_share_tokens(round_id);

alter table checklist_rounds enable row level security;
alter table checklist_items enable row level security;
alter table checklist_share_tokens enable row level security;

-- 로그인 사용자 읽기 허용 (운영부 공개), 쓰기는 service_role 전용
create policy checklist_rounds_read on checklist_rounds for select using (auth.role() = 'authenticated');
create policy checklist_items_read on checklist_items for select using (auth.role() = 'authenticated');
create policy checklist_tokens_read on checklist_share_tokens for select using (auth.role() = 'authenticated');

grant select on checklist_rounds, checklist_items, checklist_share_tokens to authenticated;
grant all on checklist_rounds, checklist_items, checklist_share_tokens to service_role;
