-- worklog: 운영부 활동 자동 로그 (handover/incidents/services/contacts/contracts 등)
-- server action에서 결과 OK 후 insert. 페이지에서는 시계열 표시 + 필터.

begin;

create table if not exists public.worklog (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- 로그 레벨 (LogLine.level과 매칭)
  level        text not null default 'INFO'
                  check (level in ('INFO', 'WARN', 'ERROR', 'DEBUG')),
  -- 액션 수행자 (시스템 액션이면 null)
  user_email   text,
  user_name    text,
  -- 도메인 ID (handover/incidents/services/contacts/contracts/handover-progress 등)
  domain       text not null,
  -- 액션 유형 (create/update/delete/upsert/confirm/cancel/mail_sent 등)
  action       text not null,
  -- 대상 식별 (선택)
  target_type  text,
  target_id    text,
  target_name  text,
  -- 한 줄 메시지 (LogPattern.msg)
  msg          text not null,
  -- 변경 전후 값, 추가 컨텍스트 (선택)
  metadata     jsonb
);

create index if not exists worklog_created_idx
  on public.worklog (created_at desc);
create index if not exists worklog_domain_idx
  on public.worklog (domain, created_at desc);
create index if not exists worklog_user_idx
  on public.worklog (user_email, created_at desc);
create index if not exists worklog_level_idx
  on public.worklog (level, created_at desc);

commit;

notify pgrst, 'reload schema';
