-- incident_reports.greeting / closing — 공문 1번 인사말·3번 맺음말 사용자 편집값.
-- null이면 자동 문구 사용(인사말=수신대학 기반, 맺음말="감사합니다."). 사과문(apology)과 동일하게
-- 경위서(report) 소유 — 공문 양식 문구라 사고 사실이 아님.

begin;

alter table public.incident_reports
  add column if not exists greeting text,
  add column if not exists closing  text;

notify pgrst, 'reload schema';

commit;
