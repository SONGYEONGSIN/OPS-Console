-- 서비스 마감 스크래핑(closing-scrape) 실행 기록
-- OPS는 GitHub Action을 트리거만 하고 스크랩/적재는 액션에서 일어나므로,
-- 스크래퍼가 최종 결과(success/skipped/failed)를 /api/closing/run-log로 보고해 1행 적재한다.
-- 이로써 '실행했으나 로그인 실패' 같은 케이스도 인스펙터 '실행 로그'에 표시된다.
-- RLS: select admin/member, write service_role only (스크래퍼는 CRON_SECRET 인증 후 server admin client).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.closing_scrape_runs (
  id             uuid primary key default uuid_generate_v4(),
  ran_at         timestamptz not null default now(),       -- 실행(보고) 시각 (정렬 키)
  status         text not null
                 check (status in ('success', 'skipped', 'failed')),
  service_count  int not null default 0,                   -- success 시 적재 건수
  message        text,                                     -- 요약/에러 사유
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists closing_scrape_runs_set_updated_at on public.closing_scrape_runs;
create trigger closing_scrape_runs_set_updated_at
before update on public.closing_scrape_runs
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스 — 최근 실행 조회(ran_at desc)
------------------------------------------------------------

create index if not exists closing_scrape_runs_ran_at_desc_idx
  on public.closing_scrape_runs (ran_at desc);

------------------------------------------------------------
-- 3) RLS — select admin/member, write service_role only
------------------------------------------------------------

alter table public.closing_scrape_runs enable row level security;

drop policy if exists "closing_scrape_runs_select" on public.closing_scrape_runs;
create policy "closing_scrape_runs_select"
  on public.closing_scrape_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated 차단, service_role(RLS bypass)만 쓰기.

grant select on public.closing_scrape_runs to authenticated;
grant all on public.closing_scrape_runs to service_role;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.closing_scrape_runs
-- 기대: 7 컬럼 + select 정책 1
