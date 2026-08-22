-- open_notice_sends — 오픈안내 메일 발송 이력 (즉시 sent/failed/dry_run + 예약 scheduled/sending).
--
-- service_id 는 closing_services.service_id(Moa 서비스ID) 정수이고 FK 를 걸지 않는다.
-- closing_services 는 Moa 의 스크랩 미러지 원장이 아니라서, FK 를 걸면 메일 이력의
-- 무결성이 스크래퍼 가용성에 묶인다. entertest_test_runs.service_id 가 같은 이유로
-- FK 없이 bigint 다(20260628_entertest_runs_service_id.sql).

begin;

create table if not exists public.open_notice_sends (
  id uuid primary key default gen_random_uuid(),
  service_id bigint,                               -- Moa 서비스ID (FK 없음)
  university_name text not null,
  service_name text,
  sender_email text not null,
  to_email text not null,
  to_name text,
  cc jsonb not null default '[]'::jsonb,
  subject text not null,
  body text not null,
  status text not null default 'sent',
  scheduled_at timestamptz,
  sent_at timestamptz,
  error text,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

-- status 허용값을 처음부터 건다. data_request_sends 는 별도 마이그로 뒤늦게 붙였는데
-- 그 사이에 오타 상태가 들어갈 수 있었다 — 답습하지 않는다.
alter table public.open_notice_sends drop constraint if exists open_notice_sends_status_chk;
alter table public.open_notice_sends
  add constraint open_notice_sends_status_chk
  check (status in ('scheduled','sending','sent','failed','dry_run'));

create index if not exists open_notice_sends_created_by_idx
  on public.open_notice_sends (created_by_email, created_at desc);
create index if not exists open_notice_sends_scheduled_idx
  on public.open_notice_sends (status, scheduled_at);
-- 목록이 서비스별 배지를 그릴 때 service_id in (...) 로 훑는다.
create index if not exists open_notice_sends_service_idx
  on public.open_notice_sends (service_id);

alter table public.open_notice_sends enable row level security;

drop policy if exists "open_notice_sends_select_own_or_admin" on public.open_notice_sends;
create policy "open_notice_sends_select_own_or_admin"
  on public.open_notice_sends for select to authenticated
  using (public.is_admin() or created_by_email = (auth.jwt() ->> 'email'));

-- INSERT 정책은 두지 않는다 — 적재는 server action 이 service_role 로만 한다.
grant select on public.open_notice_sends to authenticated;
grant all on public.open_notice_sends to service_role;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.open_notice_sends
-- 기대: 16 컬럼 + status check(5값) + 인덱스 3개 + RLS select 정책 1개
-- authenticated 세션에서 남의 created_by_email 행이 안 보이는지 1회 실조회
