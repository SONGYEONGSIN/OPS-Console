-- 분석보고서 저장 테이블
-- KPI 스냅샷을 JSON으로 저장. 공유 토큰으로 외부 게스트 view 가능.

begin;

create table if not exists public.reports (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  -- 스냅샷 시점의 기간 enum 값 (this-week / this-month / last-month / quarter / year)
  period          text not null,
  period_start    date not null,
  period_end      date not null,
  -- KpiSnapshot.kpis (KpiItem[]) JSON 직렬화
  kpis            jsonb not null,
  status          text not null default 'completed'
                  check (status in ('draft', 'completed')),
  -- 외부 공유 토큰 (URL-safe UUID). 미공유 시 null
  share_token     text unique,
  created_by      text not null,                                -- operator email
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create index if not exists reports_created_at_desc_idx
  on public.reports (created_at desc);
create index if not exists reports_created_by_idx
  on public.reports (created_by);
create index if not exists reports_share_token_idx
  on public.reports (share_token) where share_token is not null;

commit;
