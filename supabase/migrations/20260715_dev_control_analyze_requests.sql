-- 개발 탭 원서제어 '수동 분석' 요청 큐 (웹 → PC 폴러 풀 트리거, closing_scrape_requests와 동형)
create table if not exists public.dev_control_analyze_requests (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  requested_by text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  message text
);

alter table public.dev_control_analyze_requests enable row level security;

create policy "dev_control_analyze_requests_select"
  on public.dev_control_analyze_requests
  for select to authenticated using (true);

grant select on public.dev_control_analyze_requests to authenticated;
grant all on public.dev_control_analyze_requests to service_role;

create index if not exists dev_control_analyze_requests_service_status_idx
  on public.dev_control_analyze_requests (service_id, status);
