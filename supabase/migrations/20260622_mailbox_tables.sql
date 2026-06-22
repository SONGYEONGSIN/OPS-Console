-- 메일함 도메인 — 운영자별 Outlook 수신 메일 캐시 + 회신 초안/발송 이력 + 토글
-- 사이드바: '고객 응대' 그룹 > '메일함' (slug `mailbox`, pattern `list`)
-- Phase 1: messages / drafts / settings 3 테이블 (delegations는 Phase 2)
-- RLS는 별도 20260622b — worklog(service_role write) + contacts(authenticated read) 혼합 패턴

begin;

------------------------------------------------------------
-- 1) mailbox_messages — 수신 메일 캐시 (ingest 잡이 upsert)
------------------------------------------------------------
create table if not exists public.mailbox_messages (
  id                uuid primary key default uuid_generate_v4(),
  owner_email       text not null,                 -- 메일함 주인 (operators.email)
  graph_message_id  text not null unique,          -- Graph 메시지 id (멱등 upsert 키)
  from_name         text,
  from_email        text,
  subject           text,
  body_preview      text,
  body              text,
  received_at       timestamptz,
  is_read           boolean not null default false,
  draft_skipped     boolean not null default false, -- no-reply/자동발신 등 초안 생략
  created_at        timestamptz not null default now()
);

create index if not exists mailbox_messages_owner_received_idx
  on public.mailbox_messages (owner_email, received_at desc);

------------------------------------------------------------
-- 2) mailbox_drafts — 회신 초안 / 발송 이력
------------------------------------------------------------
create table if not exists public.mailbox_drafts (
  id            uuid primary key default uuid_generate_v4(),
  message_id    uuid not null references public.mailbox_messages(id) on delete cascade,
  draft_body    text,
  model_used    text,
  status        text not null default 'draft'
                check (status in ('draft','sent','discarded','dry_run')),
  sent_at       timestamptz,
  sent_by_email text,                              -- 실제 발송 클릭한 운영자 (감사 추적)
  created_at    timestamptz not null default now()
);

create index if not exists mailbox_drafts_message_idx
  on public.mailbox_drafts (message_id, created_at desc);

------------------------------------------------------------
-- 3) mailbox_settings — 메일함별 토글 + 증분 커서
------------------------------------------------------------
create table if not exists public.mailbox_settings (
  owner_email         text primary key,
  auto_draft_enabled  boolean not null default true,
  last_synced_at      timestamptz,
  updated_at          timestamptz not null default now()
);

-- updated_at 자동 (operators 마이그의 set_updated_at 재사용)
drop trigger if exists mailbox_settings_set_updated_at on public.mailbox_settings;
create trigger mailbox_settings_set_updated_at
before update on public.mailbox_settings
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
