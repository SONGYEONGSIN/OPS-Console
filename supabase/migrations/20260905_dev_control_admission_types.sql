-- 서비스별 전형 이름표 — 학교 명세서가 전형을 이름으로 부르게 한다.
--
-- 원서제어 코드에는 `SelTypeCode` 와 전형 이름이 이어진 자리가 **없다**(실측:
-- 같은 줄에 있는 건 1~18 나열 한 줄뿐). 그래서 명세서가 `전형 코드 5` 로만
-- 적혔다. 대학이 주는 접수 현황 자료에 그 대응이 들어 있어 붙여넣어 채운다.
create table if not exists public.dev_control_admission_types (
  service_id bigint not null,
  -- 원서제어 JS 의 SelTypeCode.
  sel_type_code integer not null,
  -- 대학이 전산매체로 주고받는 코드(레이아웃 문서의 지원전형유형코드). 참고용.
  univ_code text,
  name text not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (service_id, sel_type_code)
);

alter table public.dev_control_admission_types enable row level security;

create policy "dev_control_admission_types_select"
  on public.dev_control_admission_types
  for select to authenticated using (true);

grant select on public.dev_control_admission_types to authenticated;
grant all on public.dev_control_admission_types to service_role;
