---
plan_id: 20260516-113000-incidents-domain
status: in_progress
created: 2026-05-16T11:30:00Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260516-110000-incidents-domain.md
branch: feat/incidents-domain
---

# Plan: 사고 보고 (incidents) 도메인 신설 (PR-6)

## Goal

사이드바 mock "사고 보고"를 실 DB로 promote. 학년도 단위 관리(`year` 컬럼 + UI selector), 본문 4섹션(경위/원인/처리/대책), 자동 채움(담당자 본인 / 보고자 부서별 고정). 단일 PR로 마이그 2 + ~13 파일.

## Approach

`backup_requests` 패턴(RLS authenticated read + admin/member write + list-variant)을 그대로 차용. `university_name` 자유 텍스트 + services suggestion, status/department/app_type만 CHECK enum. `currentAcademicYear()` 헬퍼로 학년도 default. server action에서 보고자 자동 매핑(허승철/송영신 hardcode).

## Out of Scope

- 시트 226 row import (즉시 후속 PR — `scripts/incidents-import.mjs`)
- 메일 알림 / SharePoint 연동
- 첨부 파일
- 댓글 / 활동 로그
- universities / services FK 정규화

## 영향 파일

```
T1 마이그 table ──┐
T2 마이그 RLS ────┤
T3 datetime  ─────┤
                  ├─→ T4 schemas ──→ T5 queries ──→ T6 actions ─┐
                  └─────────────────────────────────────────────┤
T7 list-variant 폴더 (View/EditForm/Table/filters) ─────────────┤
T8 registry + types ───────────────────────────────────────────┤
T9 ListPattern type 확장 ──────────────────────────────────────┤
T10 page.tsx ─────────────────────────────────────────────────→ T13 verify
T11 menu-counts ───────────────────────────────────────────────┤
T12 _data.ts 사이드바 count placeholder ───────────────────────┘
```

## 단계

### T1: 마이그 — incidents 테이블 + 인덱스 + check

- **상태**: pending
- **파일**: `supabase/migrations/20260526_incidents_table.sql` (신규)
- **변경**:
  ```sql
  begin;
  create table public.incidents (
    id              uuid primary key default gen_random_uuid(),
    year            integer not null,
    university_name text not null,
    app_type        text not null check (app_type in ('공통원서','일반원서','공공원서')),
    category        text not null,
    occurred_date   date,
    resolved_date   date,
    title           text not null,
    cause_summary   text,
    root_cause      text,
    resolution      text,
    prevention      text,
    department      text not null check (department in ('운영부-운영1팀','운영부-운영2팀')),
    assignee_email  text not null,
    assignee_name   text not null,
    reporter_email  text not null,
    reporter_name   text not null,
    status          text not null default '미처리' check (status in ('미처리','처리중','처리완료','보류')),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
  );
  create index incidents_year_idx       on public.incidents (year desc);
  create index incidents_status_idx     on public.incidents (status);
  create index incidents_department_idx on public.incidents (department);
  create index incidents_created_at_idx on public.incidents (created_at desc);
  notify pgrst, 'reload schema';
  commit;
  ```
- **DoD**: 사용자 SQL Editor 적용 후 `select count(*) from public.incidents` → 0건. service_role select OK
- **의존**: 없음

### T2: 마이그 — RLS + GRANT (backup_requests 패턴 mirror)

- **상태**: pending
- **파일**: `supabase/migrations/20260526b_incidents_rls.sql` (신규)
- **변경**:
  ```sql
  begin;
  alter table public.incidents enable row level security;

  drop policy if exists "incidents_read_authenticated" on public.incidents;
  create policy "incidents_read_authenticated"
    on public.incidents for select to authenticated using (true);

  drop policy if exists "incidents_write_admin_member" on public.incidents;
  create policy "incidents_write_admin_member"
    on public.incidents for insert to authenticated
    with check (exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission in ('admin','member')
    ));

  drop policy if exists "incidents_update_admin_member" on public.incidents;
  create policy "incidents_update_admin_member"
    on public.incidents for update to authenticated
    using (exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission in ('admin','member')
    ));

  drop policy if exists "incidents_delete_admin" on public.incidents;
  create policy "incidents_delete_admin"
    on public.incidents for delete to authenticated
    using (exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission = 'admin'
    ));

  grant select on public.incidents to authenticated;
  grant insert, update, delete on public.incidents to authenticated;
  grant all on public.incidents to service_role;

  notify pgrst, 'reload schema';
  commit;
  ```
