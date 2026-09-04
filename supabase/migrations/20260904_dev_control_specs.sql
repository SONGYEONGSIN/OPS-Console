-- 원서제어 명세서 — 학교 담당자에게 보내는 문서
-- 설계: docs/superpowers/specs/2026-09-04-dev-control-spec-design.md

-- 1) 요청 큐에 kind 추가 — 새 테이블·새 폴러를 만들지 않는다.
--    등록해야 할 회사 PC 작업이 하나 더 늘면 그게 곧 죽는 지점이다.
--    ratio_audit_requests.kind 와 같은 방식.
alter table public.dev_control_analyze_requests
  add column if not exists kind text not null default 'analyze'
    check (kind in ('analyze', 'spec'));

-- 2) 명세서 — 서비스 단위로 하나. 분석은 파일 단위(A/AU)지만 학교에 나가는 문서는 한 장이다.
create table if not exists public.dev_control_specs (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null unique,
  -- 항목 배열: { key, title, body, included }
  -- key 가 안정적이어야 재생성해도 운영자의 '제외' 결정이 살아남는다.
  items jsonb not null default '[]'::jsonb,
  -- 코드를 걷어 온 시각(dev_control_analyses.analyzed_at 중 가장 이른 것).
  -- 학교에 나가는 문서라 수집 시점이 곧 신뢰다 — 화면과 메일 양쪽에 적는다.
  source_analyzed_at timestamptz,
  generated_at timestamptz not null default now()
);

alter table public.dev_control_specs enable row level security;

create policy "dev_control_specs_select"
  on public.dev_control_specs
  for select to authenticated using (true);

grant select on public.dev_control_specs to authenticated;
grant all on public.dev_control_specs to service_role;

-- 3) 발송 이력
create table if not exists public.dev_control_spec_sends (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  university_name text,
  to_email text not null,
  cc jsonb not null default '[]'::jsonb,
  subject text not null,
  -- 보낸 그대로 남긴다 — 나중에 항목을 바꿔도 '그때 무엇을 보냈는지'가 흔들리면 안 된다.
  body_html text,
  status text not null default 'sent'
    check (status in ('sent', 'dry_run', 'failed')),
  error_message text,
  sent_by text,
  sent_at timestamptz not null default now()
);

alter table public.dev_control_spec_sends enable row level security;

create policy "dev_control_spec_sends_select"
  on public.dev_control_spec_sends
  for select to authenticated using (true);

grant select on public.dev_control_spec_sends to authenticated;
grant all on public.dev_control_spec_sends to service_role;

create index if not exists dev_control_spec_sends_service_idx
  on public.dev_control_spec_sends (service_id, sent_at desc);
