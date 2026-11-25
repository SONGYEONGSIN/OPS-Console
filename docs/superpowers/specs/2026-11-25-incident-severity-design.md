# 사고 등급(severity) — 구현 설계 + TDD 태스크

> 2026-11-25 · planner · 분석 전용(레포 미수정) · 등급: **전체 설계** (약 27파일 + DB 스키마 → worktree 권장)

## 1. 설계 문서

- **목표**: 사고보고에 `사고 등급`(심각/높음/보통/낮음)을 붙인다. 신규 보고는 필수, 기존 행은 NULL 유지. 폼 라벨 옆 `?` 에 hover·포커스 시 등급 기준 4줄을 띄우고, 기준 문구는 admin 이 고친다.
- **제약**: 마이그레이션은 사람이 SQL Editor 로 머지 **전** 적용 · 경위서/PDF/대학 메일에는 안 나간다 · 새 색 토큰 금지 · 진행 중인 `fix/incident-inspector-year-width` 와 겹치지 않게 · 서버 action 은 클라이언트를 믿지 않는다.
- **기준 문구 저장 — 접근 A**: `ops_weekly_settings` 식 싱글턴 행에 텍스트 칸 넷. 장점: 기존 패턴 그대로. 단점: 등급 이름이 칸 이름에 묻혀 CHECK 와 단일 소스로 묶이지 않는다.
- **접근 B**: 등급당 한 행 `incident_severity_criteria(severity PK CHECK 4값, description)`. 장점: 행 집합 = 등급 집합, 이름은 PK CHECK 로 고정되고 설명만 바뀐다. upsert 한 번에 넷을 저장한다. 단점: 표가 하나 늘어난다.
- **선택: B**. RLS·쓰기 경로는 `ops_weekly_settings` 를 따른다 — 테이블 GRANT 는 authenticated 에 select 만 주고, 쓰기는 server action 이 admin 을 다시 확인한 뒤 `createAdminClient()`(service_role)로 한다(`src/features/ops-weekly/settings-actions.ts:42-50,143-165`). 다른 점 하나: 읽기 정책이 `using (true)` 다. 폼을 쓰는 사람은 전원 기준을 봐야 한다.
- **검증**: 파일 단위 vitest(RED→GREEN) · 마이그레이션 원문 대조 테스트(주석 먼저 제거) · SQL Editor 적용 뒤 카탈로그 조회 + service_role 읽기 전용 스크립트 · `src/components/common` 전역 가드 테스트 · 수동 QA(§8 T20).

### 확정 (사용자 승인 — 다시 열지 않음)
화면 이름 `사고 등급` · 4값 · 폼의 발생일자/처리일자 줄 **바로 아래** · 신규만 필수 · 노출은 폼·인스펙터 상세·목록 표뿐 · `?` hover+포커스 툴팁 · admin 만 설명을 고친다(이름은 고정).

### 내가 정한 것 (가정 — 이견 있으면 정정)
1. **설정한 등급을 다시 비우지 못한다.** select 의 빈 옵션 `등급 선택` 은 `disabled` 이고 값이 비어 있을 때만 보인다. 그래서 update 스키마는 `null` 을 거부한다. 기존 NULL 행은 그대로 저장된다(빈 값은 payload 에서 빠진다).
2. **표·상세에서는 등급을 평문으로 쓴다**(`text-xs text-ink-soft`, 비면 `—`). 배지·새 토큰은 쓰지 않는다.
3. 기준을 못 읽으면 툴팁에 `기준을 불러오지 못했습니다.` 를 띄우고 `기준 편집` 은 숨긴다. 코드에 기본 문구 사본을 두지 않는다(폴백 금지). 기본 문구의 원천은 마이그레이션 seed 하나다.
4. `blankIncidentRow`(`filters.ts`)는 **건드리지 않는다**. 새 행의 `incidentSeverity` 가 undefined 인 것이 곧 '아직 안 고름'이다. 진행 중인 브랜치와 겹치지 않는 이유도 이것이다.

### 사용자 결정 (2026-11-25, 아래 열린 질문의 답)
- **Q1 → A 변형**: `?` 바로 옆에 **톱니바퀴 아이콘 버튼**(admin 에게만 보임, `aria-label="사고 등급 기준 편집"`)을 두고 누르면 편집 모달. 텍스트 `기준 편집` 버튼 대신 아이콘이다. `ml-auto` 로 멀리 보내지 않고 `?` 옆에 붙인다. 아이콘은 레포가 이미 쓰는 아이콘 방식(라이브러리/인라인 SVG)을 따른다.
- **Q2 → 넣지 않음**: 내부 보고 메일·첨부 PDF 에도 등급을 넣지 않는다.
- 진행 중이던 `fix/incident-inspector-year-width` 는 PR #1319 로 머지된다 — 이 작업은 그 뒤 main 에서 딴 브랜치에서 한다. worktree 대신 메인 작업 트리의 브랜치를 쓴다(정션 삭제 사고 이력).

