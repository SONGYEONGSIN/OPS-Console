-- 원서접수 GEN 세팅(WA/WB/PA/PB…) 변경 이력.
--
-- 수집 스크립트는 파일 해시를 비교해 **이미 변경을 감지하고 있었다**
-- (`prev.code_hash !== hash`). 다만 dev_control_analyses 가 upsert 라
-- 최신 상태만 남고 "누가 언제 세팅을 바꿨나"가 사라졌다. 여기에 append 한다.
--
-- dev_control_analyses 는 그대로 둔다 — 화면·쿼리가 최신 상태를 본다.
create table if not exists public.dev_control_setting_changes (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  file_name text not null,
  gen_flag text not null,
  kind text not null,
  code_hash text not null,
  -- null = 첫 관측(수집 시작). 세팅한 날이 아니므로 성과 집계에서 뺀다.
  prev_code_hash text,
  -- 관측 시점 services.operator_name 스냅샷. 담당이 바뀌어도 과거 행은
  -- 그때 담당자로 남는다 — 그게 맞다. FK 없음(services 는 연간 임포트).
  operator_name text,
  observed_at timestamptz not null default now()
);

create index if not exists dev_control_setting_changes_operator_idx
  on public.dev_control_setting_changes (operator_name, observed_at desc);
create index if not exists dev_control_setting_changes_service_idx
  on public.dev_control_setting_changes (service_id, observed_at desc);

alter table public.dev_control_setting_changes enable row level security;

create policy "dev_control_setting_changes_select"
  on public.dev_control_setting_changes
  for select to authenticated using (true);

grant select on public.dev_control_setting_changes to authenticated;
grant all on public.dev_control_setting_changes to service_role;

-- 기존 157행을 첫 관측으로 시드한다. analyzed_at 은 해시가 바뀐 때만 쓰이므로
-- '이 내용이 관측된 시각'이 맞다. 다만 125행이 한날(2026-07-17) 들어온
-- 대량 수집이라 **prev_code_hash 를 null 로 두어 성과 집계에서 제외**한다.
insert into public.dev_control_setting_changes
  (service_id, file_name, gen_flag, kind, code_hash, prev_code_hash, operator_name, observed_at)
select a.service_id, a.file_name, a.gen_flag, a.kind, a.code_hash, null, s.operator_name, a.analyzed_at
from public.dev_control_analyses a
left join public.services s on s.service_id = a.service_id
where not exists (
  select 1 from public.dev_control_setting_changes c
  where c.service_id = a.service_id and c.file_name = a.file_name and c.code_hash = a.code_hash
);
