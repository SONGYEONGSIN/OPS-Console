-- services 도메인 — 대학 입시 원서접수 서비스 카탈로그
-- 사이드바: '서비스사이클' > '전체 서비스' (slug `services`, pattern `list`)
-- 핵심: Google Sheets 2511행 일회성 import + Folio가 source-of-truth
-- 1차 PR: enum check 제약 없이 text 자유 입력 (실 데이터 분포 분석 후 follow-up에서 enum 도입)
-- RLS는 별도 20260520b — select 운영자 전원 / mutation도 운영자 전원

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.services (
  id                  uuid primary key default uuid_generate_v4(),
  service_id          bigint not null unique,                       -- 외부 PIMS 7자리 자연키 (Folio 자체 생성도 입력)
  application_type    text not null,                                -- 접수구분 (공통원서/반응형원서/일반접수/일반원서)
  region              text not null,                                -- 지역 (18 광역시도)
  university_name     text not null,                                -- 대학명 (별도 도메인 후보)
  service_name        text not null,                                -- 서비스명 (자유 텍스트)
  university_type     text not null,                                -- 대학구분 (4년제/2년제/대학원/...)
  category            text not null,                                -- 카테고리 (대학원/정시/수시/...)
  operator_email      text references public.operators(email) on update cascade on delete set null,
  operator_name       text,                                         -- text fallback (매칭 실패 시 스냅샷)
  developer_email     text references public.operators(email) on update cascade on delete set null,
  developer_name      text,
  write_start_at      timestamptz,
  write_end_at        timestamptz,
  pay_start_at        timestamptz,
  pay_end_at          timestamptz,
  solo                boolean not null default false,               -- 단독여부
  source              text not null default 'folio_create',         -- 'google_sheet_import' | 'folio_create'
  imported_at         timestamptz,                                  -- import 시각 (folio_create는 null)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- updated_at 자동 (operators 마이그레이션의 set_updated_at 재사용)
drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

-- service_id는 UNIQUE 제약으로 자동 인덱스
create index if not exists services_operator_email_idx
  on public.services (operator_email);
create index if not exists services_developer_email_idx
  on public.services (developer_email);
create index if not exists services_category_idx
  on public.services (category);
create index if not exists services_region_idx
  on public.services (region);
create index if not exists services_university_type_idx
  on public.services (university_type);
create index if not exists services_application_type_idx
  on public.services (application_type);
create index if not exists services_write_end_at_desc_idx
  on public.services (write_end_at desc nulls last);
create index if not exists services_pay_end_at_desc_idx
  on public.services (pay_end_at desc nulls last);

------------------------------------------------------------
-- 3) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;
