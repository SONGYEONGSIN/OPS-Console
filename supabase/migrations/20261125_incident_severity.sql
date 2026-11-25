-- 사고 등급(incidents.severity) + 등급별 판단 기준(incident_severity_criteria)
-- severity: 신규 보고부터 앱(zod·폼)에서 필수. 기존 행은 NULL 로 둔다 → NOT NULL 아님.
-- 기준: 전원 읽기(폼 툴팁). 쓰기는 server action 이 admin 을 다시 확인한 뒤 service_role 로만.
--       등급 이름은 PK CHECK 로 고정, 설명만 바뀐다. seed 가 기본 문구의 유일한 원천.
begin;

alter table public.incidents
  add column if not exists severity text;

alter table public.incidents
  drop constraint if exists incidents_severity_check;
alter table public.incidents
  add constraint incidents_severity_check
  check (severity is null or severity in ('심각','높음','보통','낮음'));

create table if not exists public.incident_severity_criteria (
  severity text primary key check (severity in ('심각','높음','보통','낮음')),
  description text not null check (char_length(description) between 1 and 500),
  updated_by text,
  updated_at timestamptz not null default now()
);

drop trigger if exists incident_severity_criteria_set_updated_at on public.incident_severity_criteria;
create trigger incident_severity_criteria_set_updated_at before update on public.incident_severity_criteria
for each row execute function public.set_updated_at();

alter table public.incident_severity_criteria enable row level security;
revoke all on public.incident_severity_criteria from public, anon, authenticated;
grant select on public.incident_severity_criteria to authenticated;
grant all on public.incident_severity_criteria to service_role;
drop policy if exists "incident_severity_criteria_select" on public.incident_severity_criteria;
create policy "incident_severity_criteria_select" on public.incident_severity_criteria
  for select to authenticated using (true);

insert into public.incident_severity_criteria (severity, description) values
  ('심각', '다수 지원자·여러 대학에 영향, 또는 금전(전형료·환불)/개인정보 노출, 또는 대학 공식 항의·언론 위험 (예: 수험표 전체 노출, 5,771명 오발송)'),
  ('높음', '여러 지원자에게 영향, 재안내·재처리 필요 (예: 수험번호 오발번 후 재발번·문자 안내)'),
  ('보통', '일부 지원자에게 영향, 수정 후 개별 안내 (예: 몇 명 결제 후 미접수 → 강제접수)'),
  ('낮음', '지원자 영향 없음 (사전 발견, 표기만 수정) (예: 수험표 시험시간 오표기를 접수 전 수정)')
on conflict (severity) do nothing;

notify pgrst, 'reload schema';
commit;
