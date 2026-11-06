-- SMS 발신번호 현황 최신화 버튼 요청 큐(회사 PC 폴러가 claim).
-- pending → running → done|failed. 동시에 활성(pending/running) 요청은 1건만 — 부분 유니크 인덱스.
-- result jsonb 에는 번호가 들어갈 수 있어 service_role 만 읽고 쓴다(정책 0개 = 전면 거부).
-- 화면은 requireMenu 를 통과한 서버가 읽는다(설계 §8 '요약 열람 범위').
-- watermarks 는 단계별 기준 시각(jsonb) — 메일·PDF 단계가 마이그레이션 없이 끼워지게 지금 둔다.

begin;

create table if not exists public.sms_status_refresh_requests (
  id uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  requested_by text not null,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed')),
  claimed_at timestamptz,
  finished_at timestamptz,
  message text,
  result jsonb,
  watermarks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists sms_status_refresh_requests_one_active
  on public.sms_status_refresh_requests ((true))
  where status in ('pending','running');

create index if not exists sms_status_refresh_requests_pending_idx
  on public.sms_status_refresh_requests (requested_at)
  where status = 'pending';

alter table public.sms_status_refresh_requests enable row level security;
revoke all on public.sms_status_refresh_requests from public, anon, authenticated;
grant all on public.sms_status_refresh_requests to service_role;

commit;

notify pgrst, 'reload schema';
