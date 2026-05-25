-- 미수채권 운영자 본인용 미수 알림 메일 발송 이력
-- 발송 시각 / 발신자(=수신자 본인) / 묶인 청구건 / Graph 메시지 ID / 상태(sent|failed|dry_run).
-- 학교담당자 메일 이력(receivables_mail_sends)과 컬럼 정합 — 운영자용은 recipient가 운영자 본인.
-- RLS는 20260526b_receivables_operator_mail_sends_rls.sql 에서 별도 적용.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.receivables_operator_mail_sends (
  id                    uuid primary key default uuid_generate_v4(),
  sent_at               timestamptz not null default now(),
  operator_id           uuid references public.operators(id) on delete set null,
  recipient_email       text not null,                                -- 운영자 본인 메일
  recipient_name        text,                                         -- 운영자 본인 이름
  customer_names        text[] not null default '{}',                 -- 본인 담당 거래처명
  receivable_count      int not null default 0,                       -- 포함된 청구 건수
  total_amount          numeric(14, 2) not null default 0,            -- 합계 청구금액 (KRW)
  graph_message_id      text,                                         -- Graph sendMail 응답 ID (실패 시 null)
  status                text not null
                        check (status in ('sent', 'failed', 'dry_run')),
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists receivables_operator_mail_sends_set_updated_at on public.receivables_operator_mail_sends;
create trigger receivables_operator_mail_sends_set_updated_at
before update on public.receivables_operator_mail_sends
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists receivables_operator_mail_sends_operator_idx
  on public.receivables_operator_mail_sends (operator_id);

create index if not exists receivables_operator_mail_sends_recipient_idx
  on public.receivables_operator_mail_sends (recipient_email);

create index if not exists receivables_operator_mail_sends_sent_at_desc_idx
  on public.receivables_operator_mail_sends (sent_at desc);

create index if not exists receivables_operator_mail_sends_status_sent_at_idx
  on public.receivables_operator_mail_sends (status, sent_at desc);

commit;

------------------------------------------------------------
-- 3) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.receivables_operator_mail_sends
-- 기대: 12 컬럼 (id ~ updated_at)
-- select tgname from pg_trigger where tgrelid = 'public.receivables_operator_mail_sends'::regclass and not tgisinternal;
-- 기대: receivables_operator_mail_sends_set_updated_at