### 열린 질문 (사용자 판단 필요) — 답은 위 '사용자 결정'
- **Q1. admin 이 기준을 고치는 자리** — **추천: A**
  - **A. 폼 라벨 줄의 `?` 옆에 `기준 편집` 버튼(admin 만) → `ModalShell` 편집기.** 장점: 기준을 쓰는 자리에서 고치고, 고친 결과를 툴팁으로 바로 본다. 단점: 사고 폼(신규·수정)을 열어야 버튼이 보여서 찾기 어렵다. 버튼을 툴팁 **안**에 두지 않는 이유: `role="tooltip"` 은 누를 수 있는 요소를 담지 않는다(WAI-ARIA). hover 가 풀리면 링크가 사라져 누를 수 없고, 키보드로 링크까지 가는 동안 툴팁을 열어 두려면 CSS 로는 안 된다.
  - **B. `/dashboard/settings` 에 '사고 등급 기준' 섹션.** 장점: 이미 admin 가드가 있고 설정이 한곳에 모인다. 단점: CLAUDE.md 기준으로 설정 화면은 env·빌드·DB 스냅샷 화면이다(섹션 제목 6개, `SettingsClient.tsx:145-534`). 그래서 편집 섹션은 처음일 가능성이 크다 — `회사 PC 연결` 섹션에 쓰기 동작이 있는지는 확인하지 못했다. 기준을 쓰는 자리와도 멀다.
  - B 를 고르면 T12·T13 의 자리가 settings 로 옮겨 간다. 파일 수는 비슷하고 EditForm 의 admin 분기는 없어진다.
- **Q2. 내부 보고 메일(허승철/송영신 + 참조)과 첨부 PDF(`incident-pdf.tsx`)에도 등급을 넣을까?** 기본은 안 넣는다 — 노출 목록에 없다. 지금도 자동으로 따라가지 않는다(§2).

## 2. 행이 지나가는 자리 (file:line)

| 자리 | 지금 | 변경 |
|---|---|---|
| `supabase/migrations/` | `incidents` 에 severity 없음. CHECK 스타일은 `20260527b_incidents_app_type_add_pims.sql:6-11` | 새 마이그 1개(§3) |
| `src/features/incidents/schemas.ts:3-19` | enum 상수 + zod enum 패턴 | `SEVERITY_VALUES`·`severitySchema`·`SEVERITY_REQUIRED` 추가 |
| `schemas.ts:35-58` `incidentRowSchema` | `service_name` 이 `.nullable().optional()` | `severity: severitySchema.nullable().optional()` (마이그 전 행도 통과) |
| `schemas.ts:65-81` `incidentCreateSchema` | 필수 필드는 Korean 메시지 | `severity: z.enum(SEVERITY_VALUES, { error: SEVERITY_REQUIRED })` — **신규 필수의 서버 강제점** |
| `schemas.ts:85` `incidentUpdateSchema = create.partial()` | | 변경 없음 → severity 는 optional(undefined 만 통과, null 거부) |
| `src/features/incidents/actions.ts:51-57, 106-109` | `...parsed.data` 를 그대로 insert/patch | **변경 없음** — 스프레드가 severity 를 실어 나른다 |
| `src/features/incidents/queries.ts:24,74,104` | `select("*")` + rowSchema | 변경 없음(자동 포함) |
| `src/app/dashboard/incidents/_row-mapper.ts:20-21` | snake→camel | `incidentSeverity: r.severity ?? null` |
| `src/app/dashboard/incidents/_to-payload.ts:14-15` | camel→snake | `severity: row.incidentSeverity ?? undefined` — **null 이 아니라 undefined**(기존 NULL 행 수정이 update 스키마에 걸리지 않게) |
| `src/app/dashboard/incidents/page.tsx:121,187-193,222` | 매핑·저장·props | 기준 조회 1회 + `incidentSeverityCriteria` prop |
| `ListPattern.tsx:331-333` `ListRow` | `incidentResolvedDate` | 그 아래 `incidentSeverity?: IncidentSeverity \| null` (이 파일은 이미 features 타입을 import: `:8,18,27`) |
| `ListPattern.tsx:801,865,1128` · `InspectorListBody.tsx:81,139,206` · `list-variants/types.ts:130` | `incidentCategorySuggestions` 전달 경로 | 같은 경로로 `incidentSeverityCriteria?: SeverityCriteria \| null` |
| `list-variants/incidents/EditForm.tsx:51,108-111,247-277` | `isNew`, onSubmit, 일자 grid | grid **뒤(:277 다음)** 에 `<SeverityField>`, onSubmit 에 신규 가드(**클라이언트 강제점**) |
| `list-variants/incidents/View.tsx:102-109` | `일자` Section | 그 뒤에 `사고 등급` Section(평문) |
| `list-variants/incidents/Table.tsx:27,40,59-65` | 9열, `colSpan={9}` | `상태` 뒤 `등급` 열, colSpan 10 |
| `src/app/dashboard/page.tsx:141` (실시간 현황) | `incidentToListRow(i)` | 변경 없음(필드 하나 늘 뿐) |

