-- 도구(스킬) 켜고 끄기.
--
-- 목록 자체는 DB에 없다 — 레포 `.claude/` 를 훑어 만든 카탈로그가 코드에 있다
-- (`src/features/dev-tools/catalog.generated.ts`). 여기 담는 건 **사람이 내린 결정**
-- 뿐이다. 파일이 진실이고 DB는 그 위에 얹는 판단이라, 스킬이 사라지면 행은 남아도
-- 화면에 안 나온다.
--
-- **끌 수 있는 건 스킬뿐이다.** 에이전트·훅·룰은 파일 존재가 곧 활성이라 끄려면
-- 파일을 옮겨야 하고 그건 git 변경이다. kind 칸을 둔 건 화면이 종류를 함께 넘기기
-- 때문이고, 나중에 늘리려는 것이 아니다.
create table if not exists public.dev_tool_toggles (
  kind text not null check (kind in ('skill', 'agent', 'hook', 'rule')),
  name text not null,
  enabled boolean not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (kind, name)
);

-- 언제 어느 PC에 반영했는가.
--
-- 웹에서 끈다고 바로 꺼지지 않는다 — 실제 스위치는 `.claude/settings.local.json`
-- 인데 그 파일은 gitignore 라 PC마다 따로 있고 Vercel 은 만질 수 없다. 그래서
-- `npm run tools:apply` 가 반영하고 여기에 적어, 화면이 '아직 반영 안 된 변경'을
-- 드러낸다. 이게 없으면 화면과 실제가 조용히 갈라진다.
create table if not exists public.dev_tool_applies (
  machine text primary key,
  applied_at timestamptz not null default now(),
  disabled_count integer not null default 0
);

alter table public.dev_tool_toggles enable row level security;
alter table public.dev_tool_applies enable row level security;

-- 개발 환경 설정이라 열람은 로그인 사용자면 되고, 쓰기는 서버(service_role)만.
create policy "dev_tool_toggles_select"
  on public.dev_tool_toggles
  for select to authenticated using (true);

create policy "dev_tool_applies_select"
  on public.dev_tool_applies
  for select to authenticated using (true);

grant select on public.dev_tool_toggles to authenticated;
grant all on public.dev_tool_toggles to service_role;
grant select on public.dev_tool_applies to authenticated;
grant all on public.dev_tool_applies to service_role;
