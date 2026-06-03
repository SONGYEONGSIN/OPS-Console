-- incident_reports — 결재라인 직책(role) 동적 표시
-- 결재자(팀장/본부장/사장 등)의 실제 operators.role을 경위서 생성 시 스냅샷 저장하여
-- 공문 결재란에 고정 라벨이 아닌 실제 직책으로 표시한다. (담당자=기안자 고정 라벨)
-- 레거시 행(null)은 표시 시 기본 라벨(팀장/본부장/사장)로 폴백.

begin;

alter table public.incident_reports
  add column if not exists approver_role text,
  add column if not exists director_role text,
  add column if not exists ceo_role     text;

notify pgrst, 'reload schema';

commit;