**경위서·PDF·메일로 새지 않는 근거** — 이 경로들은 모두 칼럼이나 필드를 이름으로 골라 쓴다.
- `incident-reports/actions.ts:46-47,225-226` 는 select 칼럼을 열거한다.
- `incidents/mail-actions.ts:44-64` 는 `getIncidentById` 결과에서 템플릿 필드를 하나씩 매핑한다. `incident-pdf.tsx`·`mail-template.ts` 는 그 입력만 받는다.
- `incident-report-pdf.tsx` 는 `incident_reports` 스냅샷에서 그린다.
- `assistant/search.ts:217-218`·`performance/queries.ts:70-71` 도 칼럼을 열거한다.
- 오류 노출 경로: 서버 오류는 `ListPattern.tsx:963,1158` 의 `alert("저장 실패: …")` 로 뜬다.

## 3. 마이그레이션 — `supabase/migrations/20261125_incident_severity.sql`

(같은 날짜 파일이 있으면 `20261125b_…`. `public.set_updated_at()` 은 이미 있다 — `20261116_ops_weekly.sql:128` 이 쓴다.)

```sql
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
```

**SQL Editor 검증**(적용 직후, postgres 롤):
```sql
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema='public' and table_name='incidents' and column_name='severity';   -- severity | text | YES
select pg_get_constraintdef(oid) from pg_constraint where conname='incidents_severity_check';
select count(*) as total, count(severity) as graded from public.incidents;           -- graded = 0
select severity, left(description, 24) from public.incident_severity_criteria
 order by array_position(array['심각','높음','보통','낮음'], severity);                -- 4행
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='incident_severity_criteria' order by 1,2; -- authenticated=SELECT 만, anon 없음
select polname, polcmd, pg_get_expr(polqual, polrelid) from pg_policy
 where polrelid='public.incident_severity_criteria'::regclass;                         -- 1개, r, true
```

**service_role 검증**(PostgREST 층에서 스키마 캐시와 GRANT 를 본다. 읽기만 하고 아무것도 쓰지 않는다). ESM import 는 스크립트 위치에서 풀리므로 **레포 루트에 `_verify-severity.mjs` 를 잠깐 두고** `node --env-file=.env.local _verify-severity.mjs` 로 돌린 뒤 지운다. 커밋하지 않는다. env 이름은 `src/lib/supabase/admin.ts` 에서 확인한다.
```js
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, o = { auth: { persistSession: false } };
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, o);
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, o);
const a = await svc.from("incidents").select("severity", { count: "exact", head: true });
const b = await svc.from("incident_severity_criteria").select("severity, description");
const c = await anon.from("incident_severity_criteria").select("severity");
process.stdout.write(JSON.stringify({
  severityCol: a.error?.message ?? (a.count === null ? "count null = 실패" : `ok ${a.count}`),
  criteria: b.error?.message ?? b.data.map((r) => r.severity),   // 4개
  anon: c.error?.code ?? `rows=${c.data.length}`,                 // 42501 기대
}, null, 2));
```

## 4. UI 상세