- **DoD**: viewer 권한 사용자로 insert 시도 → 차단. admin/member는 insert OK
- **의존**: T1

### T3: `currentAcademicYear()` 헬퍼

- **상태**: pending
- **파일**: `src/lib/datetime.ts` (확장 또는 신규 — 기존에 없으면 신규)
- **변경**:
  ```ts
  /**
   * 학년도 계산 — KST 기준, 3월 시작.
   * 예: 2025.03 ~ 2026.02 → 2026학년도
   */
  export function currentAcademicYear(now: Date = new Date()): number {
    const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const month = kst.getMonth() + 1; // 1-12
    const year = kst.getFullYear();
    return month >= 3 ? year + 1 : year;
  }
  ```
- **DoD**: vitest `datetime.test.ts`
  - `currentAcademicYear(new Date("2026-05-16T00:00:00+09:00"))` === 2027
  - `currentAcademicYear(new Date("2026-02-28T23:59:59+09:00"))` === 2026
  - `currentAcademicYear(new Date("2026-03-01T00:00:00+09:00"))` === 2027
- **의존**: 없음

### T4: schemas.ts — zod schema

- **상태**: pending
- **파일**: `src/features/incidents/schemas.ts` (신규)
- **변경**:
  ```ts
  import { z } from "zod";

  export const APP_TYPE_VALUES = ["공통원서","일반원서","공공원서"] as const;
  export const DEPARTMENT_VALUES = ["운영부-운영1팀","운영부-운영2팀"] as const;
  export const STATUS_VALUES = ["미처리","처리중","처리완료","보류"] as const;

  export const incidentRowSchema = z.object({
    id: z.string().uuid(),
    year: z.number().int().min(2000).max(3000),
    university_name: z.string().min(1),
    app_type: z.enum(APP_TYPE_VALUES),
    category: z.string().min(1),
    occurred_date: z.string().nullable().optional(),
    resolved_date: z.string().nullable().optional(),
    title: z.string().min(1),
    cause_summary: z.string().nullable().optional(),
    root_cause: z.string().nullable().optional(),
    resolution: z.string().nullable().optional(),
    prevention: z.string().nullable().optional(),
    department: z.enum(DEPARTMENT_VALUES),
    assignee_email: z.string().email(),
    assignee_name: z.string().min(1),
    reporter_email: z.string().email(),
    reporter_name: z.string().min(1),
    status: z.enum(STATUS_VALUES).default("미처리"),
    created_at: z.string(),
    updated_at: z.string(),
  });
  export type IncidentRow = z.infer<typeof incidentRowSchema>;

  export const incidentCreateSchema = z.object({
    year: z.number().int().min(2000).max(3000),
    university_name: z.string().min(1, "대학명 누락"),
    app_type: z.enum(APP_TYPE_VALUES),
    category: z.string().min(1, "카테고리 누락").max(50),
    occurred_date: z.string().min(1).nullable().optional(),
    resolved_date: z.string().min(1).nullable().optional(),
    title: z.string().min(1, "사고제목 누락").max(200),
    cause_summary: z.string().max(5000).nullable().optional(),
    root_cause: z.string().max(5000).nullable().optional(),
    resolution: z.string().max(5000).nullable().optional(),
    prevention: z.string().max(5000).nullable().optional(),
    department: z.enum(DEPARTMENT_VALUES),
    status: z.enum(STATUS_VALUES).default("미처리"),
  });
  export type IncidentCreate = z.infer<typeof incidentCreateSchema>;

  export const incidentUpdateSchema = incidentCreateSchema.partial();
  export type IncidentUpdate = z.infer<typeof incidentUpdateSchema>;
  ```
- **DoD**: `__tests__/schemas.test.ts` — enum 통과/거부, year 범위, 필수 누락 거부, default 적용
- **의존**: 없음

### T5: queries.ts — listIncidents / getIncidentById

