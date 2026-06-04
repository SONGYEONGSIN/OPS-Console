-- incidents.handling_rows — 사고보고 '처리'를 시간/내용 2열 표로 구조화.
-- 경위서(incident_reports.handling_rows, 20260617)와 동일 형상으로, 사고↔경위서 양방향 동기화의
-- 단일 소스가 된다. 기존 resolution(text)은 레거시 폴백으로 유지(미마이그 행 표시용).
-- 형상: jsonb 배열 [{ "time": "...", "content": "..." }, ...]

begin;

alter table public.incidents
  add column if not exists handling_rows jsonb not null default '[]'::jsonb;

-- PostgREST schema reload
notify pgrst, 'reload schema';

commit;
