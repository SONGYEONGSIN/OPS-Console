-- 백업 요청 메일 발송 이력
-- 발송 시각 / 발신자(요청자) / 수신자(백업자) / CC / 연결 backup_request / Graph 메시지 ID / 상태.
-- 재발송 시 row 누적 (mail_status는 마지막 시도 상태만 backup_requests에 반영)
-- RLS는 20260519d_backup_request_mail_sends_rls.sql 에서 별도 적용.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.backup_request_mail_sends (
  id                    uuid primary key default uuid_generate_v4(),
  sent_at               timestamptz not null default now(),
  sender_operator_id    uuid references public.operators(id) on delete set null,
  backup_request_id     uuid references public.backup_requests(id) on delete cascade,
  recipient_email       text not null,                              -- 백업자 이메일
  recipient_name        text,                                       -- 백업자 이름 (스냅샷)
  cc_emails             text[] not null default '{}',               -- 발송 시점 같은 team 운영자 스냅샷
  graph_message_id      text,                                       -- Graph sendMail 응답 ID (실패 시 null)
  status                text not null
                        check (status in ('sent', 'failed', 'dry_run')),
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists backup_request_mail_sends_set_updated_at on public.backup_request_mail_sends;
create trigger backup_request_mail_sends_set_updated_at
before update on public.backup_request_mail_sends
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists backup_request_mail_sends_sender_idx
  on public.backup_request_mail_sends (sender_operator_id);

create index if not exists backup_request_mail_sends_request_idx
  on public.backup_request_mail_sends (backup_request_id);

create index if not exists backup_request_mail_sends_sent_at_desc_idx
  on public.backup_request_mail_sends (sent_at desc);

create index if not exists backup_request_mail_sends_status_sent_at_idx
  on public.backup_request_mail_sends (status, sent_at desc);

commit;

------------------------------------------------------------
-- 3) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.backup_request_mail_sends
-- 기대: 12 컬럼
