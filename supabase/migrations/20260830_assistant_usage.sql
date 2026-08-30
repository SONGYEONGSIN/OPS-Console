-- 어시스턴트 토큰·비용.
--
-- 폴러는 Agent SDK 의 result 메시지에서 usage·total_cost_usd 를 **이미 받고 있었다.**
-- `m.result` 만 꺼내 쓰고 나머지를 버렸을 뿐이다(serve-local.mjs). 그래서 지금까지
-- "에이전트가 얼마나 쓰는가"에 답할 수 없었다 — 전 78개 테이블에 토큰 컬럼이 없다.
--
-- 별도 표를 만들지 않는다. 요청 한 건이 곧 한 번의 실행이라 같은 행에 붙는 게 맞고,
-- 표가 갈리면 조인 없이 "이 질문이 얼마였나"를 못 본다.
alter table public.assistant_requests
  -- 입력·출력·캐시 읽기. 캐시는 따로 세야 한다 — 같은 볼트를 매번 읽으므로
  -- 캐시 적중이 비용의 대부분을 좌우한다.
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists cache_read_tokens integer,
  -- SDK 가 계산해 준 값. 우리가 단가표를 들고 있으면 모델이 바뀔 때 조용히 틀린다.
  add column if not exists cost_usd numeric,
  -- 어느 모델이었나. 요금이 바뀌면 과거 값을 재해석해야 한다.
  add column if not exists model text,
  -- 몇 턴 돌았나. 비용이 튀는 건 대개 턴이 늘어서다.
  add column if not exists num_turns integer;

-- 기간별 사용량 집계가 이 컬럼들을 훑는다. 토큰이 있는 행만 대상이다.
create index if not exists assistant_requests_usage_idx
  on public.assistant_requests (requested_at)
  where input_tokens is not null;
