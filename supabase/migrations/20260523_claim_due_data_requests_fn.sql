-- 만료된 예약 자료요청을 원자적으로 claim — status 'scheduled' → 'sending' (RETURNING).
-- dispatch 라우트가 rpc로 호출. 다음 cron run과 중복 발송 방지.
create or replace function public.claim_due_data_requests()
returns setof public.data_request_sends
language sql
as $$
  update public.data_request_sends
  set status = 'sending'
  where status = 'scheduled' and scheduled_at <= now()
  returning *;
$$;

grant execute on function public.claim_due_data_requests() to service_role;
