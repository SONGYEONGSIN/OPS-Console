-- 매뉴얼 반기 점검 알림 기록 (자동화 잡 manual-review-reminder).
-- 반기(half_key: 'YYYY-H1' = 그해 4~9월, 'YYYY-H2' = 그해 10월~이듬해 3월)마다 받는 사람 한 명에
-- 한 행이다. status='sent' 행이 있으면 그 반기에 다시 보내지 않는다. 실패한 사람만 그 달
-- 영업일마다 다시 보낸다(같은 행을 덮어쓴다).
-- recipient_key 는 담당자 메일, 또는 '__summary__:' + 관리자 메일(관리자 요약 — 반기 1회).
-- 메일 주소를 남기는 것은 중복 방지를 위한 예외다(설계 §7). 화면은 없다.
-- 서버 전용(service_role). 정책 0개 = 전면 거부.

begin;

create table if not exists public.manual_review_reminders (
  half_key text not null check (half_key ~ '^[0-9]{4}-H[12]$'),
  recipient_key text not null,
  status text not null check (status in ('sent','failed','dry_run')),
  manual_count int not null default 0,
  message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (half_key, recipient_key)
);

alter table public.manual_review_reminders enable row level security;
revoke all on public.manual_review_reminders from public, anon, authenticated;
grant all on public.manual_review_reminders to service_role;

commit;

notify pgrst, 'reload schema';
