-- PR-6: 예약된 백업 요청을 원자적으로 claim — mail_status 'scheduled' → 'sending' (RETURNING).
-- dispatch route(/api/backup-requests/dispatch)가 rpc로 호출. 다음 cron run과 중복 발송 방지.
-- 자료요청 claim_due_data_requests와 동일 패턴.

create or replace function public.claim_due_backup_requests()
returns setof public.backup_requests
language sql
as $$
  update public.backup_requests
  set mail_status = 'sending'
  where mail_status = 'scheduled' and scheduled_at <= now()
  returning *;
$$;

grant execute on function public.claim_due_backup_requests() to service_role;

-- 검증 쿼리:
-- select proname, prosrc from pg_proc where proname = 'claim_due_backup_requests';
