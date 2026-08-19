-- 우편물 2단계 — 영수증 판독 요청 큐.
--
-- 판독은 이미지를 봐야 하는데 API 키가 없어(구독 경로) Vercel에서 못 한다.
-- 어시스턴트와 같은 구조로 회사 PC 폴러가 Agent SDK로 Read 해 읽는다.
create table if not exists public.postal_extract_requests (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null
    references public.postal_receipts (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  -- 판독 원문(JSON). 검토 화면이 이걸 읽어 표를 그린다. 확정 전까지
  -- postal_items 에는 넣지 않는다 — 사람이 본 것만 들어간다.
  result jsonb,
  -- 합계 검산 등 기계가 먼저 잡은 것. 사람이 보기 전에 화면에 띄운다.
  warnings text[] not null default '{}',
  message text,
  requested_by text not null,
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz
);

alter table public.postal_extract_requests enable row level security;

-- 우편 발송은 운영부 공동 업무라 열람은 공개. 쓰기는 service_role(서버)만.
create policy "postal_extract_requests_select"
  on public.postal_extract_requests
  for select to authenticated using (true);

grant select on public.postal_extract_requests to authenticated;
grant all on public.postal_extract_requests to service_role;

-- 폴러가 2초마다 치는 쿼리(가장 오래된 pending 1건).
create index if not exists postal_extract_requests_status_idx
  on public.postal_extract_requests (status, requested_at);
create index if not exists postal_extract_requests_receipt_idx
  on public.postal_extract_requests (receipt_id);
