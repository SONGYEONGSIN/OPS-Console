-- 백업 요청 (backup) 도메인 — 휴가·외근 인수인계
-- 사이드바: '실시간 현황' > '백업 요청' (slug `backup`, pattern `list`)
-- 핵심: 요청자가 본인 담당 서비스를 백업자에게 인계, 메일 발송 시 PDF 첨부 + 팀원 CC
-- RLS는 별도 20260519b — select all / mutation은 admin OR requester_email
-- 메일 발송 이력은 별도 테이블 20260519c (receivables_mail_sends 패턴)

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.backup_requests (
  id                  uuid primary key default uuid_generate_v4(),
  requester_email     text not null,                              -- operators.email
  requester_team      text,                                       -- 발송 시 CC 산출용 (스냅샷)
  substitute_email    text not null,                              -- 백업자 (인계받는 동료)
  substitute_name     text not null,                              -- 메일 본문 표기용 스냅샷
  services            text[] not null default '{}',               -- 1차 자유 텍스트 chips
  contacts            text[] not null default '{}',               -- 1차 자유 텍스트 chips (대학 연락처)
  summary_md          text not null
                      check (char_length(summary_md) between 1 and 5000),
  leave_start_date    date,                                       -- 휴가/외근 시작
  leave_end_date      date,                                       -- 종료
  mail_status         text not null default 'pending'
                      check (mail_status in ('pending', 'sent', 'mail_failed', 'dry_run')),
  mail_sent_at        timestamptz,
  mail_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- 휴가 기간 제약: 둘 다 있을 때만 end >= start
  constraint backup_requests_leave_range_chk
    check (leave_end_date is null or leave_start_date is null or leave_end_date >= leave_start_date),
  -- self 차단
  constraint backup_requests_no_self_chk
    check (substitute_email <> requester_email)
);

-- updated_at 자동 (operators 마이그레이션의 set_updated_at 재사용)
drop trigger if exists backup_requests_set_updated_at on public.backup_requests;
create trigger backup_requests_set_updated_at
before update on public.backup_requests
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists backup_requests_requester_email_idx
  on public.backup_requests (requester_email);

create index if not exists backup_requests_substitute_email_idx
  on public.backup_requests (substitute_email);

create index if not exists backup_requests_created_at_desc_idx
  on public.backup_requests (created_at desc);

create index if not exists backup_requests_mail_status_idx
  on public.backup_requests (mail_status);

commit;

------------------------------------------------------------
-- 3) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.backup_requests
-- 기대: 14 컬럼 (id, requester_email, requester_team, substitute_email, substitute_name,
--                services, contacts, summary_md, leave_start_date, leave_end_date,
--                mail_status, mail_sent_at, mail_error, created_at, updated_at)
-- select indexname from pg_indexes where tablename='backup_requests' order by 1;
-- 기대: 4 user index + 1 pkey