**`SeverityField.tsx`**(신규, client). Props: `value` · `onChange(v)` · `required`(=isNew) · `error` · `criteria: SeverityCriteria | null` · `canEditCriteria`(=isAdmin).
- 머리 줄 `div.mb-1.flex.items-center.gap-1.5.text-muted`: `사고 등급` 다음에 `required` 일 때 `(필수)`(`text-faint`, EditForm `:167` 의 힌트 톤). 그 뒤 툴팁 그룹, 맨 오른쪽(`ml-auto`)에 admin 일 때만 `기준 편집` 버튼.
- 툴팁 그룹 `span.group.relative.inline-flex`
  - `?` 버튼: `<button type="button" aria-label="사고 등급 기준 보기" aria-describedby={tipId}>`, 클래스 `h-4 w-4 cursor-help border border-line-soft text-[10px] text-ink-muted hover:border-ink hover:bg-ink hover:text-cream focus:border-ink`.
  - 툴팁 `div role="tooltip" id={tipId}`, 클래스 `absolute left-0 top-full z-20 mt-1.5 hidden w-max max-w-[300px] border border-ink bg-cream px-2.5 py-2 text-[11px] leading-snug text-ink group-hover:block group-focus-within:block`.
  - 내용은 `<dl>` 로 등급마다 `dt.font-semibold` + `dd.text-ink-soft`(빈 설명은 `—`). `criteria === null` 이면 `기준을 불러오지 못했습니다.`
  - 모양은 `live/MetricSubcard.tsx:47-53` 톤 그대로이고, 다른 점은 둘이다. ① 포커스로도 열린다. ② `pointer-events-none` 을 빼서 포인터를 툴팁 위로 옮겨도 닫히지 않는다(WCAG 1.4.13). 이 툴팁은 두 번째 사용처라 common 으로 뽑지 않는다(3회 규칙). id 는 `useId()`.
- select: `aria-label="사고 등급"`, 입력 표준 클래스 `w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white`. 값이 비었을 때만 `<option value="" disabled>등급 선택</option>` 을 넣고, 그 뒤에 `SEVERITY_VALUES` 를 차례로 둔다. 오류가 있으면 `aria-invalid` 를 켜고 `p role="alert" className="mt-1 text-2xs text-vermilion"` 를 붙인다(View `:252` 와 같은 톤).
- `?` 와 `기준 편집` 은 `<button>` 이라 버튼 호버 표준을 따른다(`design.md`). `button-hover-standard` 가드가 이를 잡는다.

**`SeverityCriteriaEditor.tsx`**(신규, client)
- `ModalShell title="사고 등급 기준 편집"`(`components/common/ModalShell.tsx:30`) 안에 등급마다 label + textarea(rows 3, maxLength 500, 입력 표준 클래스)를 둔다.
- footer 의 저장/취소는 EditForm `:409-420` 클래스를 그대로 쓴다.
- 저장은 `useTransition` 안에서 `updateSeverityCriteria(draft)` 를 부른다. View `:230-240` 이 `createIncidentReport` 를 부르는 방식과 같다. ok 면 `onClose()` 하고 `revalidatePath` 가 props 를 새로 그린다. 실패하면 모달 안에 `text-vermilion` 문구를 띄운다.

**View** — `일자` Section(`:102-109`) 바로 뒤에 `<Section title="사고 등급"><DefList items={[{ term: "등급", desc: row.incidentSeverity ?? "—" }]} /></Section>`.
**Table** — `상태` 뒤에 `<th>등급</th>`, 셀은 `whitespace-nowrap px-3 py-2 text-xs text-ink-soft` 에 `?? "—"`. `colSpan` 9→10.

## 5. 영향 파일 — 신규 10 + 수정 17 = **27** (+CLAUDE.md 선택 1)

- **신규**
  - 마이그 `.sql`, `__tests__/severity-migration.test.ts`
  - `features/incidents/severity-criteria-queries.ts`(+test), `severity-criteria-actions.ts`(+test)
  - `list-variants/incidents/SeverityField.tsx`(+test), `SeverityCriteriaEditor.tsx`(+test)
- **수정**
  - `features/incidents/schemas.ts`, `__tests__/schemas.test.ts`, `__tests__/actions.test.ts`
  - `dashboard/incidents/_row-mapper.ts`(+test), `_to-payload.ts`(+test), `page.tsx`
  - `ListPattern.tsx`, `InspectorListBody.tsx`, `list-variants/types.ts`
  - `incidents/EditForm.tsx`(+test), `View.tsx`(+test), `Table.tsx`(+test)
- `actions.ts` · `queries.ts` · `filters.ts` 는 **안 바뀐다**.

## 6. 진행 중 변경과의 겹침 (`fix/incident-inspector-year-width`)

- 그 브랜치의 파일은 `filters.ts`(기본 학년도) · `filters.test.ts`(신규) · `inspector/inspector-layout.ts` · `list-variants/registry.ts`(보기 폭)다. **이 계획은 넷 다 건드리지 않는다**(가정 4).
- 간접 겹침이 둘 있다.
  - 표 열이 10개로 늘어 폭이 바뀐다.
  - 툴팁 `max-w-[300px]` 가 새 인스펙터 폭 안에 들어가는지 봐야 한다.
  - 둘 다 그 브랜치가 머지된 뒤 lg·md 에서 눈으로 확인한다(T20).
