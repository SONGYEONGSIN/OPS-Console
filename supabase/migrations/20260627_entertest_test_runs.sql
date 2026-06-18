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

grant select on public.entertest_test_runs to authenticated;

create index if not exists entertest_test_runs_status_idx
  on public.entertest_test_runs (status, requested_at);
