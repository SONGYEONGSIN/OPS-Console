-- incident_reports.handling_rows — 경위서 본문 "3. 처리" 시간/내용 2열 표 구조화
-- 실제 Word 양식 5건 전부 3.처리가 시간(시각)/내용 2열 표 → 자유 text(handling)를
-- 구조화 행으로 보관. 기존 handling text는 레거시 폴백으로 유지(미마이그레이션 행 표시용).
-- 형상: jsonb 배열 [{ "time": "...", "content": "..." }, ...]

begin;

alter table public.incident_reports
  add column if not exists handling_rows jsonb not null default '[]'::jsonb;

-- PostgREST schema reload
notify pgrst, 'reload schema';

commit;
