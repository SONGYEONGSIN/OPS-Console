-- 대학 연락처 도메인 — 학교 담당자 연락처 카탈로그
-- 사이드바: '운영' 그룹 > '대학 연락처' (slug `contacts`, pattern `list`)
-- 1차 PR: enum check 미적용 — 전 컬럼 text 자유 입력 (실 데이터 분포 분석 후 follow-up enum 도입)
-- RLS는 별도 20260523b — services RLS 1:1 복제 패턴

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.contacts (
  id                  uuid primary key default uuid_generate_v4(),
  customer_active     text not null default '재직',     -- 재직 / 타부서 이동
  customer_name       text not null,                    -- 고객명
  job_title           text,                             -- 직함 (직원/과장/주임/계장/부처장/팀장 등 자유)
  university_name     text not null,                    -- 대학명 (free text, services.university_name 자동완성은 follow-up)
  department_name     text,                             -- 소속부서 (일반대학원/입학팀/입학처 등)
  job_role            text,                             -- 직책 (실무자 / 관리자)
  management_grade    text,                             -- 관리 등급 (A/B/C/D)
  relationship_grade  text,                             -- 관계 등급 (우호적/...)
  contact_phone       text,                             -- 연락처 (휴대폰)
  contact_ext         text,                             -- 연락처 (내선)
  contact_email       text,                             -- 이메일
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- updated_at 자동 (operators 마이그레이션의 set_updated_at 재사용)
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists contacts_university_name_idx
  on public.contacts (university_name);
create index if not exists contacts_customer_active_idx
  on public.contacts (customer_active);
create index if not exists contacts_job_role_idx
  on public.contacts (job_role);
create index if not exists contacts_management_grade_idx
  on public.contacts (management_grade);
create index if not exists contacts_relationship_grade_idx
  on public.contacts (relationship_grade);

------------------------------------------------------------
-- 3) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;
