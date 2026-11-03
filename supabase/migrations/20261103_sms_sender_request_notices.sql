-- SMS 발신번호 사전등록 신청 알림 기록.
-- 신청 목록(Teams 리스트) 항목마다 새 신청 / 완료 메일을 이미 보냈는지 기억한다.
-- 신청자 메일·이름은 저장하지 않는다 — 항목 id 와 상태만.
-- 서버 전용(service_role). 정책 0개 = 전면 거부.

begin;

create table if not exists public.sms_sender_request_notices (
  item_id text primary key,
  last_status text not null,

  new_state text not null default 'pending'
    check (new_state in ('pending','sending','sent','dry_run','seeded','failed')),
  new_attempts int not null default 0,
  new_claimed_at timestamptz,
  new_sent_at timestamptz,
  new_message_id text,
  new_error text,

  done_state text not null default 'pending'
    check (done_state in ('pending','sending','sent','dry_run','seeded','failed')),
  done_attempts int not null default 0,
  done_claimed_at timestamptz,
  done_sent_at timestamptz,
  done_message_id text,
  done_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sms_sender_request_notices enable row level security;
revoke all on public.sms_sender_request_notices from public, anon, authenticated;
grant all on public.sms_sender_request_notices to service_role;

commit;

notify pgrst, 'reload schema';
