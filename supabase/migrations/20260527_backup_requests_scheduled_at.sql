-- PR-6: 백업 요청 예약 발송 — backup_requests.scheduled_at 추가 + mail_status enum 확장.
-- 자료요청(data_request_sends)과 동일 패턴.
-- scheduled: 예약 적재됨. cron이 due 도달 시 sending으로 잠금 후 발송.
-- sending: claim 후 발송 진행 중. 다음 cron run이 중복 발송 방지.

begin;

------------------------------------------------------------
-- 1) mail_status enum 확장 (scheduled / sending 추가)
------------------------------------------------------------

alter table public.backup_requests
  drop constraint if exists backup_requests_mail_status_check;

alter table public.backup_requests
  add constraint backup_requests_mail_status_check
  check (
    mail_status in (
      'pending',
      'scheduled',
      'sending',
      'sent',
      'mail_failed',
      'dry_run'
    )
  );

------------------------------------------------------------
-- 2) scheduled_at 컬럼 추가
------------------------------------------------------------

alter table public.backup_requests
  add column if not exists scheduled_at timestamptz;

------------------------------------------------------------
-- 3) cron 조회 인덱스 (mail_status, scheduled_at)
------------------------------------------------------------

create index if not exists backup_requests_scheduled_idx
  on public.backup_requests (mail_status, scheduled_at)
  where mail_status in ('scheduled', 'sending');

------------------------------------------------------------
-- 4) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 쿼리:
-- select conname from pg_constraint where conrelid = 'public.backup_requests'::regclass and conname like '%mail_status%';
-- → backup_requests_mail_status_check
-- select column_name, data_type from information_schema.columns where table_name='backup_requests' and column_name='scheduled_at';
-- → scheduled_at | timestamp with time zone
