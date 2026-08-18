-- assistant_requests.history — 같은 창에서 앞서 주고받은 대화.
--
-- 없으면 매 요청이 백지에서 시작해 "엔티티로 해주세요" 같은 이어 말하기가 통하지
-- 않는다. 화면에는 대화가 쌓여 보이므로 사용자는 그 어긋남을 알아채기 어렵다.
-- 빠른 답변(Gemini) 경로는 이미 history를 클라이언트에서 받고 있었고,
-- Claude 경로만 큐를 거치느라 빠져 있었다.
--
-- jsonb인 이유: [{role, content}] 배열이고 조회 조건으로 쓸 일이 없다.
-- 프롬프트에 싣는 양(턴 수·길이)은 서버가 자른다 — claude-prompt.ts

begin;

alter table public.assistant_requests
  add column if not exists history jsonb not null default '[]'::jsonb;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select column_name, data_type, column_default from information_schema.columns
--  where table_name = 'assistant_requests' and column_name = 'history';
-- 기대: history | jsonb | '[]'::jsonb