- **상태**: pending
- **파일**: `src/features/incidents/queries.ts` (신규)
- **변경**:
  ```ts
  import "server-only";
  import { createClient } from "@/lib/supabase/server";
  import { incidentRowSchema, type IncidentRow } from "./schemas";

  type ListInput = {
    year?: number;        // undefined = 전체 학년도
    status?: string;
    department?: string;
    q?: string;           // title / university_name / cause_summary
    mine?: boolean;       // true → assignee_email 본인
    meEmail?: string;
    page?: number;
    pageSize?: number;
  };

  const DEFAULT_PAGE_SIZE = 30;

  export async function listIncidents(
    input: ListInput = {},
  ): Promise<{ rows: IncidentRow[]; total: number }> {
    const supabase = await createClient();
    let q = supabase
      .from("incidents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (input.year != null) q = q.eq("year", input.year);
    if (input.status) q = q.eq("status", input.status);
    if (input.department) q = q.eq("department", input.department);
    if (input.mine && input.meEmail) q = q.eq("assignee_email", input.meEmail);
    if (input.q) {
      const like = `%${input.q}%`;
      q = q.or(`title.ilike.${like},university_name.ilike.${like},cause_summary.ilike.${like}`);
    }

    const page = Math.max(1, input.page ?? 1);
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
    q = q.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error("[listIncidents]", error);
      return { rows: [], total: 0 };
    }
    const rows: IncidentRow[] = [];
    for (const r of data ?? []) {
      const parsed = incidentRowSchema.safeParse(r);
      if (parsed.success) rows.push(parsed.data);
      else console.error("[listIncidents] zod fail:", parsed.error.issues);
    }
    return { rows, total: count ?? 0 };
  }

  export async function getIncidentById(id: string): Promise<IncidentRow | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const parsed = incidentRowSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  }
  ```
- **DoD**: `__tests__/queries.test.ts` — mock supabase로 filter/pagination 동작 검증
- **의존**: T4

### T6: actions.ts — createIncident / updateIncident (보고자 자동)

- **상태**: pending
- **파일**: `src/features/incidents/actions.ts` (신규)
- **변경**:
  ```ts
  "use server";
  import { revalidatePath } from "next/cache";
  import { createClient } from "@/lib/supabase/server";
  import { getCurrentOperator } from "@/features/auth/queries";
  import {
    incidentCreateSchema, incidentUpdateSchema,
    type IncidentRow,
  } from "./schemas";

  const PATH = "/dashboard/incidents";
  const AUTH_ERROR = "로그인이 필요합니다.";

  // PR-6: 부서별 고정 보고자 매핑 (운영부 1팀 → 허승철 / 2팀 → 송영신)
  const REPORTER_BY_DEPARTMENT = {
    "운영부-운영1팀": { email: "alcure23@jinhakapply.com", name: "허승철" },
    "운영부-운영2팀": { email: "ys1114@jinhakapply.com", name: "송영신" },
  } as const;

  export type IncidentActionResult =
    | { ok: true; row: IncidentRow }
    | { ok: false; error: string };

  export async function createIncident(input: unknown): Promise<IncidentActionResult> {
    const me = await getCurrentOperator();
    if (!me) return { ok: false, error: AUTH_ERROR };

    const parsed = incidentCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
    }

    const reporter = REPORTER_BY_DEPARTMENT[parsed.data.department];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("incidents")
      .insert({
        ...parsed.data,
        assignee_email: me.email,
        assignee_name: me.displayName ?? me.email,
        reporter_email: reporter.email,
        reporter_name: reporter.name,
      })
      .select()
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath(PATH);
    return { ok: true, row: data as IncidentRow };
  }

  export async function updateIncident(
    id: string,
    input: unknown,
  ): Promise<IncidentActionResult> {
    const me = await getCurrentOperator();
    if (!me) return { ok: false, error: AUTH_ERROR };

    const parsed = incidentUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
    }

    const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };

    // department 변경 시 보고자 자동 재매핑
    if (parsed.data.department) {
      const reporter = REPORTER_BY_DEPARTMENT[parsed.data.department];
      patch.reporter_email = reporter.email;
      patch.reporter_name = reporter.name;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("incidents")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath(PATH);
    return { ok: true, row: data as IncidentRow };
  }
  ```