- 순서: 그 브랜치가 머지된 뒤 main 에서 `feat/incident-severity` 를 딴다. 먼저 따야 하면 시작 전에 `git diff main...fix/incident-inspector-year-width --stat` 으로 EditForm·View·Table 이 목록에 없는지 확인한다.

## 7. 태스크 (각 2~5분 · RED 실패 확인 → GREEN → 같은 명령으로 통과 확인)

명령 접두 `npm test -- <파일> --maxWorkers=2` (아래에서는 `T <파일>` 로 줄여 쓴다). 경로 약어: `F`=`src/features/incidents`, `LV`=`src/app/dashboard/_components/inspector/list-variants/incidents`, `PG`=`src/app/dashboard/incidents`.

**T0 격리** — `git worktree add ../OPS-Console-feat-incident-severity -b feat/incident-severity main`. 20파일 이상이라 worktree 를 권장한다. node_modules 를 정션으로 이었다면 정리할 때 정션을 먼저 비재귀로 지운다(2026-11-10 사고). 의존: 없음.

**T1 등급 상수·행 스키마** — `F/schemas.ts`, `F/__tests__/schemas.test.ts` · 의존: T0
- RED: `SEVERITY_VALUES` 는 `["심각","높음","보통","낮음"]` 순서여야 한다. rowSchema 는 severity `null`·키 없음은 통과시키고 `"긴급"` 은 거부해야 한다.
- GREEN: `SEVERITY_VALUES`·`severitySchema`·`IncidentSeverity`·`SEVERITY_REQUIRED = "사고 등급을 선택하세요."` 를 추가하고, rowSchema 에 `severity: severitySchema.nullable().optional()` 를 넣는다.
- 검증: `T F/__tests__/schemas.test.ts`

**T2 신규 필수(서버 강제)** — `F/schemas.ts`, `F/__tests__/schemas.test.ts`, `F/__tests__/actions.test.ts` · 의존: T1
- RED
  - schemas: create 에서 severity 가 없으면 `issues[0].message === SEVERITY_REQUIRED` 다. update 는 `{}`·`{severity:"낮음"}` 를 통과시키고 `{severity:null}` 은 거부한다.
  - actions: severity 없이 `createIncident` 를 부르면 `{ok:false,error:"사고 등급을 선택하세요."}` 를 돌려주고 `insertPayloads` 는 비어 있다. `"심각"` 을 주면 insert payload 에 실린다. `updateIncident(id,{status:"처리중"})` 는 ok 이고 `"severity" in updatePatches[0]` 가 false 다.
  - 기존 성공 fixture 에 `severity:"보통"` 을 넣는다. 구현자 확인: schemas `:45` 의 공용 입력, actions `:139,155` 의 입력 객체.
- GREEN: createSchema 에 `severity: z.enum(SEVERITY_VALUES, { error: SEVERITY_REQUIRED })` 를 넣는다. `actions.ts` 는 바꾸지 않는다.
- 검증: `T F/__tests__/schemas.test.ts` + `T F/__tests__/actions.test.ts`

**T3 기준 입력 스키마** — `F/schemas.ts`, `F/__tests__/schemas.test.ts` · 의존: T1
- RED: 등급 키 하나라도 빠지면 거부한다. `""` 는 `기준 문구를 입력하세요.`, 501자는 `기준 문구는 500자 이내로 입력하세요.` 로 거부한다. 앞뒤 공백은 trim 된다.
- GREEN: `severityCriteriaSchema = z.record(severitySchema, z.string().trim().min(1,…).max(500,…))` 와 `type SeverityCriteria = Record<IncidentSeverity,string>` 를 추가한다. zod v4 의 enum 키 record 는 키를 모두 요구한다 — RED 로 확인한다.
- 검증: `T F/__tests__/schemas.test.ts`

**T4 마이그레이션** — `supabase/migrations/20261125_incident_severity.sql`, `F/__tests__/severity-migration.test.ts` · 의존: T1
- RED: 파일을 읽고 **`--` 주석을 먼저 지운 뒤** 대조한다.
  - `add column if not exists severity text` 가 있다.
  - 두 CHECK 의 `in (…)` 목록이 `SEVERITY_VALUES` 와 같다 — 단일 소스를 묶는다.
  - `revoke all … from public, anon, authenticated` · `grant select … to authenticated` · `grant all … to service_role` · 정책 `using (true)` 가 있다.
  - `grant (insert|update|delete|all)[^;]* to authenticated` 는 **없다**.
  - seed 에 `5,771명 오발송`·`재발번·문자 안내`·`강제접수`·`접수 전 수정` 이 있다.
  - `notify pgrst` 가 있다.
