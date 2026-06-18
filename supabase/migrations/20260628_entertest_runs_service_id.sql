-- entertest 재설계 — 실행 이력을 서비스(closing_services.service_id)에 연결.
-- 인스펙터에서 서비스별 로그 필터에 사용. 러너/ingest는 service_id를 모르며, insert(요청) 시점에만 기록.
alter table public.entertest_test_runs add column if not exists service_id bigint;

-- authenticated가 인스펙터 로그를 서비스별로 필터하려면 service_id를 읽어야 한다 → 컬럼 grant에 추가.
-- (test_account는 여전히 제외 — 본인 외 노출 금지)
grant select (id, requested_by, requested_at, target_url, status, claimed_at, finished_at, result, error_message, service_id)
  on public.entertest_test_runs to authenticated;

create index if not exists entertest_test_runs_service_idx on public.entertest_test_runs (service_id);
