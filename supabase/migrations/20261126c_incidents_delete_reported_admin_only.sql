-- 사고(incidents) 삭제 — 승인·발송된 경위서가 있는 사고는 admin 만 지운다.
-- 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md §5
-- 경위서는 사고 삭제의 FK cascade 로, 그 발송 이력(incident_report_mail_sends)은 다시 cascade 로 지워진다.
-- 담당자 본인이라도 발송까지 끝난 공문 기록을 혼자 지우지 못하게 한다(사용자 결정 2026-11-26 '관리자만 삭제').
-- 앱 deleteIncident 가 같은 조건을 먼저 보고 이유를 알려 준다 — 이 정책은 두 번째 겹이다.
-- 이전 정의: 20260527c_incidents_delete_self_or_admin.sql (admin OR assignee). 롤백은 설계 §6-3.

begin;

-- 이미 켜져 있다(20260526b). 정책이 있어도 꺼져 있으면 아무것도 안 막으므로 다시 적는다 — 멱등.
alter table public.incidents enable row level security;

drop policy if exists "incidents_delete_admin_or_assignee" on public.incidents;
create policy "incidents_delete_admin_or_assignee"
  on public.incidents for delete
  to authenticated
  using (
    (select public.is_admin())
    or (
      assignee_email = (select auth.jwt() ->> 'email')
      and not exists (
        select 1 from public.incident_reports r
        where r.incident_id = incidents.id
          and r.status in ('approved', 'sent')
      )
    )
  );

notify pgrst, 'reload schema';

commit;
