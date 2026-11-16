# 운영부 주간업무보고 A1 (본체) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영1·2팀이 미리 채워진 주간보고를 확인·작성·제출하고, 당번이 모아 [최종 보고]로 그 주를 잠그는 페이지 `/dashboard/ops-weekly`를 만든다. 메일·Teams·엑셀·워드는 다루지 않는다.

**Architecture:** `ops_weekly_*` 테이블 12개(쓰기는 service_role만)와 순수 계산 모듈(주차·명단·권한·자동 목록)을 두고, 그 위에 server action과 탭 페이지 하나를 얹는다. 자동 목록(원서접수·PIMS·휴가/외근)은 제출 전에는 실시간으로 계산하고 **제출할 때 스냅샷**으로 굳힌다. 그래서 잠긴 주는 보고한 그대로 보인다. [최종 보고]·[다시 작성]·전원 제출 시점에는 `emitOpsWeeklyEvent`를 부른다. A1에서는 훅 레지스트리가 비어 있고, A2(메일)와 A3(파일)가 훅을 등록한다.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), TypeScript, Supabase (@supabase/ssr + service_role admin client), zod 4, Tailwind 4 tokens, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-16-ops-weekly-report-design.md` (이 계획은 spec에서 출발한다. 실행자는 둘 다 읽는다.)

## Global Constraints

- slug는 **`ops-weekly`**다. 자동화 잡 id `weekly-report`와 겹치지 않게 골랐다. 라우트 `/dashboard/ops-weekly`, 기능 폴더 `src/features/ops-weekly/`, 테이블 접두사 `ops_weekly_`. 메뉴는 사이드바 '분석 & 보고' 묶음의 **'주간업무보고'**다.
- A1은 메일·Teams를 보내지 않고 엑셀·워드도 쓰지 않는다. `src/features/ops-weekly/**`와 `src/app/dashboard/ops-weekly/**`에서 `@/lib/microsoft`를 import하지 않는다(Task 9 가드 테스트가 지킨다).
- 작성 대상(제출 분모·당번 후보) = `operators.team` ∈ {운영1팀, 운영2팀} ∧ `status = 'active'` ∧ `role` ∉ {부장, 팀장} ∧ email ∉ `ops_weekly_settings.excluded_writer_emails`.
- 주차는 **본부 기준(목요일이 속한 달·주)**이다. 표기 `YYYY년 M월 N주차`, 기간 `M/D~M/D`(월~금, `formatDateRange`). `features/automations/jobs/weekly-report/rollover-logic.ts`의 `weekDateRange`·`formatDateRange`·`floorMod`를 재사용한다.
- 데이터 창은 KST로 **월 00:00 ~ 일 24:00**(금주·차주 모두). `closing/next-week.ts`의 `nextWeekRange`(월~일)와 같은 규칙이다.
- 진행 단계는 8개로 고정하고 순서도 이대로 쓴다: `기획 · 요구분석 · 설계 · 개발 · 테스트 · 배포 · 운영 · 보류`.
- 건수 카드 6개의 라벨(이 순서): `개발 중` · `테스트 중` · `차주 오픈 예정` · `운영 중` · `차주 마감 예정` · `PIMS 발표 예정`. '배포 예정'이라는 말은 쓰지 않는다.
- 차주 마감 예정 = **`write_end_at`(접수 마감)**이 차주인 건이다. `pay_end_at`이 아니다.
- 개발/테스트 구분이 없으면 **`구분 미확인`**으로 보여 준다. 0으로 숨기지 않는다. 담당자가 안 맞은 건수는 **0일 때도** 한 줄로 적는다.
- 날짜·시각은 `kstFormat`(`@/lib/kst-format`)으로 찍는다. 색은 토큰 클래스만 쓴다. 버튼 호버는 `hover:bg-ink hover:text-cream`(보더가 있으면 `hover:border-ink`도), 행 호버는 `hover:bg-line-soft`, 헤더 액션은 `HeaderActionButton`, 숫자는 `tabular-nums`, 입력창은 `border-line-soft bg-field-bg focus:border-ink focus:bg-white`.
- 페이지 가드는 `requireMenu("ops-weekly")` 하나다(admin 전용·지정자 전용 집합에 넣지 않는다). server action은 폼을 믿지 않는다. 주·보고서·담당·당번을 admin client로 **DB에서 다시 읽고** 판정한다.
- RLS: 12개 테이블 전부 enable한다. `revoke all … from public, anon, authenticated` → `grant select … to authenticated` → `grant all … to service_role`. 열람 정책은 `using (true)`이고, `settings`·`recipients`만 `using ((select public.is_admin()))`(감싼 호출). 쓰기 정책은 없다.
- 마이그레이션은 사용자가 머지 전에 적용한다. 실행자는 SQL 파일과 검증 스크립트만 만들고 **적용하지 않는다**.
- 그림 붙여넣기는 프로젝트·TF에서만 된다. 5MB 이하 png/jpeg/gif/webp, 공개 버킷 `ops-weekly`. 저장 전에 `sanitizeNoteHtml(html, prefix)`로 정화한다.
- list-variants 레지스트리는 건드리지 않는다. 이 페이지는 목록+인스펙터가 아니라 탭형 작성 화면이다.
- 커밋은 Conventional 접두사 + 한국어 메시지로 쓰고, 세션의 attribution 줄로 끝낸다. 테스트 픽스처에 실명·실메일을 넣지 않는다(`운영자A`, `a@example.com`처럼 쓴다).
- 검증은 `npx vitest run <디렉터리들> --maxWorkers=1`로만 한다(돌리기 전에 `find <디렉터리들> -name "*.test.ts*" | wc -l`로 세어 50개 미만인지 본다). 그 밖에 `npm run typecheck`, `npx eslint <바꾼 파일들>`을 쓴다. `next build`·dev 서버·전체 테스트는 **금지**다.
- 파일은 400줄 안쪽, 함수는 50줄 이하로 쓴다. `any`·`@ts-ignore`·`eslint-disable`·`console.log`는 금지다.

## Review Focus

1. **명단 조회가 실패하거나 0명일 때** [최종 보고]가 '전원 제출'로 켜지면 안 된다. `listOperators`는 에러를 `[]`로 삼킨다. 그래서 작성자 조회는 따로 만들고 에러가 나면 던진다(Task 7). `checkFinalize`는 빈 명단을 `empty-roster`로 막는다(Task 3).
2. **주 경계 시각**: 일 23:59 KST와 월 00:00 KST, 월·해를 넘는 주(6/29→7월 1주차, 12/28→12월 5주차)에서 라벨·창이 본부와 같아야 한다(Task 2).
3. **열어 둔 낡은 화면에서 보내는 요청**: [최종 보고] 뒤에 들어온 저장이나 [최종 보고] 두 번 클릭은 DB 상태로 거절해야 하고, 전환은 한 번만 일어나야 한다(Task 8·9).
4. **같은 휴가가 두 원천에 있을 때**: 종일 일정의 UTC 자정 저장, 담당자 칸 없이 제목에 이름만 있는 팀 공용 일정, 반차·여러 주에 걸친 휴가도 한 줄로 합쳐야 하고 백업자가 있는 쪽을 남긴다(Task 5).
5. **이름 불일치**: 담당자명이 null이거나, 앞뒤 공백이 있거나, 퇴사자 이름이면 조용히 빠지지 않고 '안 붙음'으로 세어야 한다. 지난주에 수집된 개발 구분은 `구분 미확인`으로 다뤄야 한다(Task 4·5).

---

## Worktree setup (Task 1 전에 한 번)

워크트리는 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-weekly-report`이고 `node_modules`가 없다. 원래 폴더 것을 **정션**으로 빌린다. `npm install`은 하지 않는다.

- [ ] ASCII 전용 스크립트를 스크래치 폴더에 만든다(PowerShell 5.1은 BOM 없는 UTF-8 한글을 깨뜨린다).

```powershell
$src = 'C:\Users\ys1114\ClaudeCode\Build\OPS-Console\node_modules'
$dst = 'C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-weekly-report\node_modules'
if (-not (Test-Path -LiteralPath $dst)) { New-Item -ItemType Junction -Path $dst -Target $src | Out-Null }
(Get-Item -LiteralPath $dst -Force).LinkType
```

Expected: `Junction`. 그다음 워크트리에서 `npx next typegen`을 실행한다(`next-env.d.ts`가 gitignore라 typecheck 전에 필요하다).

- [ ] **경고(머지 뒤 정리)**: `git worktree remove`는 정션을 따라 들어가 원래 `node_modules`를 지운다. 반드시 `[System.IO.Directory]::Delete($dst)`(비재귀)로 정션을 먼저 끊고, `Get-ChildItem -Recurse -Attributes ReparsePoint` 결과가 0인 것을 확인한 다음에만 remove한다. 단계는 `&&`로 잇는다.

---

## File Structure

```
supabase/migrations/20261116_ops_weekly.sql          테이블 12 + RLS + 버킷 + 시드
scripts/ops-weekly-verify.mjs                         적용 후 service_role/anon 검증(사용자가 실행)
src/features/ops-weekly/
  constants.ts        SLUG·AREAS·PROJECT_STAGES·SEED_PROJECT_NAMES·버킷·경로 (단일 소스)
  week.ts             주차·창·기준 시각·생성 가능 여부 (순수)
  roster.ts           작성자 명단·당번 순번·받는 사람 경고 (순수)
  permissions.ts      편집/제출/다시 작성/최종 보고/정정 판정 (순수)
  dev-status.ts       개발/테스트 구분 타입 + 신선도 판정 (A4가 채운다)
  auto-lists/application.ts  원서접수 묶음 + 안 붙음 (순수)
  auto-lists/pims.ts         PIMS 금주/차주 + 안 붙음 (순수)
  auto-lists/leave.ts        백업요청+일정 병합·중복 제거 (순수)
  merge.ts            빼기·메모·직접 추가 반영, KPI, 스냅샷 스키마, 프로젝트 묶기 (순수)
  prefill.ts          지난주 프로젝트 값 미리 채우기 (순수)
  schemas.ts          DB 행 스키마 + action 입력 스키마
  week-queries.ts     getWeek / ensureWeek / listWriters (server-only)
  report-queries.ts   ensureReport / listReports / listPendingWriters / loadReportDetail / listProjectEntriesForWeek
  auto-queries.ts     loadAutoSnapshot / listDevStatuses
  settings-queries.ts loadSettingsBundle
  guard.ts            authorizeReportEdit / authorizeWeek (DB 재판정)
  events.ts           OpsWeeklyEvent · OPS_WEEKLY_HOOKS(빈 배열) · emitOpsWeeklyEvent
  actions.ts          작성 action (메모·빼기·직접 추가·프로젝트·그림·탭 확인)
  workflow-actions.ts 제출·다시 작성·주요 요약·최종 보고·정정
  settings-actions.ts 받는 사람·순번표·작성 제외·프로젝트 목록·주별 당번
  __tests__/…
src/app/dashboard/ops-weekly/
  page.tsx  _params.ts  _load.ts
  _components/ WeekHeader · WeeklyKpiRow · AreaNotes · AutoGroupSection · ManualItemForm ·
               ApplicationTab · PimsTab · LeaveTab · ProjectTab · StatusTab · SettingsTab(+패널 4)
  __tests__/…
src/app/dashboard/_data.ts                 (메뉴 1항목)
src/app/dashboard/_data/page-meta-config.ts (메타 1항목)
CLAUDE.md                                  (기능 절 1개)
```

---

### Task 1: 마이그레이션 · 상수 단일 소스 · 검증 스크립트

**Files:**
- Create: `src/features/ops-weekly/constants.ts`
- Create: `supabase/migrations/20261116_ops_weekly.sql`
- Create: `scripts/ops-weekly-verify.mjs`
- Test: `src/features/ops-weekly/__tests__/migration.test.ts`

**Interfaces:**
- Produces (`constants.ts`):
  - `OPS_WEEKLY_SLUG = "ops-weekly"`, `OPS_WEEKLY_PATH = "/dashboard/ops-weekly"`
  - `AREAS = ["application","pims","project","tf","leave"] as const`, `type Area`
  - `AUTO_AREAS = ["application","pims","leave"] as const`, `type AutoArea`
  - `AREA_LABEL: Record<Area,string>` = 원서접수 / PIMS / 프로젝트 / TF / 휴가·외근
  - `PROJECT_STAGES = ["기획","요구분석","설계","개발","테스트","배포","운영","보류"] as const`, `type ProjectStage`
  - `PROJECT_KINDS = ["project","tf"] as const`, `type ProjectKind`
  - `REPORT_STATUSES = ["draft","submitted","returned"] as const`, `WEEK_STATUSES = ["open","reported"] as const`
  - `WRITER_TEAMS = ["운영1팀","운영2팀"] as const`, `EXCLUDED_WRITER_ROLES = ["부장","팀장"] as const`
  - `SEED_PROJECT_NAMES` = `["PIMS","접수관리자","내부관리자","경쟁률","생성툴","매출 분석","정산 · 진학캐쉬","초중고","인증","대교협 연계","추천인 검증","보증보험","실적증명","계약서","유의사항"] as const` (사이드바 '프로젝트' 13 + 계약서·유의사항)
  - `OPS_WEEKLY_BUCKET = "ops-weekly"`, `MAX_IMAGE_BYTES = 5 * 1024 * 1024`

- [ ] **Step 1: 실패하는 계약 테스트를 쓴다** (`sms-sender/status-refresh/__tests__/migration.test.ts`처럼 주석을 먼저 지우고 공백을 접는다. 칸 단언은 해당 `create table … ( … );` 본문 안에서만 한다)

```ts
const TABLES = ["ops_weekly_weeks","ops_weekly_reports","ops_weekly_area_notes",
  "ops_weekly_item_overrides","ops_weekly_manual_items","ops_weekly_projects",
  "ops_weekly_project_owners","ops_weekly_project_entries","ops_weekly_duty_rotation",
  "ops_weekly_settings","ops_weekly_recipients","ops_weekly_dev_status"];
it("테이블 12개 + RLS enable + 기본 권한 회수", () => {
  for (const t of TABLES) {
    expect(sql).toContain(`create table if not exists public.${t} (`);
    expect(sql).toContain(`alter table public.${t} enable row level security`);
    expect(sql).toMatch(new RegExp(`revoke all on public\\.${t}\\s+from public, anon, authenticated`));
    expect(sql).toMatch(new RegExp(`grant all on public\\.${t}\\s+to service_role`));
  }
});
it("진행 단계 check 가 PROJECT_STAGES 와 같은 순서", () => {
  const list = PROJECT_STAGES.map((s) => `'${s}'`).join(",");
  expect(body("ops_weekly_project_entries")).toContain(`stage text check (stage in (${list}))`);
});
it("영역 check 가 AREAS 와 같다", () =>
  expect(body("ops_weekly_area_notes")).toContain(
    `area text not null check (area in (${AREAS.map((a) => `'${a}'`).join(",")}))`));
it("주 시작은 월요일, 주당 운영자 보고서는 하나", () => {
  expect(body("ops_weekly_weeks")).toContain("week_start date not null unique check (extract(isodow from week_start) = 1)");
  expect(body("ops_weekly_reports")).toContain("unique (week_id, operator_email)");
});
it("settings·recipients 만 admin 열람이고 is_admin 은 감싼다", () => {
  expect(sql).toMatch(/on public\.ops_weekly_settings for select to authenticated using \(\(select public\.is_admin\(\)\)\)/);
  expect(sql).toMatch(/on public\.ops_weekly_recipients for select to authenticated using \(\(select public\.is_admin\(\)\)\)/);
  expect(sql).not.toMatch(/using \(public\.is_admin\(\)\)/);
});
it("프로젝트 시드 = SEED_PROJECT_NAMES 15개", () => {
  for (const n of SEED_PROJECT_NAMES) expect(sql).toContain(`('${n}'`);
  expect(SEED_PROJECT_NAMES).toHaveLength(15);
});
it("공개 버킷 + settings 단일 행 + 스키마 캐시 갱신", () => {
  expect(sql).toContain(`insert into storage.buckets (id, name, public) values ('${OPS_WEEKLY_BUCKET}', '${OPS_WEEKLY_BUCKET}', true)`);
  expect(sql).toContain("insert into public.ops_weekly_settings (id) values (true) on conflict (id) do nothing");
  expect(sql).toContain("notify pgrst, 'reload schema'");
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/ops-weekly --maxWorkers=1`
Expected: FAIL. 마이그레이션 파일과 `constants.ts`가 없어서 ENOENT / resolve 에러가 난다.

- [ ] **Step 3: `constants.ts`와 SQL을 쓴다** (`begin; … commit;`로 감싸고, 머리 주석에 spec 경로와 '쓰기 정책 0개 = server action이 service_role로만 쓴다'를 적는다)

칸 정의는 아래가 전부다(타입·기본값·check를 그대로 쓴다). 모든 `updated_at` 테이블에는 기존 `public.set_updated_at` 트리거를 단다.

| 테이블 | 칸 |
|---|---|
| `ops_weekly_weeks` | `id uuid primary key default gen_random_uuid()` · `week_start date not null unique check (extract(isodow from week_start) = 1)` · `label_year int not null` · `label_month int not null check (label_month between 1 and 12)` · `label_week int not null check (label_week between 1 and 6)` · `duty_email text` · `summary_this text not null default ''` · `summary_next text not null default ''` · `status text not null default 'open' check (status in ('open','reported'))` · `reported_at timestamptz` · `reported_by text` · `reopened_at timestamptz` · `reopened_by text` · `created_at`/`updated_at timestamptz not null default now()` |
| `ops_weekly_reports` | `id uuid pk` · `week_id uuid not null references public.ops_weekly_weeks(id) on delete cascade` · `operator_email text not null` · `status text not null default 'draft' check (status in ('draft','submitted','returned'))` · `submitted_at timestamptz` · `returned_at timestamptz` · `returned_by text` · `return_reason text` · `snapshot jsonb` · `checked_tabs text[] not null default '{}'` · `updated_by text` · `created_at`/`updated_at` · `unique (week_id, operator_email)` |
| `ops_weekly_area_notes` | `report_id uuid not null references public.ops_weekly_reports(id) on delete cascade` · `area text not null check (area in ('application','pims','project','tf','leave'))` · `this_week text not null default ''` · `next_week text not null default ''` · `updated_by text` · `updated_at` · `primary key (report_id, area)` |
| `ops_weekly_item_overrides` | `report_id … on delete cascade` · `item_key text not null` · `area text not null check (area in ('application','pims','leave'))` · `note text not null default ''` · `excluded boolean not null default false` · `updated_by text` · `updated_at` · `primary key (report_id, item_key)` |
| `ops_weekly_manual_items` | `id uuid pk` · `report_id … on delete cascade` · `area text not null check (area in ('application','pims','leave'))` · `group_key text` · `title text not null` · `note text not null default ''` · `period_start date` · `period_end date` · `leave_kind text` · `created_by text not null` · `created_at` |
| `ops_weekly_projects` | `id uuid pk` · `name text not null unique` · `kind text not null default 'project' check (kind in ('project','tf'))` · `sort_order int not null default 0` · `active boolean not null default true` · `created_at`/`updated_at` |
| `ops_weekly_project_owners` | `project_id uuid not null references public.ops_weekly_projects(id) on delete cascade` · `operator_email text not null` · `created_at` · `primary key (project_id, operator_email)` |
| `ops_weekly_project_entries` | `id uuid pk` · `report_id … on delete cascade` · `project_id uuid not null references public.ops_weekly_projects(id) on delete restrict` · `stage text check (stage in ('기획','요구분석','설계','개발','테스트','배포','운영','보류'))` · `this_week text not null default ''` · `next_week text not null default ''` · `updated_by text` · `updated_at` · `unique (report_id, project_id)` |
| `ops_weekly_duty_rotation` | `position int primary key check (position >= 0)` · `operator_email text not null unique` |
| `ops_weekly_settings` | `id boolean primary key default true check (id)` · `rotation_anchor_week date check (rotation_anchor_week is null or extract(isodow from rotation_anchor_week) = 1)` · `excluded_writer_emails text[] not null default '{}'` · `updated_by text` · `updated_at` |
| `ops_weekly_recipients` | `email text primary key` · `created_by text not null` · `created_at` |
| `ops_weekly_dev_status` | `service_id integer primary key` (Moa service_id, FK 없음. `closing_services`는 스크랩 미러다) · `stage text not null check (stage in ('dev','test'))` · `raw_label text` · `collected_at timestamptz not null` |

인덱스: `ops_weekly_reports (week_id)`, `ops_weekly_project_entries (project_id)`, `ops_weekly_manual_items (report_id)`, `ops_weekly_project_owners (operator_email)`.
정책: 위 10개 테이블은 `create policy "<table>_select" on public.<table> for select to authenticated using (true)`, settings·recipients는 감싼 `is_admin()`을 쓴다(각각 `drop policy if exists` 선행). 시드: `insert into public.ops_weekly_projects (name, kind, sort_order) values ('PIMS','project',10), …, ('유의사항','project',150) on conflict (name) do nothing`(10 간격). 버킷: `… on conflict (id) do update set public = true` + `create policy "ops_weekly_objects_service_only" on storage.objects for all to service_role using (bucket_id = 'ops-weekly') with check (bucket_id = 'ops-weekly')`.

- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS (7 tests).

- [ ] **Step 5: `scripts/ops-weekly-verify.mjs`를 쓴다** (`scripts/verify-schedule-types-migration.mjs`처럼 `.env.local`을 읽는다. 실행은 사용자가 마이그레이션을 적용한 뒤에 한다)

  - service_role: 테이블 12개 각각 `select('*', { count: 'exact', head: true })` → **`count !== null`**이어야 ✓다(없는 테이블도 `error: null`로 조용히 0건이 나올 수 있어 count로 판별한다). `ops_weekly_settings` count가 1인지, `ops_weekly_projects`의 이름 집합이 `SEED_PROJECT_NAMES`와 같은지(15개), `storage.getBucket('ops-weekly')`가 `public: true`인지 본다.
  - anon key: `ops_weekly_weeks`에 insert하면 `error`가 있어야 한다. `ops_weekly_recipients` select는 행이 0이어야 한다.
  - 항목마다 `✓/✗` 한 줄을 찍고, 하나라도 실패하면 `process.exit(1)`.
  - 이 단계는 실행하지 않는다. 계약 테스트와 `node --check scripts/ops-weekly-verify.mjs`(문법 확인)만 한다.

- [ ] **Step 6: Commit**

```bash
git add src/features/ops-weekly/constants.ts src/features/ops-weekly/__tests__/migration.test.ts supabase/migrations/20261116_ops_weekly.sql scripts/ops-weekly-verify.mjs
git commit -m "feat: 주간업무보고 테이블·RLS·시드 마이그레이션"
```

---

### Task 2: 주차 계산 (`week.ts`)

**Files:**
- Create: `src/features/ops-weekly/week.ts`
- Test: `src/features/ops-weekly/__tests__/week.test.ts`

**Interfaces:**
- Consumes: `weekDateRange(year, month, week)`, `formatDateRange(start, end)`, `floorMod(a, b)`(`@/features/automations/jobs/weekly-report/rollover-logic`), `nextWeekRange(now)`(`@/features/closing/next-week`)
- Produces:
  - `type WeekRef = { weekStart: string; year: number; month: number; week: number; label: string; rangeLabel: string }`
  - `type YmdRange = { startYmd: string; endYmd: string }`
  - `kstYmd(instant: Date): string`(en-CA, Asia/Seoul)
  - `weekOf(instant: Date): WeekRef`
  - `weekRefFromStart(weekStart: string): WeekRef | null`(월요일 `YYYY-MM-DD`가 아니면 null)
  - `shiftWeek(weekStart: string, n: number): string`
  - `weeksBetween(fromStart: string, toStart: string): number`
  - `weekWindows(weekStart: string): { thisWeek: YmdRange; nextWeek: YmdRange; startInstant: Date; endInstant: Date }`
  - `ymdInRange(ymd: string, r: YmdRange): boolean`
  - `referenceInstant(weekStart: string, now: Date): Date`(now를 `[startInstant, endInstant]`로 자른다)
  - `canCreateWeek(weekStart: string, now: Date, currentReported: boolean): boolean`
  - `defaultWeekStart(now: Date, currentReported: boolean): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다** (값은 Python으로 미리 계산해 둔 것이다)

```ts
it.each([
  ["2026-11-16T03:00:00Z", "2026-11-16", "2026년 11월 3주차", "11/16~11/20"],
  ["2026-11-22T14:59:59Z", "2026-11-16", "2026년 11월 3주차", "11/16~11/20"], // 일 23:59:59 KST
  ["2026-11-15T15:00:00Z", "2026-11-16", "2026년 11월 3주차", "11/16~11/20"], // 월 00:00 KST
  ["2026-11-15T14:59:59Z", "2026-11-09", "2026년 11월 2주차", "11/9~11/13"],
  ["2026-12-31T03:00:00Z", "2026-12-28", "2026년 12월 5주차", "12/28~1/1"],
  ["2026-06-29T03:00:00Z", "2026-06-29", "2026년 7월 1주차", "6/29~7/3"],
  ["2026-03-30T03:00:00Z", "2026-03-30", "2026년 4월 1주차", "3/30~4/3"],
  ["2026-11-30T03:00:00Z", "2026-11-30", "2026년 12월 1주차", "11/30~12/4"],
])("weekOf(%s) = %s %s", (iso, start, label, range) => {
  const w = weekOf(new Date(iso));
  expect([w.weekStart, w.label, w.rangeLabel]).toEqual([start, label, range]);
});
it("weekOf 는 본부 weekDateRange 와 왕복한다", () => {
  const w = weekOf(new Date("2026-12-31T03:00:00Z"));
  expect(weekDateRange(w.year, w.month, w.week).monday.toISOString().slice(0, 10)).toBe(w.weekStart);
});
it("weekRefFromStart 는 월요일만 받는다", () => {
  expect(weekRefFromStart("2026-11-17")).toBeNull();
  expect(weekRefFromStart("2026-13-01")).toBeNull();
  expect(weekRefFromStart("2026-11-16")?.label).toBe("2026년 11월 3주차");
});
it("shiftWeek / weeksBetween 연도 경계", () => {
  expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  expect(weeksBetween("2026-11-02", "2026-11-16")).toBe(2);
  expect(weeksBetween("2026-11-16", "2026-11-02")).toBe(-2);
});
it("weekWindows — 월~일 KST", () => {
  const w = weekWindows("2026-11-16");
  expect(w.thisWeek).toEqual({ startYmd: "2026-11-16", endYmd: "2026-11-22" });
  expect(w.nextWeek).toEqual({ startYmd: "2026-11-23", endYmd: "2026-11-29" });
  expect(w.startInstant.toISOString()).toBe("2026-11-15T15:00:00.000Z");
  expect(w.endInstant.toISOString()).toBe("2026-11-22T14:59:59.999Z");
});
it("referenceInstant 는 그 주 안으로 자른다", () => {
  const now = new Date("2026-11-19T01:00:00Z");
  expect(referenceInstant("2026-11-23", now).toISOString()).toBe("2026-11-22T15:00:00.000Z");
  expect(referenceInstant("2026-11-09", now).toISOString()).toBe("2026-11-15T14:59:59.999Z");
  expect(referenceInstant("2026-11-16", now)).toEqual(now);
});
it("canCreateWeek — 이번 주, 그리고 이번 주가 보고됐을 때만 다음 주", () => {
  const now = new Date("2026-11-18T01:00:00Z");
  expect(canCreateWeek("2026-11-16", now, false)).toBe(true);
  expect(canCreateWeek("2026-11-23", now, false)).toBe(false);
  expect(canCreateWeek("2026-11-23", now, true)).toBe(true);
  expect(canCreateWeek("2026-11-30", now, true)).toBe(false);
  expect(canCreateWeek("2026-11-09", now, false)).toBe(false); // 지난주는 이미 있으면 쓰고, 새로 만들지 않는다
});
it("defaultWeekStart", () => {
  const now = new Date("2026-11-19T08:00:00Z");
  expect(defaultWeekStart(now, false)).toBe("2026-11-16");
  expect(defaultWeekStart(now, true)).toBe("2026-11-23");
});
```

- [ ] **Step 2: 실패를 확인한다.** Run: `npx vitest run src/features/ops-weekly --maxWorkers=1`. Expected: `week.test.ts` FAIL(모듈이 없다).

- [ ] **Step 3: 구현한다.** `weekOf`: `kstYmd` → 그 주 월요일(`(dow+6)%7` 만큼 빼기) → 목요일 = 월+3 → 목요일의 (연, 월) → 그 달 첫 목요일 = `1일 + floorMod(3 - pyWeekday(1일), 7)`(rollover-logic의 `pyWeekday`를 쓴다) → `week = (목 - 첫목)/7 + 1`. `rangeLabel = formatDateRange(weekDateRange(y,m,w).monday, .friday)`. 날짜 산술은 전부 `Date.UTC` 위에서 `YYYY-MM-DD` 문자열로 하고, 실행 TZ의 영향을 받지 않아야 한다. `weekWindows.startInstant`는 `Date.UTC(y,m-1,d) - 9h`이고 `endInstant = start + 7d - 1ms`. 차주 창은 `nextWeekRange(startInstant)`와 같아야 한다(테스트로 함께 단언한다).

- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 주차 계산 — 본부 목요일 기준"`

---

### Task 3: 명단·당번·권한 (`roster.ts`, `permissions.ts`)

**Files:**
- Create: `src/features/ops-weekly/roster.ts`, `src/features/ops-weekly/permissions.ts`
- Test: `src/features/ops-weekly/__tests__/roster.test.ts`, `src/features/ops-weekly/__tests__/permissions.test.ts`

**Interfaces:**
- Consumes: `weeksBetween`, `floorMod`(Task 2 / rollover-logic), `canViewMenu`(`@/features/auth/permission`), `WRITER_TEAMS`·`EXCLUDED_WRITER_ROLES`·`OPS_WEEKLY_SLUG`(Task 1)
- Produces (`roster.ts`):
  - `type WriterCandidate = { email: string; name: string; team: string; role: string; status: string }`
  - `writerRoster(rows: readonly WriterCandidate[], excludedEmails: readonly string[]): WriterCandidate[]`(입력 순서를 지키고, `name`은 trim한다)
  - `dutyForWeek(weekStart: string, rotation: readonly string[], anchorWeekStart: string | null): string | null` = `rotation[floorMod(weeksBetween(anchor, weekStart), n)]`. 빈 목록이거나 anchor가 없으면 null.
  - `type RecipientWarning = "not-operator" | "inactive" | "no-menu"`
  - `RECIPIENT_WARNING_LABEL: Record<RecipientWarning,string>` = 운영자 명단에 없음 / 비활성 계정 / 메뉴 권한 없음
  - `recipientWarning(op: { email: string; status: string; permission: OperatorPermission | null; allowed_menus: string[] } | null): RecipientWarning | null`. `canViewMenu(OPS_WEEKLY_SLUG, {email, operator: null, displayName: "", role: "", team: null, permission, allowedMenus})`로 판정한다.
- Produces (`permissions.ts`):
  - `type Actor = { email: string; isAdmin: boolean }`
  - `type WeekState = { status: "open" | "reported"; dutyEmail: string | null }`
  - `canEditReport(actor: Actor, week: WeekState, ownerEmail: string): boolean`: open ∧ (본인 ∨ 당번 ∨ admin)
  - `canSubmitReport(actor: Actor, week: WeekState, ownerEmail: string, isWriter: boolean): boolean`: open ∧ 본인 ∧ 작성 대상(제출은 본인만)
  - `canReturnReport(actor: Actor, week: WeekState, reportStatus: ReportStatus): boolean`: open ∧ (당번 ∨ admin) ∧ submitted
  - `canEditDutySummary(actor: Actor, week: WeekState): boolean`: open ∧ (당번 ∨ admin)
  - `type FinalizeCheck = { ok: true } | { ok: false; reason: "forbidden" | "locked" | "empty-roster" | "pending"; pending: string[] }`
  - `checkFinalize(actor: Actor, week: WeekState, rosterEmails: readonly string[], submittedEmails: ReadonlySet<string>): FinalizeCheck`. 판정 순서는 forbidden(당번도 admin도 아님) → locked → empty-roster → pending.
  - `canReopenWeek(actor: Actor, week: WeekState): boolean`: admin ∧ reported
  - `canManageSettings(actor: Actor): boolean`: admin

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// roster.test.ts
it("작성 대상 = 운영1·2팀 · 활성 · 부장/팀장 제외 · 제외 목록 제외", () => {
  const rows = [
    w("a@x", "운영1팀", "매니저", "active"), w("b@x", "운영1팀", "부장", "active"),
    w("c@x", "운영2팀", "팀장", "active"), w("d@x", "운영2팀", "TL", "active"),
    w("e@x", "기획팀", "매니저", "active"), w("f@x", "운영2팀", "매니저", "inactive"),
    w("t@x", "운영2팀", "매니저", "active"),
  ];
  expect(writerRoster(rows, ["t@x"]).map((r) => r.email)).toEqual(["a@x", "d@x"]);
});
it("dutyForWeek — anchor 주 = 첫 사람, 그 뒤로 돌고, anchor 이전도 돈다", () => {
  const rot = ["a@x", "b@x", "c@x"];
  expect(dutyForWeek("2026-11-16", rot, "2026-11-16")).toBe("a@x");
  expect(dutyForWeek("2026-11-30", rot, "2026-11-16")).toBe("c@x");
  expect(dutyForWeek("2026-12-07", rot, "2026-11-16")).toBe("a@x");
  expect(dutyForWeek("2026-11-09", rot, "2026-11-16")).toBe("c@x");
  expect(dutyForWeek("2026-11-16", [], "2026-11-16")).toBeNull();
  expect(dutyForWeek("2026-11-16", rot, null)).toBeNull();
});
it("recipientWarning", () => {
  expect(recipientWarning(null)).toBe("not-operator");
  expect(recipientWarning(op({ status: "inactive" }))).toBe("inactive");
  expect(recipientWarning(op({ status: "active", permission: "member" }))).toBeNull();
});
// permissions.test.ts
const open = { status: "open", dutyEmail: "d@x" } as const;
const locked = { status: "reported", dutyEmail: "d@x" } as const;
it("편집 — 본인·당번·admin, 잠긴 주는 아무도", () => {
  expect(canEditReport({ email: "a@x", isAdmin: false }, open, "a@x")).toBe(true);
  expect(canEditReport({ email: "d@x", isAdmin: false }, open, "a@x")).toBe(true);
  expect(canEditReport({ email: "z@x", isAdmin: false }, open, "a@x")).toBe(false);
  expect(canEditReport({ email: "z@x", isAdmin: true }, locked, "a@x")).toBe(false);
});
it("제출은 본인만 — 당번도 대리 제출 못 한다", () => {
  expect(canSubmitReport({ email: "d@x", isAdmin: false }, open, "a@x", true)).toBe(false);
  expect(canSubmitReport({ email: "a@x", isAdmin: false }, open, "a@x", false)).toBe(false);
});
it("최종 보고 — 빈 명단은 전원 제출이 아니다", () => {
  expect(checkFinalize({ email: "d@x", isAdmin: false }, open, [], new Set())).toEqual(
    { ok: false, reason: "empty-roster", pending: [] });
});
it("최종 보고 — 미제출자 목록을 돌려준다", () => {
  expect(checkFinalize({ email: "d@x", isAdmin: false }, open, ["a@x", "b@x"], new Set(["a@x"])))
    .toEqual({ ok: false, reason: "pending", pending: ["b@x"] });
});
it("최종 보고 — 당번/admin 이 아니면 forbidden, 잠긴 주는 locked, 다 내면 ok", () => {
  expect(checkFinalize({ email: "a@x", isAdmin: false }, open, ["a@x"], new Set(["a@x"])).ok).toBe(false);
  expect(checkFinalize({ email: "d@x", isAdmin: false }, locked, ["a@x"], new Set(["a@x"])))
    .toMatchObject({ reason: "locked" });
  expect(checkFinalize({ email: "d@x", isAdmin: false }, open, ["a@x"], new Set(["a@x"]))).toEqual({ ok: true });
});
it("정정은 admin · 보고된 주만", () => {
  expect(canReopenWeek({ email: "d@x", isAdmin: false }, locked)).toBe(false);
  expect(canReopenWeek({ email: "z@x", isAdmin: true }, open)).toBe(false);
  expect(canReopenWeek({ email: "z@x", isAdmin: true }, locked)).toBe(true);
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 2개 FAIL.
- [ ] **Step 3: 위 시그니처대로 구현한다.** `pending` 순서는 `rosterEmails` 순서를 따른다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 작성 명단·당번 순번·권한 판정"`

---

### Task 4: 개발 구분 리더 계약 + 원서접수 자동 목록

**Files:**
- Create: `src/features/ops-weekly/dev-status.ts`, `src/features/ops-weekly/auto-lists/application.ts`
- Test: `src/features/ops-weekly/__tests__/dev-status.test.ts`, `src/features/ops-weekly/__tests__/application.test.ts`

**Interfaces:**
- Consumes: `phaseOf`(`@/features/closing/phase`), `opensNextWeek`·`nextWeekRange`(`@/features/closing/next-week`), `weekWindows`·`referenceInstant`·`kstYmd`·`ymdInRange`(Task 2)
- Produces (`dev-status.ts`, **A4가 쓰는 계약**):
  - `DEV_STAGES = ["dev","test"] as const`, `type DevStage`
  - `type DevStatusRow = { service_id: number; stage: DevStage; collected_at: string }`
  - `freshDevStages(rows: readonly DevStatusRow[], weekStart: string): Map<number, DevStage>`: `collected_at >= weekWindows(weekStart).startInstant`인 것만 남긴다. 그 주에 수집되지 않은 구분은 미확인이다.
- Produces (`application.ts`):
  - `type ClosingLite = { service_id: number; university_name: string; service_name: string; operator_name: string | null; write_start_at: string | null; write_end_at: string; pay_end_at: string | null }`
  - `type AutoItem = { key: string; title: string; subtitle: string; at: string | null }`(key = `closing:{service_id}`, title = 대학명, subtitle = 서비스명, at = 묶음 기준 시각)
  - `type ApplicationGroups = { dev: AutoItem[]; test: AutoItem[]; unknown: AutoItem[]; opening: AutoItem[]; running: AutoItem[]; closing: AutoItem[]; devStatusCollected: boolean }`
  - `endsNextWeek(writeEndAt: string, ref: Date): boolean`: KST 날짜가 `nextWeekRange(ref)` 안이면 true
  - `buildApplicationGroups(args: { rows: readonly ClosingLite[]; operatorName: string; devStages: ReadonlyMap<number, DevStage>; weekStart: string; now: Date }): ApplicationGroups`
  - `countUnmatchedApplication(args: { rows: readonly ClosingLite[]; writerNames: ReadonlySet<string>; weekStart: string; now: Date }): number`

정렬: 묶음 안에서 `at` 오름차순, 같으면 대학명 순이다. `at`은 opening·dev·test·unknown = `write_start_at`, running = `write_start_at`, closing = `write_end_at`.
규칙: `ref = referenceInstant(weekStart, now)`, 담당 = `operator_name?.trim() === operatorName.trim()`.
- 개발/테스트 후보 = `phaseOf(row, ref) === "upcoming"`. `devStages`에 있으면 dev/test, 없으면 unknown.
- opening = `opensNextWeek(write_start_at, ref)`.
- running = `phaseOf(row, ref) === "running"`.
- closing = `endsNextWeek(write_end_at, ref)`.
- 묶음끼리는 배타적이지 않다(running이면서 closing인 건은 둘 다 들어간다).
- `devStatusCollected = devStages.size > 0`.
- 안 붙음 = 다섯 묶음 중 하나에라도 드는 행 중에서 `operator_name`이 null·빈 문자열이거나 trim한 값이 `writerNames`에 없는 행의 수(행 단위로, 중복 없이 센다).

- [ ] **Step 1: 실패하는 테스트를 쓴다** (week `2026-11-16`, now `2026-11-18T01:00:00Z` = 수 10:00 KST)

```ts
const rows: ClosingLite[] = [
  c(1, "운영자A", { write_start_at: "2026-11-23T00:00:00Z" }),           // 차주 월 09:00 → opening
  c(2, "운영자A", { write_start_at: "2026-11-22T15:30:00Z" }),           // UTC 일요일, KST 월 00:30 → opening
  c(3, "운영자A", { write_start_at: "2026-11-01T00:00:00Z", pay_end_at: "2026-12-31T00:00:00Z",
                    write_end_at: "2026-11-25T08:00:00Z" }),              // running + closing
  c(4, "운영자A", { write_start_at: "2026-12-10T00:00:00Z", pay_end_at: "2026-12-20T00:00:00Z" }), // upcoming
  c(5, null,      { write_start_at: "2026-11-24T00:00:00Z" }),           // opening, 담당 없음
  c(6, "퇴사자",  { write_start_at: "2026-11-24T00:00:00Z" }),           // opening, 명단 밖
  c(7, "운영자A ",{ write_start_at: "2026-11-02T00:00:00Z", pay_end_at: "2026-12-31T00:00:00Z" }), // 끝 공백 → 내 것
];
it("네 묶음 — KST 로 자른다, 겹치면 양쪽에 다 든다", () => {
  const g = buildApplicationGroups({ rows, operatorName: "운영자A", devStages: new Map(), weekStart: "2026-11-16", now: NOW });
  expect(keys(g.opening)).toEqual(["closing:2", "closing:1"]);            // at 오름차순
  expect(keys(g.running)).toEqual(["closing:3", "closing:7"]);
  expect(keys(g.closing)).toEqual(["closing:3"]);
  expect(keys(g.unknown)).toEqual(["closing:2", "closing:1", "closing:4"]); // 시작 전은 전부 개발/테스트 후보
  expect(g.devStatusCollected).toBe(false);
});
it("그 주에 수집된 구분만 dev/test 로 간다", () => {
  const fresh = freshDevStages([{ service_id: 4, stage: "test", collected_at: "2026-11-16T00:00:00Z" }], "2026-11-16");
  const g = buildApplicationGroups({ rows, operatorName: "운영자A", devStages: fresh, weekStart: "2026-11-16", now: NOW });
  expect(keys(g.test)).toEqual(["closing:4"]);
  expect(keys(g.unknown)).toEqual(["closing:2", "closing:1"]);
});
it("지난주(일 23:00 KST)에 수집된 구분은 미확인", () => {
  expect(freshDevStages([{ service_id: 4, stage: "dev", collected_at: "2026-11-15T14:00:00Z" }], "2026-11-16").size).toBe(0);
});
it("안 붙음 — null·명단 밖 이름을 세고, 끝 공백은 맞춘다", () => {
  expect(countUnmatchedApplication({ rows, writerNames: new Set(["운영자A"]), weekStart: "2026-11-16", now: NOW })).toBe(2);
});
it("미리 여는 다음 주는 그 주 월 00:00 기준으로 계산한다", () => {
  const g = buildApplicationGroups({ rows, operatorName: "운영자A", devStages: new Map(), weekStart: "2026-11-23",
    now: new Date("2026-11-19T01:00:00Z") });
  expect(keys(g.running)).toEqual(["closing:3", "closing:7"]);            // 월 00:00 기준이라 1·2는 아직 시작 전
  expect(keys(g.unknown)).toEqual(["closing:2", "closing:1", "closing:4"]);
  expect(g.opening).toEqual([]);                                          // 그 주의 차주 = 11/30~12/6
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 2개 FAIL.
- [ ] **Step 3: 위 규칙대로 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 원서접수 자동 목록·개발 구분 계약"`

---

### Task 5: PIMS · 휴가/외근 자동 목록

**Files:**
- Create: `src/features/ops-weekly/auto-lists/pims.ts`, `src/features/ops-weekly/auto-lists/leave.ts`
- Test: `src/features/ops-weekly/__tests__/pims.test.ts`, `src/features/ops-weekly/__tests__/leave.test.ts`

**Interfaces:**
- Consumes: `weekWindows`·`kstYmd`·`ymdInRange`(Task 2), `AutoItem`(Task 4)
- Produces (`pims.ts`):
  - `type PimsLite = { service_id: number; university_name: string; service_name: string; operator_name: string | null; last_announce_at: string | null }`
  - `type PimsGroups = { thisWeek: AutoItem[]; nextWeek: AutoItem[] }`(key = `pims:{service_id}`, at = last_announce_at)
  - `buildPimsGroups(args: { rows: readonly PimsLite[]; operatorName: string; weekStart: string }): PimsGroups`
  - `countUnmatchedPims(args: { rows: readonly PimsLite[]; writerNames: ReadonlySet<string>; weekStart: string }): number`
- Produces (`leave.ts`):
  - `type BackupLeaveLite = { id: string; leave_type: string | null; leave_start_date: string | null; leave_end_date: string | null; substitute_name: string }`(호출부가 `requester_email = 본인`으로 이미 거른 행이다)
  - `type ScheduleLeaveLite = { id: string; type: "leave" | "external_meeting" | "training"; title: string; start_at: string; end_at: string | null; assignee_email: string | null }`
  - `type LeaveFamily = "leave" | "field" | "training"`
  - `type LeaveItem = { key: string; family: LeaveFamily; kindLabel: string; startYmd: string; endYmd: string; substituteName: string | null; sources: ("backup" | "schedule")[]; needsBackup: boolean }`
  - `buildLeaveItems(args: { backups: readonly BackupLeaveLite[]; schedules: readonly ScheduleLeaveLite[]; operatorEmail: string; operatorName: string; weekStart: string }): LeaveItem[]`

알고리즘(시그니처만으로는 정해지지 않는 부분):

```text
window = { startYmd: thisWeek.startYmd, endYmd: nextWeek.endYmd }      // 2주, 월~일
overlaps(a, b) = a.startYmd <= b.endYmd && b.startYmd <= a.endYmd

familyOfBackup(t): 외근·출장 → field · 교육 → training · 그 외(연차·반차·반반차·경조·장기·기타·null) → leave
kindLabel(backup) = leave_type ?? "휴가"
familyOfSchedule: leave → leave · external_meeting → field · training → training
kindLabel(schedule) = { leave: "휴가", external_meeting: "외근", training: "교육" }

1. backup 행: 시작일이 null이면 버린다. end = leave_end_date ?? leave_start_date.
   창과 안 겹치면 버린다.
   → item(key `leave:br:{id}`, sources ["backup"], substituteName, needsBackup false)
2. schedule 행: 본인 것만 남긴다 = assignee_email === operatorEmail
                ∨ (assignee_email == null ∧ title.includes(operatorName.trim()))   // 팀 공용 일정은 제목에 이름을 쓴다(달력 규칙)
   start = kstYmd(start_at), end = end_at ? kstYmd(end_at) : start(달력과 같이 종료일 포함).
   창과 안 겹치면 버린다.
3. 각 schedule 항목에 대해 family가 같고 overlaps인 backup 항목이 있으면, 그 backup 항목의 sources에 "schedule"을 더하고 schedule 항목은 버린다.
   없으면 item(key `leave:se:{id}`, sources ["schedule"], substituteName null,
               needsBackup = family === "leave")
4. startYmd 오름차순, 같으면 key 순으로 정렬한다.
```

- [ ] **Step 1: 실패하는 테스트를 쓴다** (week `2026-11-16`)

```ts
// pims.test.ts
it("발표일 KST 로 금주/차주를 가른다", () => {
  const g = buildPimsGroups({ weekStart: "2026-11-16", operatorName: "운영자A", rows: [
    p(1, "운영자A", "2026-11-20T01:00:00Z"),   // 금 → thisWeek
    p(2, "운영자A", "2026-11-15T15:30:00Z"),   // 월 00:30 KST → thisWeek
    p(3, "운영자A", "2026-11-27T01:00:00Z"),   // nextWeek
    p(4, "운영자A", "2026-11-29T15:30:00Z"),   // 11/30 KST → 창 밖
    p(5, "운영자A", null),                      // 발표일 없음 → 제외
  ]});
  expect(keys(g.thisWeek)).toEqual(["pims:2", "pims:1"]);
  expect(keys(g.nextWeek)).toEqual(["pims:3"]);
});
it("안 붙음 — 창 안의 null·명단 밖만 센다", () => {
  expect(countUnmatchedPims({ weekStart: "2026-11-16", writerNames: new Set(["운영자A"]), rows: [
    p(1, null, "2026-11-20T01:00:00Z"), p(2, "누군가", "2026-11-27T01:00:00Z"), p(3, null, "2026-12-20T01:00:00Z"),
  ]})).toBe(2);
});
// leave.test.ts
const args = { operatorEmail: "a@x", operatorName: "운영자A", weekStart: "2026-11-16" };
it("같은 휴가가 두 원천에 있으면 백업요청 한 줄로 합친다 — 종일 UTC 저장도", () => {
  const items = buildLeaveItems({ ...args,
    backups: [b("b1", "연차", "2026-11-18", "2026-11-19", "백업자")],
    schedules: [s("s1", "leave", "운영2팀-운영자A-연차", "2026-11-17T15:00:00Z", "2026-11-18T15:00:00Z", null)] });
  expect(items).toEqual([expect.objectContaining({ key: "leave:br:b1", sources: ["backup", "schedule"], substituteName: "백업자", needsBackup: false })]);
});
it("가족이 다르면 합치지 않는다 — 휴가와 외근", () => {
  const items = buildLeaveItems({ ...args,
    backups: [b("b1", "연차", "2026-11-18", "2026-11-19", "백업자")],
    schedules: [s("s2", "external_meeting", "외부미팅", "2026-11-19T05:00:00Z", null, "a@x")] });
  expect(items.map((i) => i.key)).toEqual(["leave:br:b1", "leave:se:s2"]);
});
it("일정에만 있는 휴가는 백업요청 만들기 대상", () => {
  const [it0] = buildLeaveItems({ ...args, backups: [],
    schedules: [s("s3", "leave", "휴가", "2026-11-26T00:00:00Z", null, "a@x")] });
  expect(it0).toMatchObject({ needsBackup: true, kindLabel: "휴가", startYmd: "2026-11-26" });
});
it("여러 주에 걸친 휴가는 들고, 시작일 없는 백업요청과 남의 일정은 뺀다", () => {
  const items = buildLeaveItems({ ...args,
    backups: [b("b2", "장기휴가", "2026-11-09", "2026-11-30", "백업자"), b("b3", "연차", null, null, "백업자")],
    schedules: [s("s4", "leave", "운영1팀-운영자B-연차", "2026-11-18T00:00:00Z", null, null),
                s("s5", "leave", "휴가", "2026-11-18T00:00:00Z", null, "b@x")] });
  expect(items.map((i) => i.key)).toEqual(["leave:br:b2"]);
});
it("반차 날짜 하나짜리도 든다", () => {
  expect(buildLeaveItems({ ...args, schedules: [],
    backups: [b("b4", "오후반차", "2026-11-24", null, "백업자")] })[0]).toMatchObject({ startYmd: "2026-11-24", endYmd: "2026-11-24", kindLabel: "오후반차" });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 2개 FAIL.
- [ ] **Step 3: 위 알고리즘대로 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 PIMS·휴가/외근 자동 목록 — 중복 합치기"`

---

### Task 6: 빼기·메모·직접 추가 반영, KPI, 스냅샷, 자동 원천 조회

**Files:**
- Create: `src/features/ops-weekly/merge.ts`, `src/features/ops-weekly/auto-queries.ts`
- Test: `src/features/ops-weekly/__tests__/merge.test.ts`, `src/features/ops-weekly/__tests__/auto-queries.test.ts`

**Interfaces:**
- Consumes: Task 4·5의 builder·타입, `freshDevStages`, `weekWindows`
- Produces (`merge.ts`):
  - `type ItemOverride = { item_key: string; note: string; excluded: boolean }`
  - `type ManualItem = { id: string; area: AutoArea; group_key: string | null; title: string; note: string; period_start: string | null; period_end: string | null; leave_kind: string | null }`
  - `APPLICATION_GROUP_KEYS = ["dev","test","opening","running","closing","other"] as const`(`other` = 원서접수 외 서비스), `PIMS_GROUP_KEYS = ["thisWeek","nextWeek"] as const`
  - `autoSnapshotSchema` (zod) / `type AutoSnapshot = { version: 1; computedAt: string; application: ApplicationGroups; pims: PimsGroups; leave: LeaveItem[]; unmatched: { application: number; pims: number } }`
  - `type ViewItem = AutoItem & { note: string; excluded: boolean }`
  - `applyOverrides(items: readonly AutoItem[], overrides: ReadonlyMap<string, ItemOverride>): ViewItem[]`(뺀 건도 돌려준다. 화면이 '되살리기'를 보여야 하기 때문이다)
  - `type WeeklyKpis = { dev: number | null; test: number | null; opening: number; running: number; closing: number; pims: number }`
  - `computeKpis(snap: AutoSnapshot, overrides: ReadonlyMap<string, ItemOverride>, manual: readonly ManualItem[]): WeeklyKpis`. 뺀 건은 빼고 같은 묶음의 직접 추가 건은 더한다. `dev`/`test`는 `!snap.application.devStatusCollected`이고 그 묶음에 직접 추가 건도 없으면 `null`이다. `pims` = 금주 + 차주.
  - `type ProjectEntryView = { projectId: string; projectName: string; kind: ProjectKind; sortOrder: number; operatorEmail: string; operatorName: string; stage: ProjectStage | null; thisWeek: string; nextWeek: string }`
  - `groupEntriesByProject(entries: readonly ProjectEntryView[]): { projectId: string; projectName: string; kind: ProjectKind; owners: ProjectEntryView[] }[]`(sortOrder 순, 그 안은 운영자명 순)
- Produces (`auto-queries.ts`, `import "server-only"`, admin client, 에러가 나면 `throw new Error(\`[ops-weekly] <label>: ${error.message}\`)`):
  - `listDevStatuses(serviceIds: readonly number[]): Promise<DevStatusRow[]>`(빈 입력이면 조회 없이 `[]`)
  - `loadAutoSnapshot(args: { weekStart: string; operatorEmail: string; operatorName: string; writerNames: ReadonlySet<string>; now: Date }): Promise<AutoSnapshot>`
    - closing: `closing_services` select(`ClosingLite` 칸) `.or("pay_end_at.is.null,pay_end_at.gte.<startInstant ISO>")`
    - pims: `announcement_services` select(`PimsLite` 칸) `.gte("last_announce_at", weekWindows(weekStart).startInstant).lte("last_announce_at", weekWindows(shiftWeek(weekStart, 1)).endInstant)`
    - backups: `backup_requests` select(`id, leave_type, leave_start_date, leave_end_date, substitute_name`) `.eq("requester_email", operatorEmail).lte("leave_start_date", nextWeek.endYmd)`(겹침 판정은 builder가 한다)
    - schedules: `schedule_events` select(`ScheduleLeaveLite` 칸) `.in("type", ["leave","external_meeting","training"]).lte("start_at", 창 끝).or("end_at.is.null,end_at.gte.<창 시작>")`(본인 판정은 builder가 한다)
    - dev: closing 행 중 upcoming 후보의 service_id로 `listDevStatuses` → `freshDevStages`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// merge.test.ts
it("빼기는 남기되 표시만 바꾸고, 메모를 붙인다", () => {
  const v = applyOverrides([ai("closing:1"), ai("closing:2")],
    new Map([["closing:2", { item_key: "closing:2", note: "연기", excluded: true }]]));
  expect(v.map((x) => [x.key, x.excluded, x.note])).toEqual([["closing:1", false, ""], ["closing:2", true, "연기"]]);
});
it("KPI — 뺀 건 제외 + 직접 추가 포함 + 수집 전 개발/테스트는 null", () => {
  const snap = snapshot({ opening: ["closing:1", "closing:2"], running: ["closing:3"], pimsThis: ["pims:1"], pimsNext: ["pims:2"] });
  const k = computeKpis(snap, new Map([["closing:2", ov("closing:2", true)]]),
    [manual("application", "running"), manual("application", "test")]);
  expect(k).toEqual({ dev: null, test: 1, opening: 1, running: 2, closing: 0, pims: 2 });
});
it("수집됐는데 0건이면 null 이 아니라 0", () => {
  expect(computeKpis(snapshot({ devStatusCollected: true }), new Map(), []).dev).toBe(0);
});
it("스냅샷 스키마가 버전을 지킨다", () => {
  expect(autoSnapshotSchema.safeParse({ ...snapshot({}), version: 2 }).success).toBe(false);
});
it("프로젝트를 항목 → 담당자로 묶는다", () => {
  const g = groupEntriesByProject([e("p2", 20, "운영자B"), e("p1", 10, "운영자B"), e("p1", 10, "운영자A")]);
  expect(g.map((x) => [x.projectId, x.owners.map((o) => o.operatorName)])).toEqual([["p1", ["운영자A", "운영자B"]], ["p2", ["운영자B"]]]);
});
// auto-queries.test.ts — createAdminClient 를 테이블별 응답으로 모킹
it("조회 에러는 던진다 — 빈 목록으로 삼키지 않는다", async () => {
  mockTable("closing_services", { data: null, error: { message: "boom" } });
  await expect(loadAutoSnapshot(ARGS)).rejects.toThrow("[ops-weekly] closing_services: boom");
});
it("원천 넷을 묶어 스냅샷을 만든다", async () => {
  mockTables({ closing_services: [CL_OPENING], announcement_services: [PIMS_THIS], backup_requests: [], schedule_events: [], ops_weekly_dev_status: [] });
  const s = await loadAutoSnapshot(ARGS);
  expect(s.version).toBe(1);
  expect(s.application.opening.map((i) => i.key)).toEqual(["closing:1"]);
  expect(s.pims.thisWeek.map((i) => i.key)).toEqual(["pims:9"]);
});
it("listDevStatuses([]) 는 조회하지 않는다", async () => {
  expect(await listDevStatuses([])).toEqual([]);
  expect(fromSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 2개 FAIL.
- [ ] **Step 3: 구현한다.** 조회 넷은 `Promise.all`로 묶는다. 쿼리 빌더 모킹은 `open-notices/__tests__/actions.test.ts`처럼 체인 객체를 돌려주는 방식으로 한다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 빼기·직접추가 반영·건수·스냅샷"`

---

### Task 7: 주·보고서 조회 — 늦은 생성(lazy)과 미리 채우기

**Files:**
- Create: `src/features/ops-weekly/schemas.ts`, `src/features/ops-weekly/prefill.ts`, `src/features/ops-weekly/week-queries.ts`, `src/features/ops-weekly/report-queries.ts`
- Test: `src/features/ops-weekly/__tests__/prefill.test.ts`, `src/features/ops-weekly/__tests__/week-queries.test.ts`, `src/features/ops-weekly/__tests__/report-queries.test.ts`

**Interfaces:**
- Consumes: `weekRefFromStart`·`canCreateWeek`·`weekOf`·`shiftWeek`(Task 2), `writerRoster`·`dutyForWeek`(Task 3), `ManualItem`·`ItemOverride`·`ProjectEntryView`·`autoSnapshotSchema`(Task 6)
- Produces (`schemas.ts`, DB 행):
  - `weekRowSchema` / `type WeekRow = { id; week_start; label_year; label_month; label_week; duty_email: string | null; summary_this; summary_next; status: "open" | "reported"; reported_at; reported_by; reopened_at; reopened_by }`
  - `reportRowSchema` / `type ReportRow = { id; week_id; operator_email; status: ReportStatus; submitted_at; returned_at; returned_by; return_reason; snapshot: AutoSnapshot | null; checked_tabs: Area[] }`
- Produces (`prefill.ts`): `prefillEntry(prev: { stage: ProjectStage | null; next_week: string } | null): { stage: ProjectStage | null; this_week: string; next_week: string }`. 단계는 그대로 가져오고, **금주 ← 지난주 차주**, 차주는 빈칸이다.
- Produces (`week-queries.ts`, server-only, admin client, 에러가 나면 던진다):
  - `getWeek(weekStart: string): Promise<WeekRow | null>`
  - `getWeekById(weekId: string): Promise<WeekRow | null>`
  - `listWriters(): Promise<WriterCandidate[]>`: `operators`에서 `email,name,team,role,status`를 `.in("team", WRITER_TEAMS).eq("status","active")`로 읽고 settings의 `excluded_writer_emails`와 함께 `writerRoster`에 넣는다
  - `ensureWeek(weekStart: string, now?: Date): Promise<WeekRow | null>`
    1. 행이 있으면: `duty_email`이 null이고 순번표가 있으면 `dutyForWeek`로 채운 뒤 돌려준다.
    2. 행이 없으면: 이번 주(`weekOf(now)`)가 `reported`인지 읽고 `canCreateWeek`가 false면 null.
    3. 만들 수 있으면 `upsert({week_start, label_*, duty_email}, { onConflict: "week_start", ignoreDuplicates: true })` 후 다시 읽는다(동시 접근에서도 행은 하나다).
    - **주가 열리는 시점**: 늦어도 그 주 월 00:00 KST다(그 주에 처음 들어오는 사람의 접근이 만든다). 직전 주가 보고되는 순간 `finalizeWeek`가 `ensureWeek(next)`를 부른다(Task 9). A2의 수요일 잡도 발송 전에 `ensureWeek`를 부른다.
- Produces (`report-queries.ts`):
  - `ensureReport(weekId: string, operatorEmail: string): Promise<ReportRow>`: 보고서 행을 upsert(ignoreDuplicates)하고, 본인이 맡은 **활성** 프로젝트 중 entry가 없는 것을 `prefillEntry(지난주 같은 (프로젝트, 운영자) entry)`로 넣는다. 멱등이다. 주 중에 담당이 추가되면 다음 접근에서 채워진다.
  - `listReports(weekId: string): Promise<ReportRow[]>`
  - `listPendingWriters(weekId: string): Promise<WriterCandidate[]>`: 명단 중 `submitted`가 아닌 사람(보고서 행이 없어도 미제출). **A2 알림과 당번 화면이 같이 쓴다.**
  - `type ReportDetail = { notes: Record<Area, { thisWeek: string; nextWeek: string }>; overrides: Map<string, ItemOverride>; manual: ManualItem[]; projects: ProjectEntryView[] }`
  - `loadReportDetail(reportId: string): Promise<ReportDetail>`
  - `listProjectEntriesForWeek(weekId: string): Promise<ProjectEntryView[]>`: 당번 모아보기용. **A3이 엑셀·워드에 쓸 때도 이것을 쓴다.**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("prefillEntry — 단계 유지, 금주 ← 지난주 차주, 차주 빈칸", () => {
  expect(prefillEntry({ stage: "개발", next_week: "QA 착수" })).toEqual({ stage: "개발", this_week: "QA 착수", next_week: "" });
  expect(prefillEntry(null)).toEqual({ stage: null, this_week: "", next_week: "" });
});
it("listWriters — 조회 에러를 던진다(빈 명단으로 최종 보고가 켜지지 않게)", async () => {
  mockTable("operators", { data: null, error: { message: "x" } });
  await expect(listWriters()).rejects.toThrow("[ops-weekly] operators: x");
});
it("listWriters — settings 제외 목록을 반영한다", async () => {
  mockTables({ operators: [W1, W2_TEST], ops_weekly_settings: [{ excluded_writer_emails: [W2_TEST.email] }] });
  expect((await listWriters()).map((w) => w.email)).toEqual([W1.email]);
});
it("ensureWeek — 이번 주는 만들고 라벨·당번을 채운다", async () => {
  mockTables({ ops_weekly_weeks: [], ops_weekly_duty_rotation: [{ position: 0, operator_email: "a@x" }],
               ops_weekly_settings: [{ rotation_anchor_week: "2026-11-16", excluded_writer_emails: [] }] });
  await ensureWeek("2026-11-16", new Date("2026-11-18T01:00:00Z"));
  expect(upsertSpy).toHaveBeenCalledWith(
    expect.objectContaining({ week_start: "2026-11-16", label_year: 2026, label_month: 11, label_week: 3, duty_email: "a@x" }),
    { onConflict: "week_start", ignoreDuplicates: true });
});
it("ensureWeek — 이번 주가 보고 전이면 다음 주는 만들지 않는다", async () => {
  mockTables({ ops_weekly_weeks: [{ ...WEEK_1116, status: "open" }] });
  expect(await ensureWeek("2026-11-23", new Date("2026-11-18T01:00:00Z"))).toBeNull();
  expect(upsertSpy).not.toHaveBeenCalled();
});
it("ensureWeek — 월요일이 아닌 값은 null", async () => {
  expect(await ensureWeek("2026-11-17")).toBeNull();
});
it("ensureReport — 맡은 활성 프로젝트 entry 를 지난주 값으로 채운다", async () => {
  mockTables({ ops_weekly_reports: [REPORT], ops_weekly_project_owners: [{ project_id: "p1" }, { project_id: "p2" }],
    ops_weekly_projects: [{ id: "p1", active: true }, { id: "p2", active: false }],
    ops_weekly_project_entries: [], /* 지난주 */ prevEntries: [{ project_id: "p1", stage: "설계", next_week: "개발 착수" }] });
  await ensureReport("w1", "a@x");
  expect(entryInsertSpy).toHaveBeenCalledWith([{ report_id: REPORT.id, project_id: "p1", stage: "설계", this_week: "개발 착수", next_week: "" }]);
});
it("listPendingWriters — 보고서 행이 없는 사람도 미제출", async () => {
  mockWriters([W1, W3]); mockTable("ops_weekly_reports", [{ operator_email: W1.email, status: "submitted" }]);
  expect((await listPendingWriters("w1")).map((w) => w.email)).toEqual([W3.email]);
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 3개 FAIL.
- [ ] **Step 3: 구현한다.** 지난주 entry 조회는 `getWeek(shiftWeek(weekStart, -1))` → 그 주의 본인 보고서 → entries 순서다. 지난주가 없으면 `prefillEntry(null)`. `snapshot`은 `autoSnapshotSchema.nullable()`로 파싱하고, 실패하면 `null`로 둔다(살아 있는 계산으로 돌아간다). 이것은 스키마 버전이 바뀐 옛 행에 대한 의도된 규칙이므로 주석으로 이유를 남긴다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 주·보고서 늦은 생성과 지난주 값 미리 채우기"`

---

### Task 8: 작성 action — 메모·빼기·직접 추가·프로젝트·그림

**Files:**
- Modify: `src/features/ops-weekly/schemas.ts`(입력 스키마 추가)
- Create: `src/features/ops-weekly/guard.ts`, `src/features/ops-weekly/actions.ts`
- Test: `src/features/ops-weekly/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentOperator`(`@/features/auth/queries`), `canEditReport`(Task 3), `getWeekById`(Task 7), `sanitizeNoteHtml`(`@/features/checklist/note-html`), `createAdminClient`
- Produces (`schemas.ts`, 입력):
  - `areaNoteInputSchema = { reportId: uuid, area: enum(AREAS), thisWeek: string.max(4000), nextWeek: string.max(4000) }`
  - `itemOverrideInputSchema = { reportId, itemKey: string.regex(/^(closing|pims|leave:(br|se)):[\w-]+$/), area: enum(AUTO_AREAS), note?: max(1000), excluded?: boolean }`
  - `manualItemInputSchema = { reportId, area: enum(AUTO_AREAS), groupKey: string | null, title: string.trim().min(1).max(200), note?: max(1000), periodStart?: ymd | null, periodEnd?: ymd | null, leaveKind?: max(20) | null }`. application이면 `groupKey ∈ APPLICATION_GROUP_KEYS`, pims면 `∈ PIMS_GROUP_KEYS`, leave면 `periodStart`가 필수다(`superRefine`).
  - `projectEntryInputSchema = { reportId, projectId: uuid, stage: enum(PROJECT_STAGES) | null, thisWeek: string, nextWeek: string }`. HTML은 **정화한 뒤** `max(50_000)`로 검사한다(fill-actions처럼 base64 이미지를 먼저 지운다).
- Produces (`guard.ts`):
  - `type EditContext = { actor: Actor; report: ReportRow; week: WeekRow }`
  - `authorizeReportEdit(reportId: string): Promise<{ ok: true; ctx: EditContext } | { ok: false; error: string }>`: me → 보고서 행 → 주 행을 **DB에서** 읽고 `canEditReport`로 판정한다.
  - 문구(그대로 쓴다): `로그인이 필요합니다.` / `보고서를 찾을 수 없습니다.` / `보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.` / `본인 보고서만 수정할 수 있습니다.`
  - `opsWeeklyImagePrefix(): string` = `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ops-weekly/`
- Produces (`actions.ts`, `"use server"`, 모두 `Promise<ActionResult>`, `type ActionResult = { ok: true } | { ok: false; error: string }`, 성공하면 `revalidatePath(OPS_WEEKLY_PATH)`):
  - `saveAreaNote(input: unknown)`: `ops_weekly_area_notes` upsert(onConflict `report_id,area`)
  - `saveItemOverride(input: unknown)`: `ops_weekly_item_overrides` upsert(onConflict `report_id,item_key`)
  - `addManualItem(input: unknown): Promise<ActionResult & { id?: string }>`
  - `removeManualItem(input: { reportId: string; itemId: string })`: 그 보고서의 항목인지 `.eq("report_id")`로 함께 조건을 건다
  - `saveProjectEntry(input: unknown)`: `ops_weekly_project_owners`에 (projectId, report.operator_email)이 있어야 한다. 없으면 `담당 항목이 아닙니다.`
  - `uploadWeeklyImage(input: { reportId: string; dataUrl: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }>`: fill-actions의 `IMAGE_RE`·5MB 규칙. 보고서 주인의 활성 프로젝트 담당이 하나도 없으면 `그림은 프로젝트·TF에만 붙일 수 있습니다.` 경로는 `${week.week_start}/${reportId}/${randomUUID()}.${ext}`, 버킷은 `ops-weekly`.
  - `markTabChecked(input: { reportId: string; area: Area })`: `checked_tabs`에 area가 없으면 더한다(배열을 새로 만든다)

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`open-notices/__tests__/actions.test.ts`처럼 `next/cache`·`@/lib/supabase/admin`·`@/features/auth/queries`를 모킹한다)

```ts
it("잠긴 주에 들어온 저장은 거절한다 — 화면이 낡았어도", async () => {
  me("a@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "reported" });
  expect(await saveAreaNote({ reportId: R, area: "application", thisWeek: "x", nextWeek: "" }))
    .toEqual({ ok: false, error: "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요." });
  expect(upsertSpy).not.toHaveBeenCalled();
});
it("남의 보고서는 당번만 고친다", async () => {
  me("z@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open", duty_email: "d@x" });
  expect(await saveAreaNote(NOTE)).toEqual({ ok: false, error: "본인 보고서만 수정할 수 있습니다." });
  me("d@x");
  expect(await saveAreaNote(NOTE)).toEqual({ ok: true });
});
it("빼기는 그 주 보고서에만 기록한다", async () => {
  me("a@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open" });
  await saveItemOverride({ reportId: R, itemKey: "closing:9045010", area: "application", excluded: true });
  expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ report_id: R, item_key: "closing:9045010", excluded: true }),
    { onConflict: "report_id,item_key" });
});
it("직접 추가 — 원서접수는 묶음 키가 필요하고, 휴가는 시작일이 필요하다", async () => {
  me("a@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open" });
  expect((await addManualItem({ reportId: R, area: "application", groupKey: "nope", title: "x" })).ok).toBe(false);
  expect((await addManualItem({ reportId: R, area: "leave", groupKey: null, title: "연차" })).ok).toBe(false);
  expect((await addManualItem({ reportId: R, area: "application", groupKey: "other", title: "공공접수 안내" })).ok).toBe(true);
});
it("프로젝트 HTML 은 정화한다 — 외부 이미지·스크립트 제거", async () => {
  me("a@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open" }); dbOwner("p1", "a@x");
  await saveProjectEntry({ reportId: R, projectId: P1, stage: "개발",
    thisWeek: '<p>ok</p><script>x</script><img src="https://evil/x.png">', nextWeek: "" });
  expect(updateSpy.mock.calls[0][0].this_week).toBe("<p>ok</p>");
});
it("맡지 않은 프로젝트는 쓸 수 없다", async () => {
  me("a@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open" });
  expect(await saveProjectEntry({ reportId: R, projectId: P1, stage: null, thisWeek: "", nextWeek: "" }))
    .toEqual({ ok: false, error: "담당 항목이 아닙니다." });
});
it("그림 — 5MB 초과·이미지 아님 거절, 프로젝트 담당이 없으면 거절", async () => {
  me("a@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open" });
  expect((await uploadWeeklyImage({ reportId: R, dataUrl: "data:text/plain;base64,AA==" })).ok).toBe(false);
  expect(await uploadWeeklyImage({ reportId: R, dataUrl: PNG_1PX }))
    .toEqual({ ok: false, error: "그림은 프로젝트·TF에만 붙일 수 있습니다." });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → `actions.test.ts` FAIL.
- [ ] **Step 3: 구현한다.** zod 에러 메시지는 `parsed.error.issues[0].message`로 꺼낸다. 모든 쓰기에 `updated_by: actor.email`을 넣는다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 작성 action — DB 재판정·HTML 정화"`

---

### Task 9: 제출·다시 작성·최종 보고·정정 + 이벤트 훅

**Files:**
- Create: `src/features/ops-weekly/events.ts`, `src/features/ops-weekly/workflow-actions.ts`
- Test: `src/features/ops-weekly/__tests__/events.test.ts`, `src/features/ops-weekly/__tests__/workflow-actions.test.ts`, `src/features/ops-weekly/__tests__/no-outbound.test.ts`

**Interfaces:**
- Consumes: `canSubmitReport`·`canReturnReport`·`canEditDutySummary`·`checkFinalize`·`canReopenWeek`(Task 3), `shiftWeek`(Task 2), `listWriters`·`ensureWeek`·`getWeekById`·`listReports`·`listPendingWriters`(Task 7), `loadAutoSnapshot`(Task 6), `ActionResult`·`authorizeReportEdit`(Task 8)
- Produces (`events.ts`, **A2·A3가 훅을 등록하는 자리**):

```ts
export type OpsWeeklyEvent =
  | { type: "all-submitted"; weekId: string; weekStart: string; dutyEmail: string | null }
  | { type: "report-returned"; weekId: string; weekStart: string; operatorEmail: string; returnedBy: string; reason: string | null }
  | { type: "week-reported"; weekId: string; weekStart: string; reportedBy: string; correction: boolean };
export type OpsWeeklyHook = { name: string; handle: (event: OpsWeeklyEvent) => Promise<void> };
export const OPS_WEEKLY_HOOKS: readonly OpsWeeklyHook[] = []; // A1 은 비어 있다 — 아무것도 보내지 않는다
export type HookOutcome = { name: string; ok: boolean; error?: string };
export async function emitOpsWeeklyEvent(event: OpsWeeklyEvent, hooks?: readonly OpsWeeklyHook[]): Promise<HookOutcome[]>;
```

  훅마다 따로 try/catch해서 결과를 모은다. 한 훅이 실패해도 다른 훅과 action은 계속 간다(spec §6.3: 저장 실패가 보고를 막지 않는다). 실패를 화면에 남기는 일은 A3이 한다.
- Produces (`workflow-actions.ts`, `"use server"`, 모두 `Promise<ActionResult>`):
  - `submitReport(input: { reportId: string })`: `canSubmitReport`(작성 대상 여부는 `listWriters`로 확인). `loadAutoSnapshot`으로 스냅샷을 저장하고 `status='submitted'`, `submitted_at=now`로 바꾼 뒤 `listPendingWriters`가 비면 `all-submitted`를 낸다.
  - `returnReport(input: { reportId: string; reason?: string })`: `canReturnReport`. `status='returned'`, `snapshot=null`(다시 살아 있는 계산으로 돌아간다), `returned_at/by`, `return_reason`. `report-returned`를 낸다.
  - `saveDutySummary(input: { weekId: string; thisWeek: string; nextWeek: string })`: `canEditDutySummary`, 각 4000자 이하
  - `finalizeWeek(input: { weekId: string })`: `checkFinalize`(명단 = `listWriters`, 제출 = `listReports`에서 submitted). 전환은 `.update({status:'reported', reported_at, reported_by}).eq("id", weekId).eq("status", "open").select("id")`로 하고, **0행이면** `이미 보고된 주입니다.`(두 번 클릭해도 한 번만 바뀐다). 성공하면 `week-reported`를 `correction: week.reopened_at !== null`로 내고, `ensureWeek(shiftWeek(week_start, 1))`로 다음 주를 연다.
  - `reopenWeek(input: { weekId: string })`: `canReopenWeek`. `status='open'`, `reopened_at/by`. 보고서 상태·스냅샷은 그대로 둔다(spec §5: 메일은 다시 보내지 않는다 → A2는 `correction: true`면 건너뛴다).
  - 거절 문구: forbidden `당번 또는 관리자만 할 수 있습니다.` / locked `보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.` / empty-roster `작성 대상 명단을 읽지 못했습니다. 관리자 설정을 확인하세요.` / pending `아직 제출하지 않은 사람이 있습니다: {이름, …}`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// events.test.ts
it("A1 은 훅이 비어 있다 — 아무것도 보내지 않는다", () => expect(OPS_WEEKLY_HOOKS).toHaveLength(0));
it("한 훅이 던져도 나머지는 돈다", async () => {
  const ok = vi.fn(async () => {});
  const out = await emitOpsWeeklyEvent(EV, [{ name: "bad", handle: async () => { throw new Error("x"); } }, { name: "good", handle: ok }]);
  expect(out).toEqual([{ name: "bad", ok: false, error: "x" }, { name: "good", ok: true }]);
  expect(ok).toHaveBeenCalledWith(EV);
});
// no-outbound.test.ts — 소스 원문 가드
it("ops-weekly 는 메일·Teams·Graph 를 import 하지 않는다", () => {
  for (const f of globSync(["src/features/ops-weekly/**/*.ts", "src/app/dashboard/ops-weekly/**/*.tsx"]))
    expect(readFileSync(f, "utf8"), f).not.toMatch(/@\/lib\/microsoft/);
});
// workflow-actions.test.ts
it("제출은 스냅샷을 굳히고, 마지막 제출이면 all-submitted 를 낸다", async () => {
  me("a@x"); dbReport({ operator_email: "a@x", status: "draft" }); dbWeek({ status: "open" });
  writers(["a@x"]); snapshotReturns(SNAP); pendingAfter([]);
  expect(await submitReport({ reportId: R })).toEqual({ ok: true });
  expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "submitted", snapshot: SNAP }));
  expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "all-submitted" }));
});
it("당번은 남의 보고서를 제출할 수 없다", async () => {
  me("d@x"); dbReport({ operator_email: "a@x" }); dbWeek({ status: "open", duty_email: "d@x" });
  expect((await submitReport({ reportId: R })).ok).toBe(false);
});
it("다시 작성 — 스냅샷을 비우고 report-returned", async () => {
  me("d@x"); dbReport({ operator_email: "a@x", status: "submitted" }); dbWeek({ status: "open", duty_email: "d@x" });
  await returnReport({ reportId: R, reason: "건수 확인" });
  expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "returned", snapshot: null, return_reason: "건수 확인" }));
  expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "report-returned", operatorEmail: "a@x" }));
});
it("최종 보고 — 미제출자가 있으면 이름과 함께 거절", async () => {
  me("d@x"); dbWeek({ status: "open", duty_email: "d@x" }); writers([wr("a@x", "운영자A"), wr("b@x", "운영자B")]);
  reports([{ operator_email: "a@x", status: "submitted" }]);
  expect(await finalizeWeek({ weekId: W })).toEqual({ ok: false, error: "아직 제출하지 않은 사람이 있습니다: 운영자B" });
});
it("최종 보고 — 조건부 전환이 0행이면 이미 보고된 주", async () => {
  allSubmitted(); conditionalUpdateReturns([]);
  expect(await finalizeWeek({ weekId: W })).toEqual({ ok: false, error: "이미 보고된 주입니다." });
  expect(emitSpy).not.toHaveBeenCalled();
});
it("최종 보고 성공 — week-reported(correction=false) + 다음 주 열기", async () => {
  allSubmitted(); conditionalUpdateReturns([{ id: W }]);
  await finalizeWeek({ weekId: W });
  expect(emitSpy).toHaveBeenCalledWith({ type: "week-reported", weekId: W, weekStart: "2026-11-16", reportedBy: "d@x", correction: false });
  expect(ensureWeekSpy).toHaveBeenCalledWith("2026-11-23");
});
it("정정 후 다시 보고하면 correction=true", async () => {
  allSubmitted({ reopened_at: "2026-11-20T01:00:00Z" }); conditionalUpdateReturns([{ id: W }]);
  await finalizeWeek({ weekId: W });
  expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ correction: true }));
});
it("정정은 admin 만", async () => {
  me("d@x", false); dbWeek({ status: "reported", duty_email: "d@x" });
  expect((await reopenWeek({ weekId: W })).ok).toBe(false);
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 3개 FAIL.
- [ ] **Step 3: 구현한다.** `no-outbound.test.ts`의 glob은 `node:fs`의 `globSync`(Node 22+)를 쓴다. 쓸 수 없는 Node 버전이면 `readdirSync({recursive:true})`로 바꾼다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 제출·다시작성·최종보고·정정과 이벤트 훅"`

---

### Task 10: 관리자 설정 action · 조회

**Files:**
- Create: `src/features/ops-weekly/settings-queries.ts`, `src/features/ops-weekly/settings-actions.ts`
- Modify: `src/features/ops-weekly/schemas.ts`(설정 입력 스키마)
- Test: `src/features/ops-weekly/__tests__/settings-actions.test.ts`, `src/features/ops-weekly/__tests__/settings-queries.test.ts`

**Interfaces:**
- Consumes: `recipientWarning`·`writerRoster`·`canManageSettings`(Task 3), `weekRefFromStart`(Task 2), `listWriters`(Task 7)
- Produces (`settings-queries.ts`):
  - `type SettingsBundle = { recipients: { email: string; name: string | null; warning: RecipientWarning | null }[]; rotation: string[]; anchorWeekStart: string | null; excludedWriterEmails: string[]; writerCandidates: WriterCandidate[]; projects: { id: string; name: string; kind: ProjectKind; sortOrder: number; active: boolean; owners: string[] }[] }`
  - `loadSettingsBundle(): Promise<SettingsBundle>`: 받는 사람 경고는 `operators`의 `email,name,status,permission,allowed_menus`로 계산한다. `writerCandidates`는 제외를 반영하기 **전** 목록이다(제외 체크박스용).
  - `listRecipients(): Promise<string[]>`: **A2가 [최종 보고] 메일 수신자로 쓴다.**
- Produces (`settings-actions.ts`, `"use server"`, admin이 아니면 `관리자만 설정할 수 있습니다.`):
  - `addRecipient(input: { email: string }): Promise<ActionResult & { warning?: RecipientWarning | null }>`: 저장은 하고 경고를 돌려준다(spec: 경고만 하고 권한 부여는 기존 운영자 관리로 한다)
  - `removeRecipient(input: { email: string })`
  - `saveRotation(input: { emails: string[]; anchorWeekStart: string | null })`: 모두 `listWriters()` 명단 안이어야 하고 중복이 없어야 하며, anchor는 월요일이어야 한다. 순번표는 delete-all 뒤 position 0..n-1로 다시 넣는다. 이미 만들어진 주의 `duty_email`은 바꾸지 않는다.
  - `saveExcludedWriters(input: { emails: string[] })`
  - `upsertProject(input: { id?: string; name: string; kind: ProjectKind; sortOrder: number; active: boolean })`: 이름 trim 1~50자, 중복 이름은 `이미 있는 항목 이름입니다.`
  - `setProjectOwners(input: { projectId: string; emails: string[] })`: 작성 대상 안의 이메일만 받는다
  - `setWeekDuty(input: { weekId: string; dutyEmail: string })`: 주가 open이고 dutyEmail이 작성 대상이어야 한다. 그 주만 바꾼다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("admin 이 아니면 모두 거절", async () => {
  me("a@x", false);
  for (const r of [await addRecipient({ email: "r@x" }), await saveRotation({ emails: [], anchorWeekStart: null })])
    expect(r).toEqual({ ok: false, error: "관리자만 설정할 수 있습니다." });
});
it("받는 사람 — 저장하고 메뉴 권한 경고를 돌려준다", async () => {
  me("z@x", true); operatorRow("r@x", { status: "inactive" });
  expect(await addRecipient({ email: "r@x" })).toEqual({ ok: true, warning: "inactive" });
});
it("순번표 — 명단 밖·중복·월요일 아닌 anchor 거절", async () => {
  me("z@x", true); writers(["a@x", "b@x"]);
  expect((await saveRotation({ emails: ["a@x", "q@x"], anchorWeekStart: "2026-11-16" })).ok).toBe(false);
  expect((await saveRotation({ emails: ["a@x", "a@x"], anchorWeekStart: "2026-11-16" })).ok).toBe(false);
  expect((await saveRotation({ emails: ["a@x"], anchorWeekStart: "2026-11-17" })).ok).toBe(false);
  expect(await saveRotation({ emails: ["b@x", "a@x"], anchorWeekStart: "2026-11-16" })).toEqual({ ok: true });
  expect(rotationInsertSpy).toHaveBeenCalledWith([{ position: 0, operator_email: "b@x" }, { position: 1, operator_email: "a@x" }]);
});
it("주별 당번 — 보고된 주는 못 바꾼다", async () => {
  me("z@x", true); writers(["a@x"]); dbWeek({ status: "reported" });
  expect((await setWeekDuty({ weekId: W, dutyEmail: "a@x" })).ok).toBe(false);
});
it("loadSettingsBundle — 운영자 명단에 없는 받는 사람은 not-operator", async () => {
  tables({ ops_weekly_recipients: [{ email: "out@x" }], operators: [] });
  expect((await loadSettingsBundle()).recipients[0].warning).toBe("not-operator");
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새 파일 2개 FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 관리자 설정 — 받는 사람·순번표·프로젝트 목록"`

---

### Task 11: 메뉴 등록 · 페이지 골격(머리줄·건수 카드·탭)

**Files:**
- Modify: `src/app/dashboard/_data.ts`('분석 & 보고' 묶음 `items` 끝에 1항목)
- Modify: `src/app/dashboard/_data/page-meta-config.ts`(1항목)
- Create: `src/app/dashboard/ops-weekly/page.tsx`, `src/app/dashboard/ops-weekly/_params.ts`, `src/app/dashboard/ops-weekly/_format.ts`, `src/app/dashboard/ops-weekly/_load.ts`
- Create: `src/app/dashboard/ops-weekly/_components/WeekHeader.tsx`, `src/app/dashboard/ops-weekly/_components/WeeklyKpiRow.tsx`
- Test: `src/app/dashboard/_data/__tests__/ops-weekly-menu.test.ts`, `src/app/dashboard/ops-weekly/__tests__/params.test.ts`, `src/app/dashboard/ops-weekly/__tests__/format.test.ts`, `src/app/dashboard/ops-weekly/__tests__/WeekHeader.test.tsx`, `src/app/dashboard/ops-weekly/__tests__/WeeklyKpiRow.test.tsx`

**Interfaces:**
- Consumes: Task 2·3·6·7의 조회·판정, `requireMenu`, `PageHeader`·`resolvePageMeta`·`findSidebarMeta`, `PageTabs`, `HeaderActionButton`, `kstFormat`
- Produces:
  - 메뉴 항목 `{ ico: "·", label: "주간업무보고", slug: "ops-weekly", pattern: "list" }`(adminOnly 없음)
  - `PAGE_META["ops-weekly"] = { headline: { accent: "분석 · 보고", title: "주간업무보고" }, description: "운영1·2팀 주간 업무를 미리 채워진 화면에서 확인·제출하고, 당번이 모아 보고합니다." }`
  - `_params.ts`: `OPS_TABS = ["application","pims","project","tf","leave","status","settings"] as const`, `type OpsTab`, `parseTab(v: string | undefined, isAdmin: boolean): OpsTab`(모르는 값이거나 admin이 아닌데 settings면 `"application"`), `parseWeekParam(v: string | undefined): string | null`(`weekRefFromStart`로 검증), `buildTabs(args: { weekStart: string; op: string | null; isAdmin: boolean; checked: readonly Area[] }): PageTab[]`(라벨 `원서접수 / PIMS / 프로젝트 / TF / 휴가·외근 / 제출 현황 / 설정`, 확인한 영역은 라벨 끝에 ` ✓`, href는 `/dashboard/ops-weekly?week=…&tab=…[&op=…]`)
  - `_format.ts`: `formatMdHm(iso: string): string` → `M/D HH:mm`, `formatMdDow(ymd: string): string` → `M/D(요일)`. 둘 다 `kstFormat(...).formatToParts`로 조립한다(ko-KR 기본 표기 `11. 19.`를 그대로 쓰지 않는다). 탭 컴포넌트(Task 12~14)도 이것만 쓴다.
  - `_load.ts`(server-only): `loadOpsWeeklyPage(me: CurrentOperator, sp: { week?: string; tab?: string; op?: string }, now: Date): Promise<OpsWeeklyView>`. 순서는 이렇다.
    1. `cal = weekOf(now).weekStart`, `calRow = getWeek(cal)`
    2. `weekStart = parseWeekParam(sp.week) ?? defaultWeekStart(now, calRow?.status === "reported")`
    3. `week = ensureWeek(weekStart, now)`. null이면 `{ kind: "no-week" }`
    4. `writers = listWriters()`. 보는 대상 = `sp.op`(명단 안일 때) → 본인(작성 대상일 때) → `writers[0]`
    5. 주가 open이면 `ensureReport(week.id, viewed)`, 아니면 `listReports`에서 찾는다
    6. `snapshot = report.snapshot ?? loadAutoSnapshot(...)`, `detail = loadReportDetail`, `kpis = computeKpis`
    7. `prevOpen = weekStart === cal && getWeek(shiftWeek(cal, -1))?.status === "open"`
    8. `submittedCount`·`writerCount`, `canEdit`·`canSubmit`
  - `type OpsWeeklyView = { kind: "no-week"; weekStart: string } | { kind: "week"; week: WeekRow; weekRef: WeekRef; tab: OpsTab; viewed: WriterCandidate | null; writers: WriterCandidate[]; report: ReportRow | null; snapshot: AutoSnapshot; detail: ReportDetail | null; kpis: WeeklyKpis; submittedCount: number; prevOpen: boolean; canEdit: boolean; canSubmit: boolean; actor: Actor }`
  - `WeekHeader` props(`ref`는 React가 따로 다루는 이름이라 쓰지 않는다): `{ weekRef: WeekRef; week: WeekRow; viewedName: string | null; writers: { email: string; name: string }[]; viewedEmail: string | null; submittedCount: number; writerCount: number; dutyName: string | null; canSubmit: boolean; reportStatus: ReportStatus | null; reportId: string | null; prevOpen: boolean; prevHref: string; nextHref: string }`. 렌더링 내용은 다음과 같다.
    - 한 줄에 `{label} · {rangeLabel}`, 작성자(`ListSelect`로 운영자 바꾸기 → `?op=`), `제출 {n}/{m}`(tabular-nums), `당번 {이름 | '미지정'}`
    - `canSubmit`이면 `HeaderActionButton` **[제출완료]** → `submitReport`. 이미 submitted면 버튼 대신 `제출함 {formatMdHm(submitted_at)}`
    - 보고된 주는 `{M/D HH:mm} 최종 보고 — 잠김` 줄, `prevOpen`이면 `지난주 보고가 아직 끝나지 않았습니다` + [지난주로] 링크, ‹ › 주 이동 링크
  - `WeeklyKpiRow` props: `{ kpis: WeeklyKpis }`. 카드 6개를 Global Constraints의 라벨 순서로 그린다. 값이 `null`이면 숫자 대신 `구분 미확인`. 카드 껍데기는 `KpiCard`와 같은 `border border-line-soft bg-situation-bg p-4`이고, `KpiCard`는 고치지 않는다(증감 칸이 없다).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// ops-weekly-menu.test.ts (tools-menu.test.ts 모양)
it("'분석 & 보고' 묶음에 주간업무보고(ops-weekly)", () => {
  const g = group("분석 & 보고");
  expect(g.items.find((i) => i.slug === "ops-weekly")?.label).toBe("주간업무보고");
});
it("운영부 전원이 본다 — admin 전용·지정자 전용이 아니다", () => {
  expect(ADMIN_ONLY_MENU_SLUGS.has("ops-weekly")).toBe(false);
  expect(DESIGNATED_ONLY_MENU_SLUGS.has("ops-weekly")).toBe(false);
});
it("자동화 잡 id weekly-report 와 겹치지 않는다", () => {
  expect(allItems.some((i) => i.slug === "weekly-report")).toBe(false);
});
it("페이지 메타", () => expect(PAGE_META["ops-weekly"]?.headline.title).toBe("주간업무보고"));
// params.test.ts
it("parseTab — 설정은 admin 만", () => {
  expect(parseTab("settings", false)).toBe("application");
  expect(parseTab("settings", true)).toBe("settings");
  expect(parseTab("xx", true)).toBe("application");
});
it("parseWeekParam — 월요일만", () => {
  expect(parseWeekParam("2026-11-17")).toBeNull();
  expect(parseWeekParam("2026-11-16")).toBe("2026-11-16");
});
it("buildTabs — 확인한 탭에 ✓, 설정은 admin 만, op 를 이어 붙인다", () => {
  const t = buildTabs({ weekStart: "2026-11-16", op: "a@x", isAdmin: false, checked: ["pims"] });
  expect(t.map((x) => x.label)).toEqual(["원서접수", "PIMS ✓", "프로젝트", "TF", "휴가·외근", "제출 현황"]);
  expect(t[0].href).toBe("/dashboard/ops-weekly?week=2026-11-16&tab=application&op=a%40x");
});
// format.test.ts
it("M/D HH:mm · M/D(요일) — KST 24시간제", () => {
  expect(formatMdHm("2026-11-19T15:30:00Z")).toBe("11/20 00:30");
  expect(formatMdDow("2026-11-18")).toBe("11/18(수)");
});
// WeekHeader.test.tsx
it("주차·기간·제출 현황·당번을 한 줄에", () => {
  render(<WeekHeader {...base} submittedCount={9} writerCount={15} dutyName="운영자D" />);
  expect(screen.getByText("2026년 11월 3주차 · 11/16~11/20")).toBeInTheDocument();
  expect(screen.getByText("제출 9/15")).toBeInTheDocument();
  expect(screen.getByText("당번 운영자D")).toBeInTheDocument();
});
it("제출 버튼은 본인·열린 주에만, 표준 헤더 액션 모양", () => {
  render(<WeekHeader {...base} canSubmit />);
  expect(screen.getByRole("button", { name: "제출완료" }).className).toContain(HEADER_ACTION_CLASS);
  cleanup(); render(<WeekHeader {...base} canSubmit={false} />);
  expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
});
it("보고된 주는 잠김 줄을 KST 24시간제로", () => {
  render(<WeekHeader {...base} week={{ ...WEEK, status: "reported", reported_at: "2026-11-19T08:05:00Z" }} />);
  expect(screen.getByText("11/19 17:05 최종 보고 — 잠김")).toBeInTheDocument();
});
// WeeklyKpiRow.test.tsx
it("카드 6개 라벨 순서 + 수집 전은 '구분 미확인'(0 아님)", () => {
  render(<WeeklyKpiRow kpis={{ dev: null, test: null, opening: 2, running: 5, closing: 1, pims: 0 }} />);
  expect(screen.getAllByTestId("weekly-kpi-label").map((n) => n.textContent))
    .toEqual(["개발 중", "테스트 중", "차주 오픈 예정", "운영 중", "차주 마감 예정", "PIMS 발표 예정"]);
  expect(screen.getAllByText("구분 미확인")).toHaveLength(2);
  expect(screen.getByText("0")).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/dashboard/_data src/app/dashboard/ops-weekly --maxWorkers=1`(먼저 세어 본다). Expected: 새 파일 5개 FAIL.
- [ ] **Step 3: 구현한다.** `page.tsx`는 `requireMenu(OPS_WEEKLY_SLUG)` → `loadOpsWeeklyPage` → `PageHeader` + `WeekHeader` + `WeeklyKpiRow` + `PageTabs`(size md) + 탭 본문 자리를 그린다. 탭 본문은 Task 12~15가 채우고, 이 단계에서는 탭 이름만 있는 빈 섹션을 둔다. `no-week`이면 `이 주의 보고서가 아직 열리지 않았습니다` + 주 이동 링크.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌리고, 레포 가드를 위해 `npx vitest run src/components/common src/lib/__tests__ --maxWorkers=1`도 돌린다(버튼 호버·헤더 액션·시각 표기 표준). Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 메뉴·머리줄·건수 카드·탭 골격"`

---

### Task 12: 원서접수 · PIMS · 휴가/외근 탭

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/AreaNotes.tsx`, `AutoGroupSection.tsx`, `ManualItemForm.tsx`, `ApplicationTab.tsx`, `PimsTab.tsx`, `LeaveTab.tsx`
- Modify: `src/app/dashboard/ops-weekly/page.tsx`(탭 본문 연결)
- Test: `src/app/dashboard/ops-weekly/__tests__/ApplicationTab.test.tsx`, `PimsTab.test.tsx`, `LeaveTab.test.tsx`, `AutoGroupSection.test.tsx`

**Interfaces:**
- Consumes: `applyOverrides`·`ViewItem`·`ManualItem`(Task 6), `saveAreaNote`·`saveItemOverride`·`addManualItem`·`removeManualItem`·`markTabChecked`(Task 8), `AREA_LABEL`
- Produces:
  - `AreaNotes` `{ reportId: string | null; area: Area; thisWeek: string; nextWeek: string; editable: boolean }`: `영역 특이사항` 제목 아래 금주/차주 textarea 두 개. blur하면 저장한다. 편집 불가면 글로만 보여 준다. 탭 아래에 **[이 탭 확인]** 버튼(`markTabChecked`)이 있다.
  - `AutoGroupSection` `{ title: string; items: ViewItem[]; manual: ManualItem[]; reportId: string | null; area: AutoArea; groupKey: string | null; editable: boolean; emptyText: string }`: 행마다 대학명·서비스명·시각(`formatMdHm`), 건 메모 입력(blur 저장), **[빼기]**/**[되살리기]** 버튼. 뺀 행은 `line-through text-muted`. 직접 추가 건에는 `직접 추가` 배지와 [삭제]. 행 호버는 `hover:bg-line-soft`. 묶음 끝에 `ManualItemForm`.
  - `ManualItemForm` `{ reportId; area; groupKey; leave?: boolean }`: 제목(필수)·메모, leave면 시작일/종료일(`DateInput`)·구분(LEAVE_TYPE_VALUES 셀렉트) → `addManualItem`
  - `ApplicationTab` `{ snapshot: AutoSnapshot; detail: ReportDetail; reportId: string | null; editable: boolean }`: 묶음 순서는 **개발 중 · 테스트 중 · 차주 오픈 예정 · 운영 중 · 차주 마감 예정 · 원서접수 외 서비스(직접 추가만)**.
    - `devStatusCollected`가 false면 개발/테스트 두 묶음 대신 한 줄을 적는다: `개발/테스트 구분 미확인 — 작업 통계가 아직 수집되지 않았습니다 (시작 전 서비스 {unknown.length}건)`
    - 수집됐는데 미확인 건이 있으면 `구분 미확인 {n}건` 묶음을 접어서 보여 준다.
    - 탭 머리에 안 붙음 한 줄: `담당자가 맞지 않아 아무에게도 안 붙은 서비스 {n}건`, n > 0이면 ` — 서비스 마감 메뉴에서 담당자 이름을 확인하세요`를 붙인다. 숫자와 문장은 **한 텍스트 노드**에 넣는다.
  - `PimsTab`: 금주 발표 / 차주 발표 두 묶음. 안 붙음 줄 `담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 {n}건`, n > 0이면 ` — 발표 서비스 담당자 맞추기를 다시 확인하세요`.
  - `LeaveTab`: 행마다 `kindLabel` · 기간(`formatMdDow` 두 개를 `~`로 잇고, 하루면 하나) · `백업 {이름}` 또는 `백업 없음`. `needsBackup`이면 **[백업요청 만들기]** → `/dashboard/backup` 링크(버튼 호버 표준). 출처 배지는 `백업요청`/`일정`.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (action 모듈은 모킹한다)

```ts
it("수집 전이면 개발/테스트 묶음 대신 '구분 미확인' 문구", () => {
  render(<ApplicationTab snapshot={snap({ devStatusCollected: false, unknown: 3 })} detail={EMPTY} reportId="r" editable />);
  expect(screen.getByText("개발/테스트 구분 미확인 — 작업 통계가 아직 수집되지 않았습니다 (시작 전 서비스 3건)")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "개발 중" })).toBeNull();
});
it("안 붙음 0 건도 적는다 — 조치 문구는 붙이지 않는다", () => {
  render(<ApplicationTab snapshot={snap({ unmatchedApplication: 0 })} detail={EMPTY} reportId="r" editable />);
  expect(screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 서비스 0건")).toBeInTheDocument();
});
it("안 붙음이 있으면 한 문장으로 조치까지", () => {
  render(<ApplicationTab snapshot={snap({ unmatchedApplication: 4 })} detail={EMPTY} reportId="r" editable />);
  expect(screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 서비스 4건 — 서비스 마감 메뉴에서 담당자 이름을 확인하세요")).toBeInTheDocument();
});
it("묶음 순서", () => {
  render(<ApplicationTab snapshot={snap({ devStatusCollected: true })} detail={EMPTY} reportId="r" editable />);
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent))
    .toEqual(["개발 중", "테스트 중", "차주 오픈 예정", "운영 중", "차주 마감 예정", "원서접수 외 서비스"]);
});
it("[빼기] 는 그 건만 그 주 보고서에서 뺀다", async () => {
  render(<AutoGroupSection {...group([item("closing:1")])} editable />);
  fireEvent.click(screen.getByRole("button", { name: "빼기" }));
  await waitFor(() => expect(saveItemOverride).toHaveBeenCalledWith({ reportId: "r", itemKey: "closing:1", area: "application", excluded: true }));
});
it("편집 불가면 입력·버튼이 없다", () => {
  render(<AutoGroupSection {...group([item("closing:1")])} editable={false} />);
  expect(screen.queryByRole("button", { name: "빼기" })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("일정에만 있는 휴가에 [백업요청 만들기]", () => {
  render(<LeaveTab snapshot={snap({ leave: [leaveItem({ needsBackup: true })] })} detail={EMPTY} reportId="r" editable />);
  expect(screen.getByRole("link", { name: "백업요청 만들기" })).toHaveAttribute("href", "/dashboard/backup");
});
it("PIMS 금주/차주 두 묶음", () => {
  render(<PimsTab snapshot={snap({ pimsThis: ["pims:1"], pimsNext: [] })} detail={EMPTY} reportId="r" editable />);
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["금주 발표", "차주 발표"]);
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/dashboard/ops-weekly --maxWorkers=1` → 새 파일 4개 FAIL.
- [ ] **Step 3: 구현한다.** client component의 저장은 `useTransition` + action 호출로 하고, 실패하면 `error` 문구를 행 아래에 보여 준다. `useEffect`로 데이터를 가져오지 않는다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령을 돌리고 `npx vitest run src/components/common src/lib/__tests__ --maxWorkers=1`도 돌린다. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 원서접수·PIMS·휴가외근 탭"`

---

### Task 13: 프로젝트 · TF 탭 (진행 단계 + 그림 붙여넣기)

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/ProjectTab.tsx`
- Modify: `src/app/dashboard/ops-weekly/page.tsx`
- Test: `src/app/dashboard/ops-weekly/__tests__/ProjectTab.test.tsx`

**Interfaces:**
- Consumes: `RichNote`(`@/app/r/checklist/[token]/_components/RichNote`, 그대로 import하고 옮기지 않는다), `saveProjectEntry`·`uploadWeeklyImage`(Task 8), `PROJECT_STAGES`, `ProjectEntryView`
- Produces: `ProjectTab` `{ kind: ProjectKind; entries: ProjectEntryView[]; reportId: string | null; editable: boolean; notes: { thisWeek: string; nextWeek: string } }`
  - `kind`로 거른 본인 entry를 `sortOrder` 순으로, 카드마다 항목명 · `진행 단계` 셀렉트(8개 + `단계 미선택`) · 금주/차주 `RichNote`(`onPasteImage = (d) => uploadWeeklyImage({reportId, dataUrl: d}).then(r => r.ok ? r.url : null)`)
  - 셀렉트를 바꾸거나 RichNote가 저장되면 `saveProjectEntry`로 그 entry 전체(stage·금주·차주)를 보낸다
  - 편집 불가면 단계를 글로 보여 주고, 금주/차주는 저장된(서버에서 정화된) HTML을 `dangerouslySetInnerHTML`로 그린다
  - entry가 없으면 `맡은 프로젝트가 없습니다`(kind=tf면 `맡은 TF가 없습니다`) + `관리자 설정에서 담당자를 지정합니다`
  - 아래에 `AreaNotes`(area = kind === "tf" ? "tf" : "project")

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("TF 탭에는 TF 만, 정렬 순서대로", () => {
  render(<ProjectTab kind="tf" entries={[entry("p", "project", 10), entry("t2", "tf", 30), entry("t1", "tf", 20)]} reportId="r" editable notes={N} />);
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["t1", "t2"]);
});
it("진행 단계 셀렉트는 8개 고정 순서 + 미선택", () => {
  render(<ProjectTab kind="project" entries={[entry("p", "project", 10)]} reportId="r" editable notes={N} />);
  expect(within(screen.getByLabelText("진행 단계")).getAllByRole("option").map((o) => o.textContent))
    .toEqual(["단계 미선택", "기획", "요구분석", "설계", "개발", "테스트", "배포", "운영", "보류"]);
});
it("단계를 바꾸면 entry 전체를 저장한다", async () => {
  render(<ProjectTab kind="project" entries={[entry("p", "project", 10, { thisWeek: "<p>a</p>" })]} reportId="r" editable notes={N} />);
  fireEvent.change(screen.getByLabelText("진행 단계"), { target: { value: "테스트" } });
  await waitFor(() => expect(saveProjectEntry).toHaveBeenCalledWith({ reportId: "r", projectId: "p", stage: "테스트", thisWeek: "<p>a</p>", nextWeek: "" }));
});
it("맡은 TF 가 없으면 안내", () => {
  render(<ProjectTab kind="tf" entries={[]} reportId="r" editable notes={N} />);
  expect(screen.getByText("맡은 TF가 없습니다")).toBeInTheDocument();
});
it("편집 불가면 셀렉트 없이 단계를 글로", () => {
  render(<ProjectTab kind="project" entries={[entry("p", "project", 10, { stage: "배포" })]} reportId="r" editable={false} notes={N} />);
  expect(screen.queryByLabelText("진행 단계")).toBeNull();
  expect(screen.getByText("배포")).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/dashboard/ops-weekly --maxWorkers=1` → `ProjectTab.test.tsx` FAIL.
- [ ] **Step 3: 구현한다.**
- [ ] **Step 4: 통과를 확인한다.** 같은 명령 + `npx vitest run src/components/common src/lib/__tests__ --maxWorkers=1`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 프로젝트·TF 탭 — 진행 단계·그림 붙여넣기"`

---

### Task 14: 제출 현황(당번) 탭

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/StatusTab.tsx`
- Modify: `src/app/dashboard/ops-weekly/_load.ts`(status 탭이면 `listReports`·`listProjectEntriesForWeek`를 더 읽는다), `page.tsx`
- Test: `src/app/dashboard/ops-weekly/__tests__/StatusTab.test.tsx`

**Interfaces:**
- Consumes: `checkFinalize`·`canReturnReport`·`canEditDutySummary`·`canReopenWeek`(Task 3), `returnReport`·`saveDutySummary`·`finalizeWeek`·`reopenWeek`(Task 9), `setWeekDuty`(Task 10), `groupEntriesByProject`(Task 6)
- Produces: `StatusTab` `{ week: WeekRow; actor: Actor; writers: WriterCandidate[]; reports: ReportRow[]; projectGroups: ReturnType<typeof groupEntriesByProject>; finalize: FinalizeCheck }`
  - **제출 현황 표**(`table-head` 표준 칸 클래스): 이름 · 팀 · 상태(`제출` / `미제출` / `다시 작성 요청`) · 제출 시각(`formatMdHm`) · [보기](`?week=&tab=application&op=`) · [다시 작성](`canReturnReport`일 때만 → 사유 입력 후 `returnReport`)
  - **주요(운영부 전체)** 금주/차주 textarea(`canEditDutySummary`일 때만 편집 가능 → `saveDutySummary`)
  - **프로젝트·TF 모아보기**: 항목 → 담당자별 단계·금주·차주(읽기 전용, 프로젝트 먼저 그다음 TF)
  - **[최종 보고]** 버튼: `finalize.ok`일 때만 켠다. 꺼져 있으면 그 아래에 이유를 적는다 — pending은 `미제출: {이름, …}`, empty-roster는 `작성 대상 명단을 읽지 못했습니다`, forbidden은 `당번 또는 관리자만 보고할 수 있습니다`. 누르면 `confirm`(ModalShell) 뒤 `finalizeWeek`.
  - 보고된 주에서 admin에게만 **[정정]** → `reopenWeek`. 열린 주에서 admin에게만 당번 바꾸기 셀렉트 → `setWeekDuty`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("최종 보고는 전원 제출 전에는 꺼져 있고 미제출자를 적는다", () => {
  render(<StatusTab {...base} finalize={{ ok: false, reason: "pending", pending: ["b@x"] }} />);
  expect(screen.getByRole("button", { name: "최종 보고" })).toBeDisabled();
  expect(screen.getByText("미제출: 운영자B")).toBeInTheDocument();
});
it("빈 명단이면 꺼져 있다 — 0/0 을 전원 제출로 보지 않는다", () => {
  render(<StatusTab {...base} writers={[]} finalize={{ ok: false, reason: "empty-roster", pending: [] }} />);
  expect(screen.getByRole("button", { name: "최종 보고" })).toBeDisabled();
  expect(screen.getByText("작성 대상 명단을 읽지 못했습니다")).toBeInTheDocument();
});
it("상태 세 가지 + 보고서 행이 없으면 미제출", () => {
  render(<StatusTab {...base} writers={[wa, wb, wc]} reports={[rep("a@x", "submitted"), rep("b@x", "returned")]} />);
  expect(rowText("운영자A")).toContain("제출");
  expect(rowText("운영자B")).toContain("다시 작성 요청");
  expect(rowText("운영자C")).toContain("미제출");
});
it("[다시 작성] 은 당번에게, 제출한 행에만", () => {
  render(<StatusTab {...base} actor={{ email: "d@x", isAdmin: false }} reports={[rep("a@x", "submitted")]} writers={[wa, wb]} />);
  expect(within(row("운영자A")).getByRole("button", { name: "다시 작성" })).toBeInTheDocument();
  expect(within(row("운영자B")).queryByRole("button", { name: "다시 작성" })).toBeNull();
});
it("[정정] 은 admin · 보고된 주에만", () => {
  render(<StatusTab {...base} week={{ ...WEEK, status: "reported" }} actor={{ email: "z@x", isAdmin: true }} />);
  expect(screen.getByRole("button", { name: "정정" })).toBeInTheDocument();
  cleanup(); render(<StatusTab {...base} week={{ ...WEEK, status: "reported" }} actor={{ email: "d@x", isAdmin: false }} />);
  expect(screen.queryByRole("button", { name: "정정" })).toBeNull();
});
it("프로젝트 모아보기 — 항목 아래 담당자별", () => {
  render(<StatusTab {...base} projectGroups={[{ projectId: "p1", projectName: "PIMS", kind: "project", owners: [pe("운영자A"), pe("운영자B")] }]} />);
  expect(within(screen.getByRole("region", { name: "PIMS" })).getAllByTestId("owner-name").map((n) => n.textContent)).toEqual(["운영자A", "운영자B"]);
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/dashboard/ops-weekly --maxWorkers=1` → `StatusTab.test.tsx` FAIL.
- [ ] **Step 3: 구현한다.** `_load.ts`에서 status 탭이면 `finalize = checkFinalize(actor, week, writers.map(e), submittedSet)`을 계산해 넘긴다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령 + `npx vitest run src/components/common src/lib/__tests__ --maxWorkers=1`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 제출 현황·당번 화면 — 다시작성·최종보고·정정"`

---

### Task 15: 설정 탭 + 전체 검증 + CLAUDE.md

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/SettingsTab.tsx`, `RecipientsPanel.tsx`, `RotationPanel.tsx`, `WriterExclusionPanel.tsx`, `ProjectCatalogPanel.tsx`
- Modify: `src/app/dashboard/ops-weekly/_load.ts`(settings 탭이면 `loadSettingsBundle`), `page.tsx`, `CLAUDE.md`(기능 절 1개)
- Test: `src/app/dashboard/ops-weekly/__tests__/SettingsTab.test.tsx`

**Interfaces:**
- Consumes: `SettingsBundle`·`RECIPIENT_WARNING_LABEL`(Task 3·10), 설정 action 전부(Task 10)
- Produces:
  - `SettingsTab` `{ bundle: SettingsBundle }`: 패널 네 개를 세로로 놓는다.
  - `RecipientsPanel`: 받는 사람 목록. 경고가 있으면 `RECIPIENT_WARNING_LABEL` 배지와 `권한은 운영자 관리에서 부여합니다` 한 줄. 추가는 운영자 셀렉트(`ListSelect`) + 직접 입력 → `addRecipient`. 돌아온 경고는 그 자리에 보여 준다.
  - `RotationPanel`: 순번(위/아래 버튼으로 순서를 바꾸고, 작성 대상 중에서 추가·삭제) + 기준 주(`DateInput`, 월요일만) + `저장` → `saveRotation`. 아래에 `기준 주에 첫 사람이 당번이고 매주 다음 사람으로 넘어갑니다. 이미 열린 주의 당번은 바뀌지 않습니다.`
  - `WriterExclusionPanel`: `writerCandidates`(부장·팀장은 이미 빠진 목록) 체크박스. 체크한 사람은 작성 대상에서 영구 제외한다(테스트 계정 등) → `saveExcludedWriters`. 설명: `그 주만 빼는 기능은 없습니다 — 휴가인 사람은 미리 작성합니다.`
  - `ProjectCatalogPanel`: 항목명 · 구분(프로젝트/TF) · 순서 · 사용 토글 · 담당자 다중 선택 → `upsertProject` / `setProjectOwners`. `+ 항목 추가`.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
it("메뉴 권한 없는 받는 사람에 경고 배지", () => {
  render(<SettingsTab bundle={bundle({ recipients: [{ email: "r@x", name: "부서장A", warning: "no-menu" }] })} />);
  expect(within(screen.getByRole("region", { name: "받는 사람" })).getByText("메뉴 권한 없음")).toBeInTheDocument();
});
it("순번 순서 바꾸기 → 저장이 바뀐 순서를 보낸다", async () => {
  render(<SettingsTab bundle={bundle({ rotation: ["a@x", "b@x"], anchorWeekStart: "2026-11-16" })} />);
  fireEvent.click(within(rowOf("운영자B")).getByRole("button", { name: "위로" }));
  fireEvent.click(screen.getByRole("button", { name: "순번 저장" }));
  await waitFor(() => expect(saveRotation).toHaveBeenCalledWith({ emails: ["b@x", "a@x"], anchorWeekStart: "2026-11-16" }));
});
it("프로젝트 목록에 시드 15개와 구분이 보인다", () => {
  render(<SettingsTab bundle={bundle({ projects: SEED_PROJECT_NAMES.map((n, i) => proj(n, i)) })} />);
  expect(within(screen.getByRole("region", { name: "프로젝트·TF 목록" })).getAllByRole("row")).toHaveLength(16); // 머리 + 15
});
it("작성 제외 체크 → 저장", async () => {
  render(<SettingsTab bundle={bundle({ writerCandidates: [wa, wt], excludedWriterEmails: [] })} />);
  fireEvent.click(screen.getByLabelText("테스트1 제외"));
  fireEvent.click(screen.getByRole("button", { name: "제외 저장" }));
  await waitFor(() => expect(saveExcludedWriters).toHaveBeenCalledWith({ emails: [wt.email] }));
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/dashboard/ops-weekly --maxWorkers=1` → `SettingsTab.test.tsx` FAIL.
- [ ] **Step 3: 구현하고, `CLAUDE.md`에 `## /dashboard/ops-weekly — 운영부 주간업무보고` 절을 더한다**(20줄 안쪽). 담을 내용:
  - slug와 그것을 고른 이유(잡 id `weekly-report`)
  - 작성 대상 규칙과 영구 제외 목록
  - 본부 기준 주차와 월~일 데이터 창
  - 주가 열리는 시점(직전 주 보고 즉시, 늦어도 월 00:00, 접근할 때 만든다)
  - 제출 때 스냅샷으로 굳히는 이유
  - `emitOpsWeeklyEvent` 훅이 A2·A3의 자리라는 것
  - `ops_weekly_dev_status`가 A4의 자리이고 비어 있으면 `구분 미확인`
  - 그림 버킷
  - 설계·계획 문서 경로
- [ ] **Step 4: 전체 검증** — 각 명령의 출력을 읽고 숫자를 적는다

```bash
find src/features/ops-weekly src/app/dashboard/ops-weekly src/app/dashboard/_data src/components/common src/lib/__tests__ -name "*.test.ts*" | wc -l   # 50 미만
npx vitest run src/features/ops-weekly src/app/dashboard/ops-weekly src/app/dashboard/_data src/app/dashboard/__tests__ src/components/common src/lib/__tests__ --maxWorkers=1
grep -rln "phaseOf\|opensNextWeek\|nextWeekRange\|weekDateRange\|formatDateRange\|sanitizeNoteHtml\|RichNote" src --include=*.test.ts* | xargs -n1 dirname | sort -u   # 재사용한 심볼의 소비처 — 위 목록에 없으면 더해서 한 번 더 돌린다
npm run typecheck
npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx' '*.mjs')
```

Expected: vitest 0 failed, typecheck exit 0, eslint 0 problems. `next build`·dev 서버·전체 테스트는 돌리지 않는다.

- [ ] **Step 5: Commit** — `git commit -m "feat: 주간업무보고 관리자 설정 탭·문서"`

---

## 머지 전 체크리스트 (사용자)

- [ ] Supabase에 `supabase/migrations/20261116_ops_weekly.sql`을 적용한다. 그다음 워크트리 루트에서 `node scripts/ops-weekly-verify.mjs`를 실행해 전 항목이 ✓이고 exit 0인지 본다.
- [ ] 관리자 설정에서 테스트 계정 둘을 **작성 제외**에 넣고, 순번표와 기준 주를 정하고, 받는 사람(부장·팀장)과 프로젝트 담당자를 지정한다.
- [ ] A1은 아무것도 발송하지 않는다. 수요일 요청과 목요일 알림은 A2 머지 뒤에 시작된다.

---

## Later PRs (A1이 넘겨주는 인터페이스)

- **A2 — 발송**: 자동화 잡 셋을 둔다 — `ops-weekly-request`(수 10:00), `ops-weekly-remind`(목 12:00·17:00), 그리고 이벤트 훅 `ops-weekly-mail`(`OPS_WEEKLY_HOOKS`에 등록). 쓰는 것: `ensureWeek(weekStart)`, `weekOf(now)`, `listWriters()`, `listPendingWriters(weekId)`, `listRecipients()`, `getWeekById`, `OPS_WEEKLY_PATH`, 이벤트 `all-submitted`(당번에게) · `report-returned`(그 운영자에게) · `week-reported`(`correction === true`면 메일을 생략한다). Teams '운영부 마법사' chat id는 새 env로 받는다. `…_DRY_RUN`, `recordAutomationRun`, cron-job.org 등록 체크리스트가 들어간다.
- **A3 — 엑셀·워드 저장**: `week-reported` 훅 `ops-weekly-files`가 `listReports(weekId)`(스냅샷 포함) · `loadReportDetail` · `listProjectEntriesForWeek` · `groupEntriesByProject` · `weekRefFromStart(week_start)`(파일명 `운영부 주간업무보고_ YYYY년 M월 N주차.docx`)로 팀별 엑셀(Graph workbook API, 새 시트·범위만)과 워드 한 장을 저장한다. 훅 실패(`HookOutcome`)를 당번 화면에 남길 저장 칸을 A3이 더한다. 정정 뒤 재보고(`correction: true`)에도 다시 저장한다.
- **A4 — Moa 작업 통계 수집**: `scripts/moa-closing/`의 로그인 1회에 WorkStatistics 수집을 얹어 `ops_weekly_dev_status (service_id, stage 'dev'|'test', raw_label, collected_at)`에 upsert한다. 주간보고는 `listDevStatuses` + `freshDevStages`(그 주 월 00:00 KST 이후 수집분만)로 읽기만 한다. 화면 구조는 승인받은 1회 로그인으로 먼저 확인한다.
