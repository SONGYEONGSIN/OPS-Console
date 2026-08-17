-- 어시스턴트가 답하지 못한 것 — 지식망의 빈틈
--
-- 지금은 "볼트에 없습니다"가 답변 본문 안 문장으로만 존재해 기계가 못 읽는다.
-- 에이전트가 도구로 직접 남기게 해서, 무엇이 없어서 못 답했는지를 세 갈래로 구분한다.
--
-- 구분이 중요한 이유: '문서 없음'과 '깊이 부족'을 섞으면 이미 있는 문서의
-- 중복본을 만들게 된다. 실제로 '백업요청 어떻게 해?'는 문서 3건을 읽고도
-- "버튼 클릭 단위 순서는 없다"고 답했다 — 그건 새 문서가 아니라 보강 대상이다.
create table if not exists public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  -- missing: 주제 자체가 볼트에 없음 → 새 문서 후보
  -- shallow: 문서는 있는데 그 층위가 없음 → 기존 문서 보강 (새 문서 아님)
  -- tool:    문서가 아니라 시스템 데이터 → 도구 추가 후보
  kind text not null check (kind in ('missing', 'shallow', 'tool')),
  -- 빠진 지식의 주제. 같은 주제가 반복되는지 세는 기준이라 짧고 일반적으로.
  topic text not null,
  -- 무엇이 어떻게 부족했는지 한두 문장
  note text,
  -- shallow일 때 근처까지 갔던 문서들 — 어디를 보강할지 바로 알 수 있다
  near_paths text[] not null default '{}',
  -- 어떤 질문에서 나왔나
  question text not null,
  request_id uuid references public.assistant_requests (id) on delete set null,
  operator_email text,
  -- open: 아직 안 채움 / resolved: 문서가 생김 / dismissed: 채울 필요 없음
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.knowledge_gaps enable row level security;

-- 빈틈은 운영부 공개다 — 누가 물었든 채우는 건 팀의 일이다.
create policy "knowledge_gaps_select"
  on public.knowledge_gaps
  for select to authenticated using (true);

grant select on public.knowledge_gaps to authenticated;
grant all on public.knowledge_gaps to service_role;

-- 화면이 '주제별로 몇 번' 묶어 보여준다.
create index if not exists knowledge_gaps_status_topic_idx
  on public.knowledge_gaps (status, topic);
