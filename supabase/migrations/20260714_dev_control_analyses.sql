-- 원서제어 JS 수집·AI 분석 결과 (PC cron scripts/dev-control-analyze.mjs 적재)
create table if not exists public.dev_control_analyses (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  gen_flag text not null default 'WA',
  kind text not null check (kind in ('A', 'AU')),
  code_hash text not null,
  raw_code text not null,
  summary_md text,
  flags jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz not null default now(),
  unique (service_id, gen_flag, kind)
);

alter table public.dev_control_analyses enable row level security;

-- 운영부 공개 read
create policy "dev_control_analyses_select" on public.dev_control_analyses
  for select to authenticated using (true);

-- 적재는 service_role만 (스크립트). flags 체크/메모 갱신도 server action이
-- service_role(admin client)로 수행 — authenticated write 정책 없음.

grant select on public.dev_control_analyses to authenticated;
grant all on public.dev_control_analyses to service_role;
