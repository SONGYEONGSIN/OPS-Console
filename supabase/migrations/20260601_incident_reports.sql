-- incident_reports — 경위서 도메인 (1차)
-- 사고(incidents)에서 생성하는 문서화→결재→발송 레이어. 4섹션 스냅샷 + 결재라인 + 상태.
-- SharePoint 연동(doc_number 채번/업로드)은 2차 — doc_number는 1차에서 null 허용.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.incident_reports (
  id                  uuid primary key default gen_random_uuid(),
  incident_id         uuid references public.incidents(id) on delete set null,
  recipient_university text not null,
  title               text not null,
  draft_date          date not null default current_date,
  gyeongwi            text,
  cause               text,
  handling            text,
  prevention          text,
  apology             text,
  author_name         text not null,
  author_email        text not null,
  approver_name       text,
  approver_email      text,
  director_name       text,
  ceo_name            text,
  status              text not null default 'draft'
                      check (status in ('draft','pending_approval','approved','rejected','sent')),
  reject_reason       text,
  approved_at         timestamptz,
  recipient_emails    text[] not null default '{}',
  doc_number          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists incident_reports_incident_id_idx on public.incident_reports (incident_id);
create index if not exists incident_reports_status_idx       on public.incident_reports (status);
create index if not exists incident_reports_created_at_idx   on public.incident_reports (created_at desc);

------------------------------------------------------------
-- 3) updated_at 자동
------------------------------------------------------------

drop trigger if exists incident_reports_set_updated_at on public.incident_reports;
create trigger incident_reports_set_updated_at
before update on public.incident_reports
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 4) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.incident_reports;  -- → 0
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'incident_reports';
-- → 25 columns
