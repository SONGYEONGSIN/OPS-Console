-- handover_records — 인수인계 내용 (PR-8 PR-A)
-- services 1:1 매핑. 14 markdown sub-field + status 추적.
-- 카테고리: 계약(2) / 작업(7) / 정산(2) / 연락처(1) / 서류제출(1) / 기타(1) = 14

begin;

create table if not exists public.handover_records (
  id                 uuid primary key default gen_random_uuid(),
  service_id         uuid not null unique
                       references public.services(id) on delete cascade,
  -- 계약 (2)
  contract_info_md   text,
  contract_data_md   text,
  -- 작업 (7)
  work_basic_md      text,
  work_generator_md  text,
  work_site_md       text,
  work_output_md     text,
  work_rate_md       text,
  work_file_md       text,
  work_etc_md        text,
  -- 정산 (2)
  payment_fee_md     text,
  payment_invoice_md text,
  -- 연락처 (1)
  school_contact_md  text,
  -- 서류제출 (1)
  docs_md            text,
  -- 기타 (1)
  notes_md           text,
  -- 메타
  author_email       text not null,
  author_name        text not null,
  status             text not null default 'draft'
                       check (status in ('draft','ready','published')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists handover_records_service_idx on public.handover_records (service_id);
create index if not exists handover_records_status_idx  on public.handover_records (status);

notify pgrst, 'reload schema';

commit;
