-- 빈틈이 초안을 가리키게 한다.
--
-- 같은 대화에서 report_gap 과 propose_doc 이 둘 다 불릴 수 있는데 서로를 몰랐다.
-- 실제로 '대학별 수시 인수인계' 빈틈이 "문서 없음"으로 떠 있는 동안
-- 제안/부산대학교 수시 서비스 세팅.md 가 이미 검토를 기다리고 있었다.
--
-- 제목으로는 못 잇는다(위 두 이름이 안 겹친다). 잇는 열쇠는 **같은 대화**다 —
-- 폴러가 처리 중인 request_id 로 정확히 맞춘다.
alter table public.knowledge_gaps
  add column if not exists proposal_path text;

-- 사람이 닫을 수 있어야 한다. status 컬럼은 처음부터 있었지만
-- open 이 아닌 값으로 바꾸는 경로가 없어 목록이 쌓이기만 했다.
alter table public.knowledge_gaps
  add column if not exists resolved_by text,
  add column if not exists resolved_at timestamptz;