- GREEN: §3 SQL 전문을 쓴다.
- 검증: `T F/__tests__/severity-migration.test.ts`. 이 태스크가 끝나면 T20 ① 을 미리 해도 된다(additive).

**T5 행 매핑** — `ListPattern.tsx`(ListRow 타입 1줄), `PG/_row-mapper.ts`, `PG/__tests__/_row-mapper.test.ts` · 의존: T1
- RED: `severity:"높음"` 이면 `incidentSeverity:"높음"`, `null` 이면 `null` 이다.
- GREEN: `:333` 아래에 `incidentSeverity?: IncidentSeverity | null` 를 넣고, mapper 에 한 줄을 더한다.
- 검증: `T PG/__tests__/_row-mapper.test.ts`

**T6 저장 payload** — `PG/_to-payload.ts`, `PG/__tests__/_to-payload.test.ts` · 의존: T5
- RED: `incidentSeverity:"보통"` 이면 `severity:"보통"` 이다. 값이 없거나 `null` 이면 `payload.severity` 가 `undefined` 다. 기존 NULL 행 수정이 이 경우에 해당한다.
- GREEN: `severity: row.incidentSeverity ?? undefined`
- 검증: `T PG/__tests__/_to-payload.test.ts`

**T7 기준 조회** — `F/severity-criteria-queries.ts`(신규), `F/__tests__/severity-criteria-queries.test.ts` · 의존: T3
- RED: `@/lib/supabase/server` 를 mock 한다. 행 4개는 그대로 맵이 된다. 빠진 등급은 `""`, 모르는 등급 행은 무시한다. `error` 가 있으면 `null` 이다.
- GREEN: `getSeverityCriteria(): Promise<SeverityCriteria | null>` 를 만든다. 세션 클라이언트를 쓴다 — RLS 가 `using (true)` 이므로 service_role 이 필요 없다. `server-only` 처리는 `F/__tests__/queries.test.ts` 상단과 같게 한다(구현자 확인).
- 검증: `T F/__tests__/severity-criteria-queries.test.ts`

**T8 기준 저장 action** — `F/severity-criteria-actions.ts`(신규, `"use server"`), `F/__tests__/severity-criteria-actions.test.ts` · 의존: T3
- RED: `getCurrentOperator`·`@/lib/supabase/admin`(upsert spy)·`next/cache`·`@/features/worklog/log` 를 mock 한다.
  - 비로그인은 `로그인이 필요합니다.` 를 돌려주고 DB 를 호출하지 않는다.
  - member 는 `관리자만 기준을 고칠 수 있습니다.` 를 돌려주고 upsert 를 부르지 않는다. **폼이 아니라 세션으로 판정한다.**
  - admin 이 빈 문구를 보내면 zod 메시지를 돌려준다.
  - admin 이 정상 입력을 보내면 upsert 를 `SEVERITY_VALUES` 순서 4행(`updated_by: me.email`), `{ onConflict: "severity" }` 로 부른다. 이어서 `revalidatePath("/dashboard/incidents")` 를 부르고 `{ok:true}` 를 돌려준다.
  - upsert 가 error 를 내면 `기준 저장에 실패했습니다: …` 다.
- GREEN: 리다이렉트하는 `requireAdmin()` 을 쓰지 않는다 — 모달 저장이 페이지 이동이 되기 때문이다. `ops-weekly/settings-actions.ts:42-50` 처럼 `{ok:false}` 를 돌려주는 확인을 쓴다. `logActivity` 의 필수 필드는 `actions.ts:76-88` 을 보고 맞춘다.
- 검증: `T F/__tests__/severity-criteria-actions.test.ts`

**T9 SeverityField — 선택·필수·오류** — `LV/SeverityField.tsx`(신규), `LV/__tests__/SeverityField.test.tsx` · 의존: T1, T3
- RED
  - `getByLabelText("사고 등급")` 의 옵션이 `등급 선택`(disabled) + 4값이다. 값이 있으면 `등급 선택` 이 없다.
  - change 하면 `onChange("높음")` 이 불린다.
  - `(필수)` 는 `required` 일 때만 보인다.
  - `error` 가 있으면 `role=alert` 문구가 뜨고 `aria-invalid="true"` 다.
  - select 클래스에 `border-line-soft`·`bg-field-bg`·`focus:border-ink`·`focus:bg-white` 가 있다. 모양까지 단언한다.
- GREEN: §4 의 머리 줄과 select.
- 검증: `T LV/__tests__/SeverityField.test.tsx`

