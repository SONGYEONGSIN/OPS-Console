# 체크리스트 Plan 1 — 데이터·도메인 기반 + 관리 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원서접수 점검 체크리스트의 DB·도메인 로직·운영부(admin) 관리 UI를 구현한다 (회차 생성/복제/템플릿, 항목 관리, 부서별 공유 토큰 발급).

**Architecture:** Supabase 3테이블 + `src/features/checklist/`(schemas·queries·actions·template·completion) + 기존 `reports` 골격을 이식한 `/dashboard/checklist` 목록·상세 페이지. 공개 작성 페이지·PDF는 Plan 2·3.

**Tech Stack:** Next.js(App Router) · TypeScript · Supabase(@supabase/ssr, service_role) · zod · Vitest.

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-07-22-checklist-design.md` (verbatim 기준)
- 색상 하드코딩 금지 → Tailwind 클래스/토큰만 (`rules/design.md`)
- 부서 enum 5개 고정: `기획파트` `운영부` `고객지원팀` `개발부` `영업부`
- 상태 enum: `done` `in_progress` `todo` `na` (null=미지정)
- 토큰 kind: `dept-fill` `report`
- 커밋 메시지 conventional 한국어, 접두사 영어. 각 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 브랜치: `feat/checklist` (이미 생성됨)
- 마이그레이션은 머지 전 Supabase에 선적용 후 service_role로 검증 (프로젝트 관행)
- TDD 강제 (RED→GREEN). 순수함수·서버로직은 테스트 우선.
- `any`/`@ts-ignore`/`console.log`/하드코딩 시크릿 금지

---

## File Structure

```
supabase/migrations/2026xxxx_checklist.sql          # 3테이블 + 인덱스 + RLS + GRANT
src/features/checklist/
  schemas.ts        # zod: DEPARTMENTS, STATUSES, 항목 patch, 회차 생성 입력
  template.ts       # CHECKLIST_TEMPLATE (부서→분야→항목 기본 시드)
  completion.ts     # 완료율 순수 계산 (na 제외)
  queries.ts        # listRounds, getRoundWithItems, listTokens
  actions.ts        # createRound, cloneRound, updateItem, addItem, deleteItem, issueToken, toggleToken
  __tests__/completion.test.ts
  __tests__/schemas.test.ts
  __tests__/actions.test.ts
src/app/dashboard/_data.ts                           # 메뉴 1줄 추가
src/app/dashboard/_data/page-meta-config.ts          # checklist 메타
src/app/dashboard/checklist/
  page.tsx                                           # 회차 목록
  _components/RoundsList.tsx
  _components/NewRoundButton.tsx
  _components/NewRoundModal.tsx
  [id]/page.tsx                                      # 회차 상세
  [id]/_components/RoundDetail.tsx
  [id]/_components/ShareLinks.tsx
  [id]/_components/ItemManager.tsx
```

---

## Task 1: DB 마이그레이션 (3테이블)

**Files:**
- Create: `supabase/migrations/20260722_checklist.sql`

**Interfaces:**
- Produces: 테이블 `checklist_rounds`, `checklist_items`, `checklist_share_tokens` (컬럼은 아래 SQL 그대로)

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 원서접수 점검 체크리스트
create table if not exists checklist_rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_start date,
  period_end date,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references checklist_rounds(id) on delete cascade,
  department text not null check (department in ('기획파트','운영부','고객지원팀','개발부','영업부')),
  category text not null default '',
  title text not null,
  status text check (status in ('done','in_progress','todo','na')),
  note text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists checklist_items_round_dept_idx
  on checklist_items(round_id, department, sort_order);

create table if not exists checklist_share_tokens (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references checklist_rounds(id) on delete cascade,
  kind text not null check (kind in ('dept-fill','report')),
  department text check (department in ('기획파트','운영부','고객지원팀','개발부','영업부')),
  token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint dept_fill_requires_department
    check (kind <> 'dept-fill' or department is not null)
);
create index if not exists checklist_tokens_round_idx on checklist_share_tokens(round_id);

alter table checklist_rounds enable row level security;
alter table checklist_items enable row level security;
alter table checklist_share_tokens enable row level security;

-- 로그인 사용자 읽기 허용 (운영부 공개), 쓰기는 service_role 전용
create policy checklist_rounds_read on checklist_rounds for select using (auth.role() = 'authenticated');
create policy checklist_items_read on checklist_items for select using (auth.role() = 'authenticated');
create policy checklist_tokens_read on checklist_share_tokens for select using (auth.role() = 'authenticated');

grant select on checklist_rounds, checklist_items, checklist_share_tokens to authenticated;
grant all on checklist_rounds, checklist_items, checklist_share_tokens to service_role;
```

- [ ] **Step 2: Supabase에 선적용** — Supabase SQL editor 또는 CLI로 위 SQL 실행. 3테이블 생성 확인.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260722_checklist.sql
git commit -m "feat(checklist): DB 마이그레이션 — rounds/items/tokens 3테이블

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: zod 스키마 · 상수

**Files:**
- Create: `src/features/checklist/schemas.ts`
- Test: `src/features/checklist/__tests__/schemas.test.ts`