- **DoD**: `__tests__/actions.test.ts`
  - 정상 create → insert payload에 assignee_*(본인), reporter_* (department 매핑) 자동 포함
  - department='운영부-운영1팀' → reporter=허승철
  - department='운영부-운영2팀' → reporter=송영신
  - 비인증 → AUTH_ERROR
  - zod fail (필수 누락) → error message
  - update에 department 포함 시 reporter_* 재매핑
- **의존**: T4, T5

### T7: list-variant 폴더 — View / EditForm / Table / filters

- **상태**: pending
- **파일**:
  - `src/app/dashboard/_components/inspector/list-variants/incidents/View.tsx` (신규)
  - `src/app/dashboard/_components/inspector/list-variants/incidents/EditForm.tsx` (신규)
  - `src/app/dashboard/_components/inspector/list-variants/incidents/Table.tsx` (신규)
  - `src/app/dashboard/_components/inspector/list-variants/incidents/filters.ts` (신규)
- **변경**:
  - **View**: 카드 1개 = 학년도/구분/카테고리 헤더 / 사고제목 / 4 섹션(경위/원인/처리/대책) / 메타(대학교/담당부서/담당자/보고자/일자) / 상태 chip
  - **EditForm**: brainstorm UI 순서 그대로 (학년도 select / 대학명 검색 / 구분 select / 카테고리 datalist / 발생·처리일자 / 사고제목 / 4 textarea / 담당부서 select / 담당자 read-only / 보고자 표시 / 상태 select)
  - **Table**: 컬럼 — 학년도 / 상태 / 구분 / 카테고리 / 사고제목 / 대학교 / 담당자 / 발생일자. 행 클릭 onSelect
  - **filters.ts**: `INCIDENT_FILTERS = ["전체","미처리","처리중","처리완료","보류"]` + `blankIncidentRow({ currentUserName, currentUserTeam })`
- **DoD**: 각 컴포넌트 vitest — render 후 기대 라벨 존재 + 콜백 호출
- **의존**: T4

### T8: registry + types — incidents variant 등록

- **상태**: pending
- **파일**:
  - `src/app/dashboard/_components/inspector/list-variants/types.ts` (수정)
  - `src/app/dashboard/_components/inspector/list-variants/registry.ts` (수정)
- **변경**:
  - `types.ts`: Variant union에 `"incidents"` 추가
  - `registry.ts`: import 추가 후 매핑
    ```ts
    import { IncidentView } from "./incidents/View";
    import { IncidentEditForm } from "./incidents/EditForm";
    import { IncidentTable } from "./incidents/Table";
    import { INCIDENT_FILTERS, blankIncidentRow } from "./incidents/filters";

    export const REGISTRY = {
      // ... 기존
      incidents: {
        View: IncidentView,
        EditForm: IncidentEditForm,
        Table: IncidentTable,
        filters: INCIDENT_FILTERS,
        blank: blankIncidentRow,
      },
    } as const;
    ```
- **DoD**: typecheck pass + registry.test (있다면) PASS
- **의존**: T7

### T9: ListPattern.tsx — ListRow에 incident 필드 확장

- **상태**: pending
- **파일**: `src/app/dashboard/_components/patterns/ListPattern.tsx` (수정)
- **변경**: `ListRow` type에 incident 도메인 필드 추가
  ```ts
  /** incidents 도메인 — 학년도 */
  incidentYear?: number;
  /** incidents — 구분 */
  incidentAppType?: "공통원서" | "일반원서" | "공공원서";
  /** incidents — 카테고리 자유 텍스트 */
  incidentCategory?: string;
  /** incidents — 발생·처리일자 */
  incidentOccurredDate?: string | null;
  incidentResolvedDate?: string | null;
  /** incidents — 사고제목 */
  incidentTitle?: string;
  /** incidents — 본문 4섹션 */
  incidentCauseSummary?: string | null;
  incidentRootCause?: string | null;
  incidentResolution?: string | null;
  incidentPrevention?: string | null;
  /** incidents — 부서·담당자·보고자 */
  incidentDepartment?: "운영부-운영1팀" | "운영부-운영2팀";
  incidentAssigneeEmail?: string;
  incidentAssigneeName?: string;
  incidentReporterEmail?: string;
  incidentReporterName?: string;
  /** incidents — 상태 */
  incidentStatus?: "미처리" | "처리중" | "처리완료" | "보류";
  /** incidents — 대학교 (대학명 자유 텍스트) */
  incidentUniversityName?: string;
  ```