**T10 SeverityField — `?` 툴팁** — 같은 두 파일 · 의존: T9
- RED
  - `?` 버튼의 `aria-describedby` 가 `role="tooltip"` 의 id 와 같다.
  - 툴팁에 4개 등급 이름과 props 로 받은 설명이 모두 있다.
  - 툴팁 클래스에 `hidden`·`group-hover:block`·`group-focus-within:block` 가 있고 `pointer-events-none` 은 없다.
  - `?` 클래스에 `hover:border-ink hover:bg-ink hover:text-cream` 가 있다.
  - `criteria=null` 이면 `기준을 불러오지 못했습니다.` 가 뜬다.
- GREEN: §4 툴팁 그룹. id 는 `useId()`.
- 검증: 위와 같음

**T11 기준 편집 모달** — `LV/SeverityCriteriaEditor.tsx`(신규), `LV/__tests__/SeverityCriteriaEditor.test.tsx` · 의존: T8
- RED: `@/features/incidents/severity-criteria-actions` 를 mock 한다.
  - textarea 4개(라벨 = 등급 이름)에 현재 문구가 들어 있다.
  - 하나를 고치고 `저장` 을 누르면 고친 값을 포함한 전체 맵으로 호출된다.
  - ok 면 `onClose` 가 불린다. 실패면 오류 문구가 보이고 `onClose` 는 불리지 않는다.
  - `취소` 를 누르면 `onClose` 가 불린다.
- GREEN: §4 의 `ModalShell` + `useTransition`.
- 검증: `T LV/__tests__/SeverityCriteriaEditor.test.tsx`

**T12 admin 편집 진입** — `LV/SeverityField.tsx`, `LV/__tests__/SeverityField.test.tsx` · 의존: T10, T11 · **Q1 이 B 면 이 태스크는 settings 로 옮긴다**
- RED: `canEditCriteria=false` 면 `기준 편집` 이 없다. true 이고 criteria 가 있으면 버튼이 있고, 누르면 `사고 등급 기준 편집` 모달이 뜬다. admin 이라도 `criteria=null` 이면 버튼이 없다.
- GREEN: 버튼과 `editing` state 를 붙인다.
- 검증: `T LV/__tests__/SeverityField.test.tsx`

**T13 EditForm 배치 + 신규 가드(클라이언트 강제)** — `LV/EditForm.tsx`, `LV/__tests__/EditForm.test.tsx`, `list-variants/types.ts` · 의존: T2, T12
- RED
  - `처리일자` → `사고 등급` → `사고제목` 순서다(`compareDocumentPosition`).
  - 새 행(`id:""`)에 등급 없이 `저장` 을 누르면 `onSave` 가 안 불리고 `사고 등급을 선택하세요.` 가 뜬다. 등급을 고르면 문구가 사라진다.
  - 새 행에 등급을 고르고 저장하면 `onSave` 가 `incidentSeverity` 를 담아 불린다.
  - **기존 행(`id:"x"`)은 등급이 없어도 `onSave` 가 불린다.**
  - admin 에게만 `기준 편집` 이 보인다.
- GREEN: `:277` 뒤에 `<SeverityField>` 를 넣는다(`required={isNew}`, `canEditCriteria={isAdmin}`). onSubmit(`:108-111`) 에서 `isNew && !row.incidentSeverity` 면 `setSeverityError(SEVERITY_REQUIRED)` 하고 return 한다. EditFormProps(`types.ts:130`) 에 `incidentSeverityCriteria?: SeverityCriteria | null` 를 넣고, 기본값은 `null` 이다.
- 검증: `T LV/__tests__/EditForm.test.tsx`

**T14 전달 통로 ①** — `inspector/InspectorListBody.tsx`(`:81,139,206`), `inspector/__tests__/InspectorListBody.test.tsx` · 의존: T13
- RED: 기존 케이스의 렌더 방식으로 incidents 편집 모드를 그리고 `incidentSeverityCriteria` 를 넘기면 툴팁에 그 문구가 보인다.
- GREEN: `incidentCategorySuggestions` 옆에 같은 모양으로 붙인다.
- 검증: `T src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx`

**T15 전달 통로 ② + 조회** — `ListPattern.tsx`(`:801,865,1128`), `PG/page.tsx`(`:222` 부근) · 의존: T7, T14
- 변경: `getSeverityCriteria()` 를 page 의 기존 조회와 함께 한 번 부르고 prop 으로 내린다. 기존 병렬 조회가 있으면 그 안에 끼운다(구현자 확인).
- 이 통로에는 원래 테스트가 없다(`incidentCategorySuggestions` 를 다루는 테스트 0건). 그래서 검증은 `npm run typecheck` 와 T20 QA(툴팁에 seed 문구가 뜨는지)로 한다.

