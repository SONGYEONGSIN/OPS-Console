-- 어시스턴트 Claude 모드 요청 큐 (웹 → 회사 PC 상주 폴러, dev_control_analyze_requests와 동형)
--
-- Claude는 회사 PC의 구독(OAuth)으로만 돌고 Vercel에서 실행할 수 없다. 그래서 질문을
-- 여기 쌓고 폴러가 claim해 `claude -p`로 답을 만든 뒤 되돌려 적는다.
--
-- 질문·답은 본인 것만 읽는다 — 운영 데이터(worklog 등)와 달리 사람이 사적으로 묻는
-- 내용이 섞인다. 폴러는 service_role이라 이 정책과 무관하게 전건을 처리한다.
create table if not exists public.assistant_requests (
  id uuid primary key default gen_random_uuid(),
  operator_email text not null,
  question text not null,
  -- 질문 시점에 보고 있던 화면. 프롬프트에 한 줄로 들어간다.
  page_context text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  answer text,
  -- claude가 근거로 읽은 볼트 파일 경로. 답이 어디서 왔는지 화면에 드러내는 용도.
  sources text[] not null default '{}',
  -- 실패 사유 / exit code
  message text,
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz
);

alter table public.assistant_requests enable row level security;

create policy "assistant_requests_select_own"
  on public.assistant_requests
  for select to authenticated
  using (operator_email = auth.jwt() ->> 'email');

grant select on public.assistant_requests to authenticated;
grant all on public.assistant_requests to service_role;

-- 폴러가 매 2초 치는 쿼리(가장 오래된 pending 1건)를 받쳐준다.
create index if not exists assistant_requests_status_requested_idx
  on public.assistant_requests (status, requested_at);
