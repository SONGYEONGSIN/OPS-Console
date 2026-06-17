-- closing_scrape_requests — 서비스 마감 스크랩 '로컬 수동 실행' 원격 트리거 (풀 방식)
-- 웹앱/GitHub Actions는 Cloudflare 차단으로 스크랩 직접 실행 불가 → 회사 PC(residential IP)에서만 동작.
-- 웹 버튼이 pending 요청을 적재하면, 회사 PC 폴러가 claim(→running) 후 run-local 실행, 완료 보고(done/failed).
-- 쓰기는 server action / poller API가 service_role(admin client)로만 수행. 읽기는 운영부 전체.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.closing_scrape_requests (
  id           uuid primary key default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  requested_by text not null,
  status       text not null default 'pending'
               check (status in ('pending', 'running', 'done', 'failed')),
  claimed_at   timestamptz,
  finished_at  timestamptz,
  message      text,
  created_at   timestamptz not null default now()
);

------------------------------------------------------------
-- 2) 인덱스 — 폴러의 pending 조회 (가장 오래된 것 우선)
------------------------------------------------------------

create index if not exists closing_scrape_requests_pending_idx
  on public.closing_scrape_requests (requested_at)
  where status = 'pending';

------------------------------------------------------------
-- 3) RLS — read 운영부 전체 / write service_role only (server action·poller API)
------------------------------------------------------------

alter table public.closing_scrape_requests enable row level security;

drop policy if exists "closing_scrape_requests_select_all" on public.closing_scrape_requests;
create policy "closing_scrape_requests_select_all"
  on public.closing_scrape_requests for select
  to authenticated
  using (true);

------------------------------------------------------------
-- 4) GRANT — authenticated read, service_role 전체 (학습된 함정 42501)
------------------------------------------------------------

grant select on public.closing_scrape_requests to authenticated;
grant all on public.closing_scrape_requests to service_role;

------------------------------------------------------------
-- 5) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select column_name, data_type from information_schema.columns
--  where table_name = 'closing_scrape_requests';
-- select policyname, cmd from pg_policies where tablename = 'closing_scrape_requests'; → 1 (select)
