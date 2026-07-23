-- 체크리스트 AI 보고리포트 — 회차별 생성된 서술형 리포트(정화된 HTML) + 생성 시각 저장.
-- 생성은 관리자 수동 트리거(claude -p, service_role 갱신), 조회는 저장본을 어디서나 렌더.
alter table checklist_rounds
  add column if not exists report_html text,
  add column if not exists report_generated_at timestamptz;
