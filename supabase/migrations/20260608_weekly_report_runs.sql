-- 본부차주보고 알림(weekly-report-rollover) 실행 기록
-- 잡이 매 실행 시 결과(created/skipped/dry_run/failed)를 1행 적재한다.
-- 발송/복제만 하고 DB 흔적이 없던 잡에 실행 로그를 부여 — 인스펙터 '실행 로그' 표시용.
-- RLS: select admin/member, write service_role only (server cron admin client).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.weekly_report_runs (
  id          uuid primary key default uuid_generate_v4(),
  ran_at      timestamptz not null default now(),         -- 실행 시각 (정렬 키)
  status      text not null
              check (status in ('created', 'skipped', 'dry_run', 'failed')),
  year        int,                                         -- 회차(연/월/주) — 파싱 실패 시 null
  month       int,
  week        int,
  file_name   text,                                        -- 차주 파일명
  sender      text,                                        -- 발송자(임형섭/전성대/허승철)
  share_link  text,                                        -- 공유 링크
  teams_sent  boolean not null default false,              -- Teams 발송 여부
  message     text,                                        -- 요약/에러 메시지
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists weekly_report_runs_set_updated_at on public.weekly_report_runs;
create trigger weekly_report_runs_set_updated_at
before update on public.weekly_report_runs
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스 — 최근 실행 조회(ran_at desc)
------------------------------------------------------------

create index if not exists weekly_report_runs_ran_at_desc_idx
  on public.weekly_report_runs (ran_at desc);

------------------------------------------------------------
-- 3) RLS — select admin/member, write service_role only
------------------------------------------------------------

alter table public.weekly_report_runs enable row level security;

drop policy if exists "weekly_report_runs_select" on public.weekly_report_runs;
create policy "weekly_report_runs_select"
  on public.weekly_report_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.operators
      where email = (auth.jwt() ->> 'email')
        and permission in ('admin', 'member')
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 — authenticated 차단, service_role(RLS bypass)만 쓰기.

grant select on public.weekly_report_runs to authenticated;
grant all on public.weekly_report_runs to service_role;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.weekly_report_runs
-- 기대: 13 컬럼 + select 정책 1
