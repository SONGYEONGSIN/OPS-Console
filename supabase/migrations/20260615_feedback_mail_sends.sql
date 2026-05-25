-- 개선요청(posts.domain='feedback') 메일 발송 이력
-- 발송 이벤트:
--   create        : 새 개선요청 등록 시 담당자(고정 송영신)에게 알림
--   status_change : 상태 변경(요청→확인/처리중/처리완료) 시 등록자에게 알림
-- RLS는 20260615b_feedback_mail_sends_rls.sql 에서 별도 적용.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.feedback_mail_sends (
  id                    uuid primary key default uuid_generate_v4(),
  sent_at               timestamptz not null default now(),
  post_id               uuid not null references public.posts(id) on delete cascade,
  event_type            text not null
                        check (event_type in ('create', 'status_change')),
  status_to             text                                     -- status_change 시 변경 후 status (urgent|review|active|approved)
                        check (status_to is null or status_to in ('urgent', 'review', 'active', 'approved')),
  sender_operator_id    uuid references public.operators(id) on delete set null,
  sender_email          text not null,                           -- 발신자 이메일 (이력 보존)
  recipient_email       text not null,
  recipient_name        text,
  subject               text not null,
  graph_message_id      text,                                    -- Graph sendMail 응답 ID (실패 시 null)
  status                text not null
                        check (status in ('sent', 'failed', 'dry_run')),
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists feedback_mail_sends_set_updated_at on public.feedback_mail_sends;
create trigger feedback_mail_sends_set_updated_at
before update on public.feedback_mail_sends
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists feedback_mail_sends_post_id_idx
  on public.feedback_mail_sends (post_id);

create index if not exists feedback_mail_sends_recipient_idx
  on public.feedback_mail_sends (recipient_email);

create index if not exists feedback_mail_sends_sent_at_desc_idx
  on public.feedback_mail_sends (sent_at desc);

create index if not exists feedback_mail_sends_event_type_idx
  on public.feedback_mail_sends (event_type, sent_at desc);

commit;
