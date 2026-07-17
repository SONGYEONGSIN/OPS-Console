-- 팀 보고 브리핑 뉴스레터 발행분 — 주간 브리핑을 웹페이지(/r/briefing/[token])로 공유.
-- 쓰기/읽기 모두 service_role(잡 insert, 공유 페이지 admin client 조회) — reports share_token 패턴.

create table if not exists public.team_briefings (
  id uuid primary key default gen_random_uuid(),
  issue_no int not null,
  briefing_date date not null,
  payload jsonb not null,
  share_token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.team_briefings enable row level security;

grant all on public.team_briefings to service_role;

create index if not exists team_briefings_share_token_idx
  on public.team_briefings (share_token);
