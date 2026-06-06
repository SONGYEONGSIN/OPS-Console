-- SmileEDI 세금계산서 알림(smileedi-mail) 발송 이력.
-- 발신 운영자 본인 mailbox에서 담당자에게 발송한 기록 + 발송 성공 시 시트 '이메일오류'='Y' PATCH.
-- 재발송 1차 idempotency는 시트 컬럼 PATCH(필터에서 자동 탈락)이며, 본 테이블은 감사 로그.

begin;

create table if not exists public.smileedi_mail_sends (
  id                  uuid primary key default uuid_generate_v4(),
  sent_at             timestamptz not null default now(),
  fiscal_year_start   text not null,                 -- 'YYYYMMDD' (검색 시작일, 재현용)
  sender_email        text not null,                 -- 발신 운영자 본인 메일(UPN)
  sender_operator_id  uuid,                           -- operators.id (nullable)
  recipient_email     text not null,                 -- 담당자 수신 메일
  recipient_name      text,
  company_names       text[] not null default '{}',  -- 포함된 거래처명
  invoice_count       int not null default 0,        -- 발송 포함 세금계산서 건수
  total_supply_amount bigint not null default 0,     -- 공급가액 합계
  graph_message_id    text,
  status              text not null
                      check (status in ('sent', 'failed', 'dry_run')),
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists smileedi_mail_sends_set_updated_at on public.smileedi_mail_sends;
create trigger smileedi_mail_sends_set_updated_at
before update on public.smileedi_mail_sends
for each row execute function public.set_updated_at();

create index if not exists smileedi_mail_sends_sent_at_desc_idx
  on public.smileedi_mail_sends (sent_at desc);

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.smileedi_mail_sends
-- 기대: 14 컬럼 + sent_at desc 인덱스 + updated_at 트리거
