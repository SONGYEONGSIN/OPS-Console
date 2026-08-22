-- 만료된 예약 오픈안내를 원자적으로 claim — status 'scheduled' → 'sending' (RETURNING).
-- /api/open-notices/dispatch 가 rpc로 호출. 다음 cron run과 중복 발송 방지.
-- (claim_due_data_requests 와 같은 모양)
create or replace function public.claim_due_open_notices()
returns setof public.open_notice_sends
language sql
as $$
  update public.open_notice_sends
  set status = 'sending'
  where status = 'scheduled' and scheduled_at <= now()
  returning *;
$$;

grant execute on function public.claim_due_open_notices() to service_role;

-- 검증 (수동):
-- select * from claim_due_open_notices();  → 0행으로 성공