- **DoD**: typecheck pass. 기존 도메인 row 영향 X (optional만 추가)
- **의존**: T4

### T10: page.tsx — 목록 페이지

- **상태**: pending
- **파일**: `src/app/dashboard/incidents/page.tsx` (신규)
- **변경**:
  - SSR fetch (`listIncidents` 호출) — URL 파라미터(year/status/department/q/mine/page) 파싱
  - 학년도 selector (default `currentAcademicYear()`)
  - ScopeChips (전체 / 내가 담당)
  - ListSearch + ListSelect(status, department)
  - ListPattern variant="incidents" 전달
  - `incidentToListRow()` mapper로 DB row → ListRow
  - `onPersist` server action에서 isNew면 createIncident, 아니면 updateIncident
  - viewer 권한 가드: `canEdit = admin || member`
  - 메뉴 차단: `requireMenu("incidents")` (직전 패턴)
  - candidates 대학명: `listServices`로 chunk fetch (services.university_name distinct) — backup 도메인 동일
- **DoD**: typecheck pass + 로컬 `/dashboard/incidents` 진입 → 빈 목록 + "+ 사고 보고" 버튼 노출 (admin/member). 학년도 selector 노출
- **의존**: T5, T6, T7, T8, T9

### T11: menu-counts — incidents count 추가

- **상태**: pending
- **파일**: `src/features/menu-counts/queries.ts` (수정)
- **변경**: 기존 패턴 mirror
  ```ts
  // incidents (사고 보고)
  const { count: incidentsCount } = await supabase
    .from("incidents")
    .select("*", { count: "exact", head: true });
  counts.incidents = incidentsCount ?? 0;
  ```
- **DoD**: `/dashboard` 사이드바에서 "사고 보고" count 동적
- **의존**: T1 (테이블 존재)

### T12: _data.ts — 사이드바 placeholder 정리

- **상태**: pending
- **파일**: `src/app/dashboard/_data.ts` (수정 — line 86 부근)
- **변경**: incidents 메뉴 `count: "2"` → `count: ""` (menu-counts가 채움)
- **DoD**: lint pass + 사이드바 동적 count 적용 (T11 결과 반영)
- **의존**: T11

### T13: 회귀 + verify + 로컬 확인

- **상태**: pending
- **파일**: 신규 변경 없음
- **변경**: `npm run lint && npx tsc --noEmit && npm test`
- **DoD**:
  - 모든 unit PASS (incidents __tests__ 포함)
  - 0 error
  - 로컬 dev:
    - `/dashboard/incidents` 빈 목록 진입 OK
    - 신규 등록 → 보고자 자동 채움 (운영2팀이면 송영신)
    - 학년도 selector 전환 → SSR 결과 변경
    - viewer 로그인 시 "+ 사고 보고" 버튼 비활성
- **의존**: T1~T12

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| 마이그 prod 미적용 상태 머지 → 런타임 schema mismatch | PR 본문에 "SQL Editor 수동 적용 필요" 명시. 머지 직전 사용자 적용 확인 |
| KST timezone 계산 boundary (3월 1일 자정 직전·직후) | T3에 boundary 3 케이스 명시. `Asia/Seoul` 강제 |
| ListPattern variant union dispatcher의 incidents 분기 누락 | T8 registry-based dispatch라 자동 (post 도메인 같은 special case만 dispatcher 직접 분기) |
| 보고자 매핑 hardcode 운영부 외 부서 추가 시 유지보수 | YAGNI — 현재 2개 부서만. 향후 부서 확장 시 별도 메타 테이블 검토 |
| EditForm 비대 (필드 14개) | section 시각 분리. 800줄 상한 내 |
| year selector를 어디서 default 적용할지 | page.tsx URL 파라미터 미존재 시 `currentAcademicYear()` 기본 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-16T11:30:00Z | — | plan 생성 | brainstorm 20260516-110000 입력. branch `feat/incidents-domain` |
