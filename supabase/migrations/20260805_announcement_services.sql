-- 합격자통합관리시스템(발표) 서비스 카탈로그.
--
-- 백업 요청의 서비스 검색은 closing_services(원서접수)만 대상이었다. 발표 서비스는
-- Moa 스크래핑 대상이 아니라 별도 시스템의 자료라, closing_services에 섞으면 매일
-- 스크래핑이 덮어써서 지워진다 — 그래서 별도 테이블로 둔다.
--
-- 적재는 연락처 일괄등록과 같은 붙여넣기 방식(엑셀 표 복사). 자료가 '발표 회차' 단위라
-- 같은 서비스가 여러 줄로 오므로, 서비스 단위로 합쳐 최근 발표일만 남긴다.

begin;

create table if not exists public.announcement_services (
  id                uuid primary key default gen_random_uuid(),
  -- 합통 UnivServiceId. 원서접수(Moa) service_id와 체계가 다르다(6자리 vs 7자리).
  service_id        integer not null unique,
  university_id     integer,
  university_name   text not null,
  service_name      text not null,
  -- 이 서비스의 가장 최근 발표일시. 검색 후보 범위(최근 N년)를 정하는 기준.
  last_announce_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists announcement_services_university_idx
  on public.announcement_services (university_name);
create index if not exists announcement_services_announce_idx
  on public.announcement_services (last_announce_at desc);

drop trigger if exists announcement_services_set_updated_at
  on public.announcement_services;
create trigger announcement_services_set_updated_at
  before update on public.announcement_services
  for each row execute function public.set_updated_at();

-- RLS — read: authenticated 전체(운영부 공개) / write: service_role only.
-- 업로드는 server action(권한 검사 후 service_role)로만 수행한다.
alter table public.announcement_services enable row level security;

drop policy if exists "announcement_services_read_authenticated"
  on public.announcement_services;
create policy "announcement_services_read_authenticated"
  on public.announcement_services for select to authenticated using (true);

grant select on public.announcement_services to authenticated;
grant all on public.announcement_services to service_role;

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*), min(last_announce_at), max(last_announce_at)
--   from public.announcement_services;
