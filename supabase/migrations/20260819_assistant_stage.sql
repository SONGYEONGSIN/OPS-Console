-- 지금 무엇을 하고 있는지 화면에 흘린다.
--
-- 진행 문구가 둘뿐이었고 둘 다 고정이라, 30~40초 걸리는 동안 멈춘 것처럼 보였다.
-- 폴러는 이미 도구 호출을 실시간으로 받고 있으므로 그걸 여기에 남기고 화면이 읽는다.
alter table public.assistant_requests
  add column if not exists stage text;

-- 언제 갱신됐는지 — 오래된 단계가 그대로 떠 있으면 그것도 멈춘 것처럼 보인다.
alter table public.assistant_requests
  add column if not exists stage_at timestamptz;