**T16 상세 표시** — `LV/View.tsx`, `LV/__tests__/View.test.tsx` · 의존: T5
- RED: `incidentSeverity:"심각"` 이면 `사고 등급` 섹션에 `심각` 이, `null` 이면 그 섹션에 `—` 가 나온다.
- GREEN: §4 View 한 블록.
- 검증: `T LV/__tests__/View.test.tsx`

**T17 목록 열** — `LV/Table.tsx`, `LV/__tests__/Table.test.tsx` · 의존: T5
- RED: `등급` 머리칸이 `상태` 바로 다음이다. 셀에는 값 또는 `—` 가 나온다. 빈 목록의 `colSpan` 은 10 이다.
- GREEN: §4 Table.
- 검증: `T LV/__tests__/Table.test.tsx`

**T18 (선택) 문서** — `CLAUDE.md` 사고보고 줄에 한 문장을 넣는다: 등급 4값, 신규 필수, 기준은 `incident_severity_criteria`, 편집 자리. 의존: T15

**T19 전체 검증** — 의존: T1~T17
- `npm run typecheck` · `npm run lint`
- `npm test -- src/features/incidents src/app/dashboard/incidents src/app/dashboard/_components/inspector --maxWorkers=2`
- **`npm test -- src/components/common --maxWorkers=2`**(레포 전역 가드 — 버튼 호버·색 하드코딩)
- e2e 는 사고 신규 저장 흐름이 없어서(`e2e/` grep 결과) 바꿀 것이 없다.

**T20 머지 게이트(사람)** — 의존: T4, T19
- ① 사용자가 §3 SQL 을 SQL Editor 에서 실행한다.
- ② §3 의 카탈로그 조회 6개를 돌린다.
- ③ service_role 스크립트를 돌린다(읽기 전용, 실행 뒤 삭제).
- ④ dev 수동 QA
  - member: 신규 보고에 등급이 없으면 막힌다. 고르면 저장되고 목록 열·상세에 나온다.
  - 기존 NULL 행을 수정해도 저장되고 `—` 로 보인다.
  - `?` 는 hover 와 Tab 포커스로 열리고, 툴팁 위로 포인터를 옮겨도 유지된다.
  - admin 이 고친 기준이 툴팁에 바로 반영된다. member 에게는 버튼이 없다.
  - 경위서 탭·PDF·보고 메일(`MAIL_DRY_RUN`)에 등급이 없다.
  - lg·md 에서 표 10열과 툴팁이 잘리지 않는다(진행 중인 폭 변경이 머지된 뒤).
- ⑤ PR(squash): `feat: 사고보고에 사고 등급 추가 — 신규 필수 + 기준 툴팁(관리자 편집)`

병렬 가능: T3 다음에 {T4} ∥ {T5→T6} ∥ {T7, T8} · {T16, T17} 은 T5 다음 언제든.

## 8. 리스크

1. **배포 순서.**
   - 마이그 전에 코드가 나가면 `createIncident` 의 insert 가 `column "severity" does not exist` 로 **모든 신규 보고에서 실패**한다.
   - 마이그는 additive 라 먼저 적용해도 현재 코드는 무사하다 — zod object 가 모르는 키를 버린다. 그러니 T4 직후 적용을 권한다.
2. **zod v4 동작 두 가지는 RED 로만 확정된다.**
   - 키가 빠졌을 때 `z.enum(…, { error })` 메시지가 나오는가.
   - enum 키 `z.record` 가 키를 모두 요구하는가.
   - 안 되면 각각 `error: () => SEVERITY_REQUIRED`, `.refine` 으로 바꾼다.
3. **T2 에서 기존 create fixture 가 빨개진다** — 의도된 RED 다. 같은 태스크 안에서 고친다.
4. **CSS 툴팁은 Esc 로 닫히지 않는다**(WCAG 1.4.13 dismissible). 필요하면 `?` 에 `onKeyDown` Escape → `blur()` 한 줄을 단다. 터치에서는 탭하면 포커스가 잡혀 열린다.
5. **신규 필수는 앱에서만 강제된다.** service_role 로 넣는 import 스크립트(예: 학년도 백필)는 등급 없이 들어간다 — 과거 건이라 의도된 것이다.
6. **툴팁이 잘릴 수 있다.** 인스펙터 스크롤 상자 안의 absolute 라, 폭이 좁으면 오른쪽이 잘린다 → T20 에서 확인한다.
7. **`ListPattern.tsx` 는 1100줄이 넘는 공용 파일이라 충돌이 잦다.** 삽입은 네 곳(`:333`·`:801`·`:865`·`:1128`)만 한다. 리베이스 때 이 네 곳만 본다.
