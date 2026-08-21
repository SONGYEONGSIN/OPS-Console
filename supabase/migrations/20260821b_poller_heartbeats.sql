-- 폴러가 살아 있다는 사실 자체를 남긴다.
--
-- 지금은 큐 기록만으로 생사를 판정한다. 그런데 **요청이 없으면 조용한 폴러와 죽은
-- 폴러를 구분할 수 없어** 화면이 'unknown'을 띄운다. 2026-08-20 밤 어시스턴트 폴러가
-- 죽었고, 20:49 질문이 12시간 뒤에야 답을 받았다. 그 사이 아무도 몰랐다.
--
-- 심박이 있으면 요청이 없어도 판정된다 — 끊기면 죽은 것이다.
create table if not exists public.poller_heartbeats (
  -- features/system-status/pollers.ts 의 PollerDef.id 와 같은 값.
  poller_id text primary key,
  beat_at timestamptz not null default now(),
  -- 어느 PC가 보냈나. 나중에 회사 PC가 둘이 되면 그때 구분에 쓴다.
  machine text
);

alter table public.poller_heartbeats enable row level security;

-- 운영 상태라 열람은 로그인 사용자면 되고, 쓰기는 서버(service_role)만.
create policy "poller_heartbeats_select"
  on public.poller_heartbeats
  for select to authenticated using (true);

grant select on public.poller_heartbeats to authenticated;
grant all on public.poller_heartbeats to service_role;
