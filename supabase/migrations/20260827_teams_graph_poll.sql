-- Teams Graph 폴링: 어디까지 읽었는지 · 어느 메시지에 답했는지.
--
-- 봇 등록이 막혀 Graph 폴링으로 왔다(2026-08-27). 사람 계정이 채팅을 읽으므로
-- **어디까지 읽었는지 우리가 기억해야** 같은 질문을 또 처리하지 않는다.

-- 방마다 마지막으로 읽은 시각. 이게 없으면 폴링할 때마다 과거 대화를 전부 다시 읽는다.
create table if not exists public.teams_chat_cursors (
  chat_id text primary key,
  -- 이 시각 이후 메시지만 본다. 처음 보는 방은 '지금'부터 — 옛 대화에 뒤늦게 답하지 않는다.
  last_seen_at timestamptz not null default now(),
  -- 사람이 읽는 이름. 어느 방을 보고 있는지 화면·로그에서 알아볼 수 있어야 한다.
  topic text,
  updated_at timestamptz not null default now()
);

alter table public.teams_chat_cursors enable row level security;
-- 서버만 만진다. 폴링은 CRON_SECRET 으로 도는 서버 경로다.
create policy teams_chat_cursors_service on public.teams_chat_cursors
  for all to service_role using (true) with check (true);

-- **GRANT 를 빼면 RLS 를 통과해도 42501 로 막힌다.** 정책과 권한은 다른 것이다.
grant all on public.teams_chat_cursors to service_role;

-- 답할 자리. Bot Framework 의 activity id 대신 **원본 메시지 id** 를 쓴다 —
-- Graph 는 그 메시지에 답글을 달거나 방에 새 글을 올린다.
alter table public.assistant_requests
  add column if not exists teams_source_message_id text;

-- 같은 메시지를 두 번 큐에 넣지 않는다. 폴링이 겹쳐 돌아도 한 번만 처리된다.
create unique index if not exists assistant_requests_teams_msg_uniq
  on public.assistant_requests (teams_source_message_id)
  where teams_source_message_id is not null;
