-- 경위서(incident_reports) 쓰기 잠금 — 결재·발송 칸은 서버(service_role)만 쓴다.
-- 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md
--
-- 1) authenticated 는 본문 칸만 고친다(칼럼 grant). 새 칼럼은 기본으로 막힌다 — 여기 적지 않으면 못 쓴다.
--    목록은 incidentReportUpdateSchema 키 + updated_at 과 같아야 한다(write-lock-migration.test.ts).
-- 2) 어느 행을: 작성자 또는 admin, 작성 중·반려만.
-- 3) insert·delete 는 authenticated 에게 없다 — 생성은 server action(service_role), 삭제는 사고 삭제의 cascade.
-- 4) revoke all 이 grant 보다 앞이어야 한다 — 테이블 권한을 회수하면 칼럼 권한도 같이 회수된다.
-- 적용 순서: 앱(admin client 전환) 배포가 먼저다. 이 파일을 먼저 적용하면 옛 앱의 생성·제출·승인이 42501 로 깨진다.

begin;

-- 이미 켜져 있다(20260601b). 정책이 있어도 꺼져 있으면 아무것도 안 막으므로 다시 적는다 — 멱등.
alter table public.incident_reports enable row level security;

revoke all on public.incident_reports from public, anon, authenticated;
grant select on public.incident_reports to authenticated;
grant update (
  recipient_university, title, gyeongwi, cause, handling, handling_rows,
  prevention, apology, greeting, closing, updated_at
) on public.incident_reports to authenticated;
grant all on public.incident_reports to service_role;

drop policy if exists incident_reports_insert on public.incident_reports;
drop policy if exists incident_reports_delete on public.incident_reports;

drop policy if exists incident_reports_update on public.incident_reports;
create policy incident_reports_update on public.incident_reports
  for update to authenticated
  using (
    status in ('draft', 'rejected')
    and (author_email = (select auth.jwt() ->> 'email') or (select public.is_admin()))
  )
  with check (
    status in ('draft', 'rejected')
    and (author_email = (select auth.jwt() ->> 'email') or (select public.is_admin()))
  );

notify pgrst, 'reload schema';

commit;
