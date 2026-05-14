-- backup_requests.services text[] 컬럼 drop — PR-2 N:M FK 진화 완료
-- 컨텍스트: 자유 텍스트 chips를 backup_request_services join table로 대체 (20260521 / 20260521b)
-- 사전 조건: prod 0행 검증 완료 — 데이터 손실 없음 (brainstorm 단계 검증)
--
-- 롤백 SQL (필요 시):
--   alter table public.backup_requests add column services text[] not null default '{}';
--   notify pgrst, 'reload schema';
-- 단, 롤백 시점에 backup_request_services에 데이터가 있다면 text[] 복구 필요 — 본 PR 머지 이후 신규 행 발생 시 롤백 불완전 위험.

begin;

alter table public.backup_requests
  drop column if exists services;

commit;

-- PostgREST schema cache reload (컬럼 제거 반영)
notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.backup_requests
-- 기대: services 컬럼 부재 (14 → 13 컬럼)
