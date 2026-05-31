-- 월별 서비스 알림(service-notice-mail) 발송 이력
-- 운영자 본인에게 '다음 달 작성시작 서비스'를 요약 발송한 기록.
-- target_month(yyyy-MM) + recipient_email + status='sent' 조합으로 월 단위 중복 방지.
-- RLS: select admin/member, write service_role only (server action/cron admin client).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.service_notice_mail_sends (
  id                uuid primary key default uuid_generate_v4(),
  sent_at           timestamptz not null default now(),
  target_month      text not null,                              -- 'yyyy-MM' (발송 대상 월)
  recipient_email   text not null,                              -- 운영자 본인 메일
  recipient_name    text,
  service_count     int not null default 0,                     -- 포함된 서비스 건수
  graph_message_id  text,
  status            text not null
                    check (status in ('sent', 'failed', 'dry_run')),
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists service_notice_mail_sends_set_updated_at on public.service_notice_mail_sends;
create trigger service_notice_mail_sends_set_updated_at
before update on public.service_notice_mail_sends
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스 — idempotency 조회(target_month + recipient + status)
------------------------------------------------------------

create index if not exists service_notice_mail_sends_month_recipient_idx
  on public.service_notice_mail_sends (target_month, recipient_email, status);

create index if not exists service_notice_mail_sends_sent_at_desc_idx
  on public.service_notice_mail_sends (sent_at desc);

------------------------------------------------------------
-- 3) RLS — select admin/member, write service_role only
------------------------------------------------------------

alter table public.service_notice_mail_sends enable row level security;

drop policy if exists "service_notice_mail_sends_select" on public.service_notice_mail_sends;
create policy "service_notice_mail_sends_select"
  on public.service_notice_mail_sends for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated 차단, service_role(RLS bypass)만 쓰기.

grant select on public.service_notice_mail_sends to authenticated;
grant all on public.service_notice_mail_sends to service_role;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.service_notice_mail_sends
-- 기대: 10 컬럼 + select 정책 1
