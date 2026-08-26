-- Teams 봇: 답을 어디로 돌려줄지.
--
-- 별도 표를 만들지 않는다 — 봇도 웹과 **같은 큐**를 쓴다는 결정 때문이다.
-- 표가 갈리면 상태가 두 벌이 되고, 프롬프트·도구·빈틈 수집이 따라오지 않는다.
--
-- 셋 다 비어 있으면 웹에서 온 질문이다(flush 가 건너뛴다).
alter table public.assistant_requests
  -- 어느 대화로 답할지
  add column if not exists teams_conversation_id text,
  -- 고쳐 쓸 메시지. Teams 는 15초 안에 응답을 기대하는데 우리 답은 6~40초라,
  -- 먼저 '찾아보는 중'을 올리고 그 메시지를 나중에 고쳐 쓴다.
  add column if not exists teams_activity_id text,
  -- 테넌트·지역마다 다르다. 고정값으로 박으면 다른 지역에서 깨진다.
  add column if not exists teams_service_url text,
  -- 고쳐 쓰기까지 끝났는가. 없으면 cron 이 같은 건을 매분 다시 보낸다.
  add column if not exists teams_replied_at timestamptz;

-- flush 가 훑는 조건 그대로. 웹 요청(대부분)은 인덱스에 안 담긴다.
create index if not exists assistant_requests_teams_pending_idx
  on public.assistant_requests (requested_at)
  where teams_activity_id is not null and teams_replied_at is null;
