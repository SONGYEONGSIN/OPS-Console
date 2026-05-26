-- 입금 매칭 자동화 잡 (receivables-deposit-match) 실행 이력
-- run당 1행: started_at / finished_at / mode / matched/mismatch/error 카운트 / payload(jsonb).
-- payload는 matched pairs + mismatches 객체 그대로 — 사후 GAS와의 결과 비교 시 raw로 사용.
-- RLS는 별도 정책으로 (insert는 service_role only — server action에서 admin client).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.receivables_match_runs (
  id              uuid primary key default uuid_generate_v4(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  mode            text not null check (mode in ('dry_run', 'live')),
  matched_count   int not null default 0,
  mismatch_count  int not null default 0,
  error_count     int not null default 0,
  payload         jsonb,                            -- { matched: [...], mismatches: [...], errors: [...] }
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists receivables_match_runs_set_updated_at on public.receivables_match_runs;
create trigger receivables_match_runs_set_updated_at
before update on public.receivables_match_runs
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists receivables_match_runs_started_at_desc_idx
  on public.receivables_match_runs (started_at desc);

create index if not exists receivables_match_runs_mode_started_at_idx
  on public.receivables_match_runs (mode, started_at desc);

------------------------------------------------------------
-- 3) RLS — select admin/member, write service_role only
------------------------------------------------------------

alter table public.receivables_match_runs enable row level security;

drop policy if exists "receivables_match_runs_select" on public.receivables_match_runs;
create policy "receivables_match_runs_select"
  on public.receivables_match_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

drop policy if exists "receivables_match_runs_insert_admin" on public.receivables_match_runs;
create policy "receivables_match_runs_insert_admin"
  on public.receivables_match_runs for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "receivables_match_runs_update_admin" on public.receivables_match_runs;
create policy "receivables_match_runs_update_admin"
  on public.receivables_match_runs for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.receivables_match_runs to authenticated;
grant all on public.receivables_match_runs to service_role;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.receivables_match_runs
-- select policyname, cmd from pg_policies where tablename = 'receivables_match_runs';
-- 기대: 12 컬럼 + 3 정책 (select / insert_admin / update_admin)
