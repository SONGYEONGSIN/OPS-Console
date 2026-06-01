-- 경위서 메일 발송 이력
-- 발송 시각 / 발신자(작성자) / 수신자 / 연결 report / Graph 메시지 ID / 상태.
-- 재발송 시 row 누적. incident_mail_sends 스키마 동일 구조.
-- RLS는 본 파일 하단에 함께 적용 (read 전원 / insert·update·delete admin only).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.incident_report_mail_sends (
  id                    uuid primary key default uuid_generate_v4(),
  sent_at               timestamptz not null default now(),
  sender_operator_id    uuid references public.operators(id) on delete set null,
  report_id             uuid references public.incident_reports(id) on delete cascade,
  recipient_email       text not null,                              -- 수신자 이메일
  recipient_name        text,                                       -- 수신자 이름 (스냅샷)
  graph_message_id      text,                                       -- Graph sendMail 응답 ID (실패 시 null)
  status                text not null
                        check (status in ('sent', 'failed', 'dry_run')),
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists incident_report_mail_sends_set_updated_at on public.incident_report_mail_sends;
create trigger incident_report_mail_sends_set_updated_at
before update on public.incident_report_mail_sends
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists incident_report_mail_sends_sender_idx
  on public.incident_report_mail_sends (sender_operator_id);

create index if not exists incident_report_mail_sends_report_idx
  on public.incident_report_mail_sends (report_id);

create index if not exists incident_report_mail_sends_sent_at_desc_idx
  on public.incident_report_mail_sends (sent_at desc);

create index if not exists incident_report_mail_sends_status_sent_at_idx
  on public.incident_report_mail_sends (status, sent_at desc);

------------------------------------------------------------
-- 3) RLS — SELECT 전원 read / INSERT·UPDATE·DELETE admin only
--          (실제 메일 발송 server action은 service_role bypass)
------------------------------------------------------------

alter table public.incident_report_mail_sends enable row level security;

drop policy if exists "incident_report_mail_sends_select_all" on public.incident_report_mail_sends;
create policy "incident_report_mail_sends_select_all"
  on public.incident_report_mail_sends for select
  to authenticated
  using (true);

drop policy if exists "incident_report_mail_sends_insert_admin" on public.incident_report_mail_sends;
create policy "incident_report_mail_sends_insert_admin"
  on public.incident_report_mail_sends for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "incident_report_mail_sends_update_admin" on public.incident_report_mail_sends;
create policy "incident_report_mail_sends_update_admin"
  on public.incident_report_mail_sends for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "incident_report_mail_sends_delete_admin" on public.incident_report_mail_sends;
create policy "incident_report_mail_sends_delete_admin"
  on public.incident_report_mail_sends for delete
  to authenticated
  using (public.is_admin());

------------------------------------------------------------
-- 4) GRANT
------------------------------------------------------------

grant select on public.incident_report_mail_sends to authenticated;
grant insert, update, delete on public.incident_report_mail_sends to authenticated;
grant all on public.incident_report_mail_sends to service_role;

commit;

------------------------------------------------------------
-- 5) PostgREST cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.incident_report_mail_sends
-- 기대: 11 컬럼
-- select policyname, cmd from pg_policies where tablename = 'incident_report_mail_sends';
-- 기대: select_all / insert_admin / update_admin / delete_admin (4개)
