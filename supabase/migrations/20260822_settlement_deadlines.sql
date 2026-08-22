-- 대학별 전형료 정산기한.
--
-- 정산은 결제가 끝난 뒤 **대학마다 정한 기한**(5·10·20·30일) 안에 해야 한다.
-- 그 기한이 없으면 정산 화면은 서비스마감과 같은 목록이 된다 — `listClosing` 이
-- 이미 `pay_end_at` 기준으로 거르기 때문이다.
--
-- 서비스가 아니라 **대학** 단위다. 같은 대학의 수시·정시가 기한을 따로 갖지 않는다.
-- 그래서 한 서비스에서 정해두면 그 대학 전체에 적용된다.
--
-- 인수인계 폼(`handover/payment-fields.ts`)의 정산기한과 같은 선택지를 쓴다.
-- 두 곳이 갈라지면 어느 쪽이 맞는지 알 수 없다.
create table if not exists public.settlement_deadlines (
  -- closing_services.university_name 과 맞춘다. 정식 명칭이 그쪽 표기다.
  university_name text primary key,
  days integer not null check (days in (5, 10, 20, 30)),
  updated_by text not null,
  updated_at timestamptz not null default now()
);

alter table public.settlement_deadlines enable row level security;

-- 운영부 공동 업무라 열람은 공개, 쓰기는 서버(service_role)만.
create policy "settlement_deadlines_select"
  on public.settlement_deadlines
  for select to authenticated using (true);

grant select on public.settlement_deadlines to authenticated;
grant all on public.settlement_deadlines to service_role;