**Interfaces:**
- Produces: `DEPARTMENTS`, `STATUSES`, `Department`, `ItemStatus`, `itemPatchSchema`, `createRoundSchema`, 타입 `ChecklistRound`, `ChecklistItem`, `ShareToken`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/features/checklist/__tests__/schemas.test.ts
import { describe, it, expect } from "vitest";
import { DEPARTMENTS, itemPatchSchema, createRoundSchema } from "../schemas";

describe("checklist schemas", () => {
  it("부서는 5개 고정", () => {
    expect(DEPARTMENTS).toEqual(["기획파트", "운영부", "고객지원팀", "개발부", "영업부"]);
  });
  it("itemPatch: 유효 상태 통과", () => {
    expect(itemPatchSchema.safeParse({ status: "done", note: "완료" }).success).toBe(true);
  });
  it("itemPatch: 잘못된 상태 거부", () => {
    expect(itemPatchSchema.safeParse({ status: "완료" }).success).toBe(false);
  });
  it("createRound: title 필수", () => {
    expect(createRoundSchema.safeParse({ title: "", seed: "empty" }).success).toBe(false);
    expect(createRoundSchema.safeParse({ title: "2027 수시", seed: "template" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/features/checklist/__tests__/schemas.test.ts` — Expected: FAIL (모듈 없음)

- [ ] **Step 3: 스키마 구현**

```ts
// src/features/checklist/schemas.ts
import { z } from "zod";

export const DEPARTMENTS = ["기획파트", "운영부", "고객지원팀", "개발부", "영업부"] as const;
export const STATUSES = ["done", "in_progress", "todo", "na"] as const;

export type Department = (typeof DEPARTMENTS)[number];
export type ItemStatus = (typeof STATUSES)[number];

export const departmentSchema = z.enum(DEPARTMENTS);
export const statusSchema = z.enum(STATUSES);

export const itemPatchSchema = z.object({
  status: statusSchema.nullable().optional(),
  note: z.string().max(2000).optional(),
  title: z.string().min(1).max(500).optional(),
  category: z.string().max(200).optional(),
});
export type ItemPatch = z.infer<typeof itemPatchSchema>;

export const createRoundSchema = z.object({
  title: z.string().min(1).max(200),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  seed: z.enum(["template", "clone", "empty"]),
  cloneFromRoundId: z.string().uuid().optional(),
});
export type CreateRoundInput = z.infer<typeof createRoundSchema>;

export type ChecklistRound = {
  id: string;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: "draft" | "active" | "closed";
  createdBy: string | null;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  roundId: string;
  department: Department;
  category: string;
  title: string;
  status: ItemStatus | null;
  note: string;
  sortOrder: number;
};

export type ShareToken = {
  id: string;
  roundId: string;
  kind: "dept-fill" | "report";
  department: Department | null;
  token: string;
  enabled: boolean;
};
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/features/checklist/__tests__/schemas.test.ts` — Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/checklist/schemas.ts src/features/checklist/__tests__/schemas.test.ts
git commit -m "feat(checklist): zod 스키마·부서/상태 상수

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 완료율 순수 계산

**Files:**
- Create: `src/features/checklist/completion.ts`
- Test: `src/features/checklist/__tests__/completion.test.ts`

**Interfaces:**
- Consumes: `ChecklistItem` (Task 2)
- Produces: `computeCompletion(items): { total, done, inProgress, todo, na, pct }`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/features/checklist/__tests__/completion.test.ts
import { describe, it, expect } from "vitest";
import { computeCompletion } from "../completion";

const item = (status) => ({ id: "x", roundId: "r", department: "개발부", category: "", title: "t", status, note: "", sortOrder: 0 });

describe("computeCompletion", () => {
  it("na는 분모에서 제외", () => {
    const r = computeCompletion([item("done"), item("todo"), item("na")]);
    expect(r).toMatchObject({ total: 3, done: 1, na: 1 });
    expect(r.pct).toBe(50); // done 1 / (3-1 na) = 50%
  });
  it("전부 na면 pct 0", () => {
    expect(computeCompletion([item("na")]).pct).toBe(0);
  });
  it("빈 목록은 pct 0", () => {
    expect(computeCompletion([]).pct).toBe(0);
  });
  it("null 상태는 todo가 아니라 미지정으로 분모 포함, 완료 아님", () => {
    const r = computeCompletion([item("done"), item(null)]);
    expect(r.pct).toBe(50);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/features/checklist/__tests__/completion.test.ts` — Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/features/checklist/completion.ts
import type { ChecklistItem } from "./schemas";

export type Completion = {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  na: number;
  pct: number; // done / (total - na), 0~100 정수
};

export function computeCompletion(items: Pick<ChecklistItem, "status">[]): Completion {
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const todo = items.filter((i) => i.status === "todo").length;
  const na = items.filter((i) => i.status === "na").length;
  const denom = total - na;
  const pct = denom > 0 ? Math.round((done / denom) * 100) : 0;
  return { total, done, inProgress, todo, na, pct };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/features/checklist/__tests__/completion.test.ts` — Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/checklist/completion.ts src/features/checklist/__tests__/completion.test.ts
git commit -m "feat(checklist): 완료율 순수 계산 (na 제외)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 기본 템플릿 상수

**Files:**
- Create: `src/features/checklist/template.ts`

**Interfaces:**
- Consumes: `Department` (Task 2)
- Produces: `CHECKLIST_TEMPLATE: { department: Department; category: string; title: string }[]`

- [ ] **Step 1: 템플릿 작성** (엑셀 분석 기반 기본 시드 — 부서/분야/항목)

```ts
// src/features/checklist/template.ts
import type { Department } from "./schemas";

type TemplateItem = { department: Department; category: string; title: string };

export const CHECKLIST_TEMPLATE: TemplateItem[] = [
  // 기획파트
  { department: "기획파트", category: "사이트(PC/M)", title: "PC/M 광고배너 노출 상태" },
  { department: "기획파트", category: "사이트(PC/M)", title: "PC/M 주요 화면·기능 동작" },
  { department: "기획파트", category: "사이트(PC/M)", title: "M 메인 인기경쟁률 노출 로직 확인" },
  { department: "기획파트", category: "사이트(PC/M)", title: "M 대학별 프로그램 노출 로직 확인" },
  { department: "기획파트", category: "사이트(PC/M)", title: "페이지 리얼배포 여부 확인 및 오류 모니터링" },
  // 운영부
  { department: "운영부", category: "접수 서비스", title: "전체 서비스 테스트오픈 완료" },
  { department: "운영부", category: "접수 서비스", title: "접수기간 당직자 배정" },
  { department: "운영부", category: "결제사", title: "결제사 비상연락망 요청" },
  { department: "운영부", category: "결제사", title: "결제사 세팅" },
  { department: "운영부", category: "매출", title: "접수건수 예측(수시/정시)" },
  { department: "운영부", category: "정산", title: "진학캐쉬 추가 환불 일정 재경팀 협의·공유" },
  { department: "운영부", category: "대교협", title: "대교협 데이터 검증계획서 작성" },
  { department: "운영부", category: "대교협", title: "대교협 비상연락망 작성·공유" },
  { department: "운영부", category: "대교협", title: "대교협 서비스목록·대학인증서 목록 전달" },
  { department: "운영부", category: "대교협", title: "고교DB 업데이트" },
  { department: "운영부", category: "스마트경쟁률", title: "경쟁률 URL 리스트 생성·리스트업" },
  // 고객지원팀
  { department: "고객지원팀", category: "콘텐츠", title: "콘텐츠 제작·배포 관리(카드뉴스 등)" },
  { department: "고객지원팀", category: "고객센터 운영", title: "상담 인력 채용·배정" },
  { department: "고객지원팀", category: "고객센터 운영", title: "PC·상담좌석 환경 세팅" },
  { department: "고객지원팀", category: "고객센터 운영", title: "상담원 교육·계정 세팅" },
  { department: "고객지원팀", category: "고객센터 운영", title: "상위 20개 주요대학 원서 TEST" },
  // 개발부
  { department: "개발부", category: "서버/시스템", title: "원서접수 고등학교 데이터 업데이트 확인" },
  { department: "개발부", category: "서버/시스템", title: "PG 결제사 비율별 분배 후 세팅" },
  { department: "개발부", category: "서버/시스템", title: "대학교 인증서 최신 업데이트 검증" },
  { department: "개발부", category: "서버/시스템", title: "경쟁률 생성 프로세스 정상 동작 확인" },
  { department: "개발부", category: "서버/시스템", title: "웹 서버 동작 확인(PC/모바일)" },
  { department: "개발부", category: "서버/시스템", title: "운영 서버 페이지 배포 확인" },
  { department: "개발부", category: "모니터링", title: "모니터링 서버 준비 확인(Grafana)" },
  // 영업부
  { department: "영업부", category: "입학홈페이지", title: "대학 원서접수 일정정리·합격발표 페이지 업데이트" },
  { department: "영업부", category: "입학홈페이지", title: "접수준비 인트로 페이지 셋팅" },
  { department: "영업부", category: "입학홈페이지", title: "메인페이지 팝업·레이어팝업 셋팅" },
  { department: "영업부", category: "입학홈페이지", title: "메인페이지 메인 이미지 제작" },
];
```

- [ ] **Step 2: 커밋**

```bash
git add src/features/checklist/template.ts
git commit -m "feat(checklist): 기본 템플릿 상수 (엑셀 구조 기반 시드)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 조회 (queries)

**Files:**
- Create: `src/features/checklist/queries.ts`

**Interfaces:**
- Consumes: `ChecklistRound`, `ChecklistItem`, `ShareToken`, `computeCompletion`
- Produces:
  - `listRounds(): Promise<(ChecklistRound & { completion: Completion })[]>`
  - `getRoundWithItems(id): Promise<{ round: ChecklistRound; items: ChecklistItem[] } | null>`
  - `listTokens(roundId): Promise<ShareToken[]>`
  - `getRoundByToken(token): Promise<{ token: ShareToken; round: ChecklistRound; items: ChecklistItem[] } | null>` (Plan 2에서 사용)

- [ ] **Step 1: 구현** (server-only, admin supabase 클라이언트 사용 — 기존 `src/lib/supabase/server.ts` 패턴 확인 후 동일 사용)

```ts
// src/features/checklist/queries.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCompletion, type Completion } from "./completion";
import type { ChecklistRound, ChecklistItem, ShareToken } from "./schemas";

function mapRound(r: Record<string, unknown>): ChecklistRound {
  return {
    id: r.id as string, title: r.title as string,
    periodStart: (r.period_start as string) ?? null, periodEnd: (r.period_end as string) ?? null,
    status: r.status as ChecklistRound["status"],
    createdBy: (r.created_by as string) ?? null, createdAt: r.created_at as string,
  };
}
function mapItem(r: Record<string, unknown>): ChecklistItem {
  return {
    id: r.id as string, roundId: r.round_id as string,
    department: r.department as ChecklistItem["department"],
    category: (r.category as string) ?? "", title: r.title as string,
    status: (r.status as ChecklistItem["status"]) ?? null,
    note: (r.note as string) ?? "", sortOrder: (r.sort_order as number) ?? 0,
  };
}

export async function listRounds(): Promise<(ChecklistRound & { completion: Completion })[]> {
  const sb = await createClient();
  const { data: rounds, error } = await sb.from("checklist_rounds").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`listRounds: ${error.message}`);
  const { data: items } = await sb.from("checklist_items").select("round_id,status");
  return (rounds ?? []).map((r) => {
    const its = (items ?? []).filter((i) => i.round_id === r.id).map((i) => ({ status: i.status as ChecklistItem["status"] }));
    return { ...mapRound(r), completion: computeCompletion(its) };
  });
}

export async function getRoundWithItems(id: string) {
  const sb = await createClient();
  const { data: round } = await sb.from("checklist_rounds").select("*").eq("id", id).maybeSingle();
  if (!round) return null;
  const { data: items } = await sb.from("checklist_items").select("*").eq("round_id", id)
    .order("department").order("sort_order");
  return { round: mapRound(round), items: (items ?? []).map(mapItem) };
}

export async function listTokens(roundId: string): Promise<ShareToken[]> {
  const sb = await createClient();
  const { data } = await sb.from("checklist_share_tokens").select("*").eq("round_id", roundId).order("kind");
  return (data ?? []).map((t) => ({
    id: t.id, roundId: t.round_id, kind: t.kind, department: t.department ?? null, token: t.token, enabled: t.enabled,
  }));
}
```

- [ ] **Step 2: 타입 체크** — Run: `npx next typegen && npx tsc --noEmit` — Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add src/features/checklist/queries.ts
git commit -m "feat(checklist): 조회 쿼리 (회차 목록·상세·토큰)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 서버 액션 (회차/항목/토큰)

**Files:**
- Create: `src/features/checklist/actions.ts`
- Test: `src/features/checklist/__tests__/actions.test.ts` (순수 헬퍼 `buildSeedItems` 대상)

**Interfaces:**
- Consumes: `createRoundSchema`, `itemPatchSchema`, `CHECKLIST_TEMPLATE`
- Produces (server actions): `createRoundAction`, `updateItemAction`, `addItemAction`, `deleteItemAction`, `issueTokenAction`, `toggleTokenAction`; 순수 헬퍼 `buildSeedItems(seed, template, clonedItems)`

- [ ] **Step 1: 순수 헬퍼 실패 테스트**

```ts
// src/features/checklist/__tests__/actions.test.ts
import { describe, it, expect } from "vitest";
import { buildSeedItems } from "../actions";
import { CHECKLIST_TEMPLATE } from "../template";

describe("buildSeedItems", () => {
  it("template 시드는 템플릿 개수만큼, 상태/메모 비움", () => {
    const rows = buildSeedItems("template", CHECKLIST_TEMPLATE, []);
    expect(rows.length).toBe(CHECKLIST_TEMPLATE.length);
    expect(rows[0]).toMatchObject({ status: null, note: "" });
    expect(rows[0].department).toBe(CHECKLIST_TEMPLATE[0].department);
  });
  it("clone 시드는 복제 항목의 부서/분야/항목 유지 + 상태/메모 초기화", () => {
    const cloned = [{ department: "개발부", category: "서버/시스템", title: "X", status: "done", note: "완료", sortOrder: 3 }];
    const rows = buildSeedItems("clone", CHECKLIST_TEMPLATE, cloned);
    expect(rows).toEqual([{ department: "개발부", category: "서버/시스템", title: "X", status: null, note: "", sortOrder: 3 }]);
  });
  it("empty 시드는 빈 배열", () => {
    expect(buildSeedItems("empty", CHECKLIST_TEMPLATE, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/features/checklist/__tests__/actions.test.ts` — Expected: FAIL

- [ ] **Step 3: 구현** (server actions + export된 순수 헬퍼)

```ts
// src/features/checklist/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/features/auth/menu-guard"; // 기존 admin 가드 확인 후 사용
import { createRoundSchema, itemPatchSchema, type Department } from "./schemas";
import { CHECKLIST_TEMPLATE } from "./template";
import type { ChecklistItem } from "./schemas";

type SeedRow = { department: Department; category: string; title: string; status: null; note: string; sortOrder: number };

// 순수: 시드 방식별 삽입할 items 행 생성
export function buildSeedItems(
  seed: "template" | "clone" | "empty",
  template: { department: Department; category: string; title: string }[],
  clonedItems: Pick<ChecklistItem, "department" | "category" | "title" | "sortOrder">[],
): SeedRow[] {
  if (seed === "empty") return [];
  if (seed === "clone")
    return clonedItems.map((i) => ({ department: i.department, category: i.category, title: i.title, status: null, note: "", sortOrder: i.sortOrder }));
  return template.map((t, idx) => ({ department: t.department, category: t.category, title: t.title, status: null, note: "", sortOrder: idx }));
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createRoundAction(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = createRoundSchema.safeParse({
    title: formData.get("title"),
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
    seed: formData.get("seed"),
    cloneFromRoundId: formData.get("cloneFromRoundId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { data: round, error } = await sb.from("checklist_rounds")
    .insert({ title: parsed.data.title, period_start: parsed.data.periodStart ?? null, period_end: parsed.data.periodEnd ?? null, created_by: me.email })
    .select("id").single();
  if (error || !round) return { ok: false, error: error?.message ?? "생성 실패" };

  let cloned: SeedRow["department"] extends never ? never : { department: Department; category: string; title: string; sortOrder: number }[] = [];
  if (parsed.data.seed === "clone" && parsed.data.cloneFromRoundId) {
    const { data } = await sb.from("checklist_items").select("department,category,title,sort_order").eq("round_id", parsed.data.cloneFromRoundId);
    cloned = (data ?? []).map((i) => ({ department: i.department as Department, category: i.category, title: i.title, sortOrder: i.sort_order }));
  }
  const rows = buildSeedItems(parsed.data.seed, CHECKLIST_TEMPLATE, cloned).map((r) => ({
    round_id: round.id, department: r.department, category: r.category, title: r.title, status: r.status, note: r.note, sort_order: r.sortOrder,
  }));
  if (rows.length) await sb.from("checklist_items").insert(rows);
  revalidatePath("/dashboard/checklist");
  return { ok: true, id: round.id };
}

export async function updateItemAction(itemId: string, patch: unknown) {
  await requireAdmin();
  const parsed = itemPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { error } = await sb.from("checklist_items")
    .update({ ...toDbPatch(parsed.data), updated_at: new Date().toISOString() }).eq("id", itemId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

function toDbPatch(p: { status?: string | null; note?: string; title?: string; category?: string }) {
  const out: Record<string, unknown> = {};
  if ("status" in p) out.status = p.status ?? null;
  if (p.note !== undefined) out.note = p.note;
  if (p.title !== undefined) out.title = p.title;
  if (p.category !== undefined) out.category = p.category;
  return out;
}

export async function addItemAction(roundId: string, department: Department, category: string) {
  await requireAdmin();
  const sb = createAdminClient();
  const { data } = await sb.from("checklist_items").insert({ round_id: roundId, department, category, title: "새 항목", sort_order: 999 }).select("id").single();
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true, id: data?.id };
}

export async function deleteItemAction(itemId: string, roundId: string) {
  await requireAdmin();
  const sb = createAdminClient();
  await sb.from("checklist_items").delete().eq("id", itemId);
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true };
}

export async function issueTokenAction(roundId: string, kind: "dept-fill" | "report", department: Department | null) {
  await requireAdmin();
  const sb = createAdminClient();
  const { data } = await sb.from("checklist_share_tokens")
    .insert({ round_id: roundId, kind, department, token: newToken() }).select("token").single();
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true, token: data?.token };
}

export async function toggleTokenAction(tokenId: string, roundId: string, enabled: boolean) {
  await requireAdmin();
  const sb = createAdminClient();
  await sb.from("checklist_share_tokens").update({ enabled }).eq("id", tokenId);
  revalidatePath(`/dashboard/checklist/${roundId}`);
  return { ok: true };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/features/checklist/__tests__/actions.test.ts` — Expected: PASS. 그리고 `requireAdmin`/`createAdminClient` 실제 export명은 기존 코드에서 확인 후 맞춘다 (`src/features/auth/menu-guard.ts`, `src/lib/supabase/admin.ts`). 존재하지 않으면 기존 admin 가드 패턴에 맞춰 조정.

- [ ] **Step 5: 커밋**

```bash
git add src/features/checklist/actions.ts src/features/checklist/__tests__/actions.test.ts
git commit -m "feat(checklist): 회차/항목/토큰 서버 액션 + 시드 헬퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 메뉴 · 페이지 메타

**Files:**
- Modify: `src/app/dashboard/_data.ts:319-326` (분석 & 보고 group items)
- Modify: `src/app/dashboard/_data/page-meta-config.ts` (checklist 메타 추가)

**Interfaces:**
- Produces: 사이드바 'checklist' 항목, `resolvePageMeta("checklist", …)` 동작

- [ ] **Step 1: 메뉴 항목 추가** — `운영리포트`(reports) 항목 뒤에 삽입:

```ts
{
  ico: "·",
  label: "체크리스트",
  count: "",
  slug: "checklist",
  pattern: "list",
},
```

- [ ] **Step 2: page-meta 추가** — `page-meta-config.ts`의 config 객체에 (reports 항목과 동일 형태):

```ts
checklist: {
  headline: { accent: "분석 · 보고", title: "원서접수 점검" },
  description:
    "회차별 원서접수 점검 체크리스트 — 부서별 링크 작성·자동저장, 임원 보고·PDF.",
},
```

(정확한 키/필드는 `reports` 항목을 그대로 복사해 맞춘다.)

- [ ] **Step 3: 렌더 확인** — Run: `npm run dev` 상태에서 `/dashboard` 사이드바에 '체크리스트' 노출, 클릭 시 `/dashboard/checklist` (아직 404/빈 페이지면 다음 Task에서 생성). 타입: `npx tsc --noEmit` 0 errors.

- [ ] **Step 4: 커밋**

```bash
git add src/app/dashboard/_data.ts src/app/dashboard/_data/page-meta-config.ts
git commit -m "feat(checklist): 사이드바 메뉴·페이지 메타 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 회차 목록 페이지

**Files:**
- Create: `src/app/dashboard/checklist/page.tsx`
- Create: `src/app/dashboard/checklist/_components/RoundsList.tsx`
- Create: `src/app/dashboard/checklist/_components/NewRoundButton.tsx`
- Create: `src/app/dashboard/checklist/_components/NewRoundModal.tsx`

**Interfaces:**
- Consumes: `listRounds` (Task 5), `createRoundAction` (Task 6), `findSidebarMeta`/`resolvePageMeta`/`PageHeader`/`requireMenu` (기존 reports/page.tsx와 동일)

- [ ] **Step 1: 목록 페이지** (reports/page.tsx 골격 이식)

```tsx
// src/app/dashboard/checklist/page.tsx
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listRounds } from "@/features/checklist/queries";
import { RoundsList } from "./_components/RoundsList";
import { NewRoundButton } from "./_components/NewRoundButton";

export default async function ChecklistPage() {
  const slug = "checklist";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const rounds = await listRounds();
  const config = resolvePageMeta(slug, meta);

  return (
    <div className="flex flex-col">
      <PageHeader pathname={`/dashboard/${slug}`} meta={config.meta} headline={config.headline} description={config.description} />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{meta.label}</h2>
          <NewRoundButton rounds={rounds.map((r) => ({ id: r.id, title: r.title }))} />
        </header>
        <RoundsList rounds={rounds} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: RoundsList** (회차 카드, ReportsList 골격 — 플랫 카드 + 완료율 바)

```tsx
// src/app/dashboard/checklist/_components/RoundsList.tsx
import Link from "next/link";
import type { ChecklistRound } from "@/features/checklist/schemas";
import type { Completion } from "@/features/checklist/completion";

export function RoundsList({ rounds }: { rounds: (ChecklistRound & { completion: Completion })[] }) {
  if (rounds.length === 0)
    return <div className="border border-line-soft bg-situation-bg p-8 text-center text-sm text-muted">회차가 없습니다. 우측 상단에서 새 회차를 만드세요.</div>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rounds.map((r) => (
        <li key={r.id}>
          <Link href={`/dashboard/checklist/${r.id}`} className="block border border-line-soft bg-situation-bg p-4 hover:border-vermilion">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">{r.title}</span>
              <span className="text-xs text-muted">{r.completion.done}/{r.completion.total} · {r.completion.pct}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line-soft">
              <span className="block h-full bg-vermilion" style={{ width: `${r.completion.pct}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted">{r.periodStart ?? "-"} ~ {r.periodEnd ?? "-"}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

> 참고: `style={{ width }}` 동적 폭은 인라인 스타일 예외(값이 런타임 계산). 색은 토큰 클래스 사용.

- [ ] **Step 3: NewRoundButton + NewRoundModal** (client) — `useActionState(createRoundAction)` + seed 라디오(template/clone/empty) + clone 선택 시 회차 드롭다운. `reports/_components/NewReportButton.tsx`·`NewReportModal.tsx` 골격을 그대로 이식하여 필드만 교체.

```tsx
// src/app/dashboard/checklist/_components/NewRoundButton.tsx
"use client";
import { useState } from "react";
import { NewRoundModal } from "./NewRoundModal";

export function NewRoundButton({ rounds }: { rounds: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream hover:opacity-90">
        새 회차
      </button>
      {open ? <NewRoundModal rounds={rounds} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
```

```tsx
// src/app/dashboard/checklist/_components/NewRoundModal.tsx
"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createRoundAction } from "@/features/checklist/actions";

export function NewRoundModal({ rounds, onClose }: { rounds: { id: string; title: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const r = await createRoundAction(prev, fd);
      if (r.ok && r.id) { onClose(); router.push(`/dashboard/checklist/${r.id}`); }
      return r;
    },
    null,
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <form action={action} onClick={(e) => e.stopPropagation()} className="w-full max-w-md border border-line bg-paper p-5">
        <h3 className="text-lg font-bold text-ink">새 회차</h3>
        <label className="mt-3 block text-sm">제목
          <input name="title" required placeholder="2027학년도 수시모집" className="mt-1 w-full border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <label>점검 시작<input name="periodStart" type="date" className="mt-1 w-full border border-line-soft bg-field-bg px-2 py-1.5" /></label>
          <label>점검 종료<input name="periodEnd" type="date" className="mt-1 w-full border border-line-soft bg-field-bg px-2 py-1.5" /></label>
        </div>
        <fieldset className="mt-3 text-sm">
          <legend className="text-muted">시작 방식</legend>
          <label className="mr-3"><input type="radio" name="seed" value="template" defaultChecked /> 기본 템플릿</label>
          <label className="mr-3"><input type="radio" name="seed" value="clone" /> 이전 회차 복제</label>
          <label><input type="radio" name="seed" value="empty" /> 빈 회차</label>
        </fieldset>
        <select name="cloneFromRoundId" className="mt-2 w-full border border-line-soft bg-field-bg px-2 py-1.5 text-sm">
          <option value="">복제할 회차 선택</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        {state && !state.ok ? <p className="mt-2 text-sm text-vermilion">{state.error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="border border-line px-3 py-1.5 text-sm">취소</button>
          <button disabled={pending} className="border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream disabled:opacity-50">만들기</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 확인** — `npx tsc --noEmit` 0 errors, `npm run dev`에서 `/dashboard/checklist` 목록·새 회차 생성 동작(템플릿 시드 → 상세로 이동). 최소 1개 회차 생성해 items 시딩 검증.

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/checklist/page.tsx src/app/dashboard/checklist/_components/
git commit -m "feat(checklist): 회차 목록 페이지 + 새 회차 생성 모달

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 회차 상세 (관리) 페이지

**Files:**
- Create: `src/app/dashboard/checklist/[id]/page.tsx`
- Create: `src/app/dashboard/checklist/[id]/_components/RoundDetail.tsx`
- Create: `src/app/dashboard/checklist/[id]/_components/ShareLinks.tsx`
- Create: `src/app/dashboard/checklist/[id]/_components/ItemManager.tsx`

**Interfaces:**
- Consumes: `getRoundWithItems`, `listTokens` (Task 5), `issueTokenAction`/`toggleTokenAction`/`updateItemAction`/`addItemAction`/`deleteItemAction` (Task 6), `computeCompletion`
- Produces: 관리 화면 (전체 부서 현황 + 부서별 링크 발급/토글 + 항목 편집)

- [ ] **Step 1: 상세 페이지** (ReportDetail 골격)

```tsx
// src/app/dashboard/checklist/[id]/page.tsx
import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { getRoundWithItems, listTokens } from "@/features/checklist/queries";
import { RoundDetail } from "./_components/RoundDetail";

export default async function ChecklistRoundPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMenu("checklist");
  const { id } = await params;
  const data = await getRoundWithItems(id);
  if (!data) notFound();
  const tokens = await listTokens(id);
  return (
    <div className="p-5 md:p-6 lg:p-7">
      <RoundDetail round={data.round} items={data.items} tokens={tokens} />
    </div>
  );
}
```

- [ ] **Step 2: RoundDetail** — 헤더(제목·기간·생성자) + 액션(ShareLinks·PDF 링크 자리) + 요약 KPI(computeCompletion) + 부서별 ItemManager. (report-view 목업 레이아웃을 tsx로.)

```tsx
// src/app/dashboard/checklist/[id]/_components/RoundDetail.tsx
import type { ChecklistRound, ChecklistItem, ShareToken } from "@/features/checklist/schemas";
import { computeCompletion } from "@/features/checklist/completion";
import { DEPARTMENTS } from "@/features/checklist/schemas";
import { ShareLinks } from "./ShareLinks";
import { ItemManager } from "./ItemManager";

export function RoundDetail({ round, items, tokens }: { round: ChecklistRound; items: ChecklistItem[]; tokens: ShareToken[] }) {
  const all = computeCompletion(items);
  return (
    <article className="flex flex-col gap-6">
      <header className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">[운영부 상황실] · 원서접수 점검사항 체크리스트</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{round.title}</h1>
        <p className="mt-2 text-sm text-muted">{round.periodStart ?? "-"} ~ {round.periodEnd ?? "-"} · {round.createdBy ?? ""}</p>
      </header>

      <ShareLinks roundId={round.id} tokens={tokens} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["전체 항목", all.total], ["완료", all.done], ["진행중", all.inProgress], ["작업전", all.todo]].map(([label, n]) => (
          <div key={label as string} className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4">
            <span className="text-xs font-medium text-muted">{label}</span>
            <span className="text-2xl font-bold text-ink">{n}</span>
          </div>
        ))}
      </div>

      {DEPARTMENTS.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        if (deptItems.length === 0) return null;
        return <ItemManager key={dept} roundId={round.id} department={dept} items={deptItems} />;
      })}
    </article>
  );
}
```

- [ ] **Step 3: ShareLinks** (client) — 부서별 dept-fill 링크 + report 링크 발급/복사/토글. `issueTokenAction`/`toggleTokenAction` 사용. 링크 URL = `${location.origin}/r/checklist/${token}`.

```tsx
// src/app/dashboard/checklist/[id]/_components/ShareLinks.tsx
"use client";
import { useState } from "react";
import { DEPARTMENTS, type ShareToken } from "@/features/checklist/schemas";
import { issueTokenAction, toggleTokenAction } from "@/features/checklist/actions";

export function ShareLinks({ roundId, tokens }: { roundId: string; tokens: ShareToken[] }) {
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const report = tokens.find((t) => t.kind === "report");
  const deptToken = (d: string) => tokens.find((t) => t.kind === "dept-fill" && t.department === d);
  const copy = (tok: string) => navigator.clipboard.writeText(`${origin}/r/checklist/${tok}`);
  const issue = async (kind: "dept-fill" | "report", dept: string | null) => { setBusy(true); await issueTokenAction(roundId, kind, dept as never); setBusy(false); };

  return (
    <section className="border border-line-soft bg-situation-bg p-4">
      <h3 className="text-sm font-bold text-ink">공유 링크</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEPARTMENTS.map((d) => {
          const t = deptToken(d);
          return (
            <div key={d} className="flex items-center gap-1 border border-line px-2 py-1 text-xs">
              <span className="font-medium">{d}</span>
              {t ? (
                <>
                  <button onClick={() => copy(t.token)} className="text-vermilion">링크 복사</button>
                  <button onClick={() => toggleTokenAction(t.id, roundId, !t.enabled)} className="text-muted">{t.enabled ? "비활성" : "활성"}</button>
                </>
              ) : (
                <button disabled={busy} onClick={() => issue("dept-fill", d)} className="text-vermilion">발급</button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs">
        임원 보고 링크: {report ? <button onClick={() => copy(report.token)} className="text-vermilion">복사</button> : <button disabled={busy} onClick={() => issue("report", null)} className="text-vermilion">발급</button>}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: ItemManager** (client) — 부서 섹션: 분야별 그룹 + 항목 행(제목·상태칩·메모·삭제) + 항목 추가. admin은 `updateItemAction`/`addItemAction`/`deleteItemAction` 사용. (부서 작성 폼과 UI 유사하지만 admin은 전 부서 편집; 공개 fill은 Plan 2.)

```tsx
// src/app/dashboard/checklist/[id]/_components/ItemManager.tsx
"use client";
import { useState } from "react";
import type { ChecklistItem, ItemStatus } from "@/features/checklist/schemas";
import { updateItemAction, addItemAction, deleteItemAction } from "@/features/checklist/actions";
import { STATUSES } from "@/features/checklist/schemas";

const LABEL: Record<ItemStatus, string> = { done: "완료", in_progress: "진행중", todo: "작업전", na: "해당없음" };

export function ItemManager({ roundId, department, items }: { roundId: string; department: string; items: ChecklistItem[] }) {
  const cats = Array.from(new Set(items.map((i) => i.category)));
  return (
    <section>
      <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold text-ink">{department}</h2>
      {cats.map((cat) => (
        <div key={cat} className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{cat || "(분야 없음)"}</p>
          {items.filter((i) => i.category === cat).map((i) => <Row key={i.id} roundId={roundId} item={i} />)}
          <button onClick={() => addItemAction(roundId, department as never, cat)} className="mt-1 text-xs text-vermilion">＋ 항목 추가</button>
        </div>
      ))}
    </section>
  );
}

function Row({ roundId, item }: { roundId: string; item: ChecklistItem }) {
  const [status, setStatus] = useState<ItemStatus | null>(item.status);
  const [note, setNote] = useState(item.note);
  return (
    <div className="mb-[-1px] grid grid-cols-[1fr_auto] items-start gap-3 border border-line-soft bg-situation-bg p-3">
      <div>
        <div className="text-sm">{item.title}</div>
        <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => updateItemAction(item.id, { note })}
          placeholder="메모" className="mt-1 w-full border border-line-soft bg-field-bg px-2 py-1 text-xs focus:border-ink focus:bg-white" />
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setStatus(s); updateItemAction(item.id, { status: s }); }}
            className={`border px-2 py-1 text-xs ${status === s ? "border-vermilion bg-vermilion/10 text-vermilion" : "border-line text-muted hover:bg-line-soft"}`}>
            {LABEL[s]}
          </button>
        ))}
        <button onClick={() => deleteItemAction(item.id, roundId)} className="px-1 text-xs text-muted">삭제</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 확인** — `npx tsc --noEmit` 0 errors, `npm run dev`에서 상세 페이지: 요약 KPI·부서별 항목 편집(상태칩/메모/추가/삭제 저장)·부서별 링크 발급·복사 동작. `npm run lint` 0 경고.

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/checklist/[id]/
git commit -m "feat(checklist): 회차 상세 관리 페이지 (현황·항목편집·부서 링크 발급)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 결과

- **Spec 커버리지**: §4 메뉴(T7) · §5 라우트 목록/상세(T8·T9), 공개/PDF는 Plan 2·3 · §6 DB(T1) · §7 상태(T2·T3) · §9 회차생성/템플릿/복제(T4·T6·T8) · §11 컴포넌트(T8·T9). 자동저장(§8)·토큰 스코프 쓰기·공개 페이지는 **Plan 2**, PDF(§10)는 **Plan 3**.
- **Placeholder**: 없음 (모든 step 실제 코드/명령).
- **타입 일관성**: `computeCompletion`·`buildSeedItems`·액션명·`DEPARTMENTS`/`STATUSES` 전 Task 일치.
- **의존 확인 필요(구현 시)**: `requireMenu`/`requireAdmin`(`src/features/auth/menu-guard.ts`), `createClient`(`src/lib/supabase/server.ts`), `createAdminClient`(`src/lib/supabase/admin.ts`), `PageHeader`/`resolvePageMeta`/`findSidebarMeta` — 실제 export명은 기존 `reports/page.tsx` import를 그대로 따를 것.
