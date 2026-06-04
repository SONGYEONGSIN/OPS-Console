-- incident_reports.service_name — 경위서 승인 시 동결 스냅샷용 서비스명.
-- draft 상태에서는 연결 사고(incidents.service_name)에서 라이브로 가져와 표시하고,
-- 승인 시 그 시점 값을 이 컬럼에 박아 공문이 사고 수정에 영향받지 않게 한다.

begin;

alter table public.incident_reports
  add column if not exists service_name text;

notify pgrst, 'reload schema';

commit;
