-- 서비스 마감(closing) — Moa 서비스조회 엑셀 스크래핑으로 적재되는 마감 서비스 스냅샷.
-- 인제스트 API(/api/closing/ingest)가 격주 배치로 전체 대체(delete-all + insert)한다.

begin;

create table if not exists public.closing_services (
  id              uuid primary key default uuid_generate_v4(),
  service_id      integer not null unique,        -- Moa 서비스ID (멱등 키)
  university_name text not null,                   -- 대학명
  region          text,                            -- 지역
  service_name    text not null,                   -- 서비스명
  university_type text,                            -- 대학구분
  category        text,                            -- 카테고리
  operator_name   text,                            -- 운영자 (Moa 표기)
  developer_name  text,                            -- 개발자 (Moa 표기)
  write_start_at  timestamptz,                     -- 작성시작
  write_end_at    timestamptz not null,            -- 작성마감 (마감 필터 기준)
  solo            boolean not null default false,  -- 단독여부
  scraped_at      timestamptz not null,            -- 스크래핑 시각 (배치 식별 + 마감판정 기준)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists closing_services_set_updated_at on public.closing_services;
create trigger closing_services_set_updated_at
before update on public.closing_services
for each row execute function public.set_updated_at();

create index if not exists closing_services_write_end_at_idx
  on public.closing_services (write_end_at desc);
create index if not exists closing_services_scraped_at_idx
  on public.closing_services (scraped_at desc);

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.closing_services
-- 기대: 15 컬럼 + service_id unique + write_end_at/scraped_at 인덱스 + updated_at 트리거
