-- 경위서→사고보고 통합: incident_reports.incident_id 필수화.
-- 사고 1건 ↔ 경위서 0..1 (사고당 경위서 최대 1건). 경위서는 항상 사고 컨텍스트에서 생성.
-- 전제: incident_reports 데이터 0건 (실사용 전). standalone(incident_id null) 있으면
-- NOT NULL 적용이 실패해 안전 차단된다. (적용 전 수동 검증: null 0건 확인)

begin;

alter table public.incident_reports
  alter column incident_id set not null;

alter table public.incident_reports
  add constraint incident_reports_incident_id_unique unique (incident_id);

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.incident_reports where incident_id is null;  -- → 0 (적용 전)
-- \d public.incident_reports  -- incident_id not null + unique 제약 확인
