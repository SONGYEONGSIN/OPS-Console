-- data_request_sends.status 허용값 제약 (다른 *_mail_sends 테이블과 일관). 기존 행은 모두 허용 집합 내.
alter table public.data_request_sends drop constraint if exists data_request_sends_status_chk;
alter table public.data_request_sends
  add constraint data_request_sends_status_chk
  check (status in ('scheduled','sending','sent','failed','dry_run'));
