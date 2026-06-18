-- entertest 원서접수 테스트 자동화 — 실행 이력.
-- pending → running(claim) → done/failed/error. result는 케이스별 결과 jsonb.
create table if not exists public.entertest_test_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  target_url text not null,
  test_account text,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','error')),
  claimed_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error_message text
);

alter table public.entertest_test_runs enable row level security;

-- 운영부 공개 read (로그인 사용자 전체)
drop policy if exists entertest_test_runs_read on public.entertest_test_runs;
create policy entertest_test_runs_read
  on public.entertest_test_runs for select
  to authenticated
  using (true);

-- test_account(ID=PW 동일, 재사용 계정)은 본인 외 노출 금지 → 컬럼 레벨 grant에서 제외.
-- 러너는 service_role(admin client)로 claim 시 test_account를 읽으므로 영향 없음.
grant select (
  id, requested_by, requested_at, target_url,
  status, claimed_at, finished_at, result, error_message
) on public.entertest_test_runs to authenticated;

create index if not exists entertest_test_runs_status_idx
  on public.entertest_test_runs (status, requested_at);
