# 견적서 목록 (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바 '자료 보관' 그룹에 견적서(slug `quotes`) 메뉴를 추가하고, 견적서를 목록으로 관리(생성·편집·삭제·상태필터)하는 표준 list 도메인을 구현한다.

**Architecture:** `incidents` 편집 list 도메인과 동형. `quotes` 테이블 + `features/quotes/`(schemas/queries/actions) + `list-variants/quotes/`(View/EditForm/Table/filters) + `/dashboard/quotes/` 페이지. 인스펙터 EditForm `onSave` → server action. 도메인 상태(draft/sent/won/lost)는 `quoteStatus` 필드, ListRow.status는 행 틴트용 generic 매핑.

**Tech Stack:** Next.js App Router(RSC + Server Actions), Supabase(createClient + RLS), zod, Vitest, Tailwind. 기존 list-variants 오픈/클로즈드 아키텍처 확장.

## Global Constraints

- 표준 list+인스펙터 패턴 준수(`standard-list-inspector-design`): ListPattern + controlsRow + ScopeChips + Section View. 커스텀 UI 금지.
- 쓰기는 server action(`"use server"`, `createClient` — RLS 적용). RLS: read authenticated 전원 / insert·update admin·member / delete admin (incidents 동일).
- 상태 값 = `draft`(작성중)·`sent`(발송)·`won`(수주)·`lost`(실주). 라벨은 한국어.
- 하드코딩 색상 금지(토큰/Tailwind), `any` 금지, 미사용 import 금지. zod 에러는 `parsed.error.issues[0].message`.
- 금액(amount)은 Phase 1 수동 입력(bigint, KRW). 천단위 콤마 표시.
- 마이그 SQL 작성까지만(적용은 컨트롤러). 한국어 conventional commit.

---

## File Structure

- `supabase/migrations/20260624c_quotes.sql` (create) — 테이블
- `supabase/migrations/20260624d_quotes_rls.sql` (create) — RLS + GRANT
- `src/features/quotes/schemas.ts` (create) — zod 스키마/타입
- `src/features/quotes/queries.ts` (create) — `listQuotes`
- `src/features/quotes/actions.ts` (create) — create/update/delete
- `src/features/quotes/__tests__/quotes.test.ts` (create)
- `src/app/dashboard/_components/patterns/ListPattern.tsx` (modify) — ListRow에 `quote*` 필드
- `src/app/dashboard/_components/inspector/list-variants/types.ts` (modify) — Variant union `| "quotes"`
- `src/app/dashboard/_components/inspector/list-variants/quotes/{View,EditForm,Table,filters}.tsx|ts` (create)
- `src/app/dashboard/_components/inspector/list-variants/registry.ts` (modify) — quotes 매핑
- `src/app/dashboard/quotes/page.tsx` (create) + `_row-mapper.ts` (create)
- `src/app/dashboard/_data.ts` (modify) — 메뉴 1줄
- `src/features/menu-counts/queries.ts` (modify) — quotes count

---

## Task 1: 마이그레이션 — quotes 테이블 + RLS

**Files:**
- Create: `supabase/migrations/20260624c_quotes.sql`
- Create: `supabase/migrations/20260624d_quotes_rls.sql`

**Interfaces:**
- Produces: `public.quotes` 테이블(컬럼 id/customer/quote_date/valid_until/amount/owner_email/status/note/created_at/updated_at) + RLS.

- [ ] **Step 1: 테이블 마이그 작성**

`supabase/migrations/20260624c_quotes.sql`:
```sql
-- 견적서 (자료 보관 > 견적서) Phase 1 — 목록 관리
begin;

create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  customer    text not null,
  quote_date  date not null,
  valid_until date,
  amount      bigint,
  owner_email text,
  status      text not null default 'draft',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists quotes_quote_date_idx
  on public.quotes (quote_date desc);

commit;
```

- [ ] **Step 2: RLS + GRANT 마이그 작성** (기존 `*incidents*rls*` 마이그의 정책 형태를 Read해 동일 패턴으로)

`supabase/migrations/20260624d_quotes_rls.sql`:
```sql
-- quotes RLS — read 전원 / insert·update admin·member / delete admin
begin;

alter table public.quotes enable row level security;

drop policy if exists "quotes_read_authenticated" on public.quotes;
create policy "quotes_read_authenticated"
  on public.quotes for select to authenticated using (true);

drop policy if exists "quotes_write_admin_member" on public.quotes;
create policy "quotes_write_admin_member"
  on public.quotes for insert to authenticated
  with check (
    exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.permission in ('admin', 'member')
    )
  );

drop policy if exists "quotes_update_admin_member" on public.quotes;
create policy "quotes_update_admin_member"
  on public.quotes for update to authenticated
  using (
    exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.permission in ('admin', 'member')
    )
  );

drop policy if exists "quotes_delete_admin" on public.quotes;
create policy "quotes_delete_admin"
  on public.quotes for delete to authenticated
  using (
    exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.permission = 'admin'
    )
  );

grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;

commit;

notify pgrst, 'reload schema';
```
**중요**: 작성 전 실제 incidents RLS 마이그(`supabase/migrations/*incidents*rls*.sql`)를 Read해 operators 권한 체크 표현식(컬럼명·`auth.jwt()` 사용)이 위와 일치하는지 확인하고, 다르면 incidents 형태에 맞춘다. (operators 권한 컬럼이 `permission`이 아니거나 jwt 클레임이 다르면 그쪽을 따른다.)

- [ ] **Step 3: 적용은 컨트롤러 인계** (파일 작성만)

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260624c_quotes.sql supabase/migrations/20260624d_quotes_rls.sql
git commit -m "feat(quotes): 견적서 테이블 + RLS 마이그레이션"
```

---

## Task 2: features/quotes — 스키마 + 쿼리 + 액션

**Files:**
- Create: `src/features/quotes/schemas.ts`
- Create: `src/features/quotes/queries.ts`
- Create: `src/features/quotes/actions.ts`
- Test: `src/features/quotes/__tests__/quotes.test.ts`

**Interfaces:**
- Produces:
  - `quoteStatusSchema = z.enum(["draft","sent","won","lost"])`, `QuoteStatus`
  - `quoteRowSchema`, `QuoteRow`
  - `listQuotes(input: { page?: number; pageSize?: number; status?: QuoteStatus; search?: string }): Promise<{ rows: QuoteRow[]; total: number }>`
  - `createQuote(input)/updateQuote(id, input)/deleteQuote(id): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: schemas.ts**

`src/features/quotes/schemas.ts`:
```ts
import { z } from "zod";

export const QUOTE_STATUS_VALUES = ["draft", "sent", "won", "lost"] as const;
export const quoteStatusSchema = z.enum(QUOTE_STATUS_VALUES);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "작성중",
  sent: "발송",
  won: "수주",
  lost: "실주",
};

export const quoteRowSchema = z.object({
  id: z.string().uuid(),
  customer: z.string().min(1),
  quote_date: z.string(), // date (YYYY-MM-DD)
  valid_until: z.string().nullable().optional(),
  amount: z.number().int().nullable().optional(),
  owner_email: z.string().nullable().optional(),
  status: quoteStatusSchema,
  note: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type QuoteRow = z.infer<typeof quoteRowSchema>;

/** create/update 입력 — id/타임스탬프 제외. */
export const quoteInputSchema = z.object({
  customer: z.string().min(1, "고객/거래처명을 입력하세요."),
  quote_date: z.string().min(1, "견적일자를 입력하세요."),
  valid_until: z.string().nullable().optional(),
  amount: z.number().int().nonnegative().nullable().optional(),
  owner_email: z.string().nullable().optional(),
  status: quoteStatusSchema,
  note: z.string().nullable().optional(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;
```

- [ ] **Step 2: RED 테스트** (순수 검증 가능한 부분)

`src/features/quotes/__tests__/quotes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { quoteInputSchema, quoteStatusSchema, QUOTE_STATUS_LABEL } from "../schemas";

describe("quoteStatusSchema", () => {
  it("유효 상태 통과 / 무효 거부", () => {
    expect(quoteStatusSchema.safeParse("won").success).toBe(true);
    expect(quoteStatusSchema.safeParse("xxx").success).toBe(false);
  });
});

describe("quoteInputSchema", () => {
  it("customer 빈 값 거부 (issues[0].message)", () => {
    const r = quoteInputSchema.safeParse({
      customer: "",
      quote_date: "2026-06-24",
      status: "draft",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain("고객");
  });
  it("정상 입력 통과", () => {
    const r = quoteInputSchema.safeParse({
      customer: "가천대",
      quote_date: "2026-06-24",
      amount: 1000000,
      status: "sent",
      valid_until: null,
      note: null,
      owner_email: "ys1114@jinhakapply.com",
    });
    expect(r.success).toBe(true);
  });
});

describe("QUOTE_STATUS_LABEL", () => {
  it("4 상태 한국어 라벨", () => {
    expect(QUOTE_STATUS_LABEL.draft).toBe("작성중");
    expect(QUOTE_STATUS_LABEL.lost).toBe("실주");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/features/quotes/__tests__/quotes.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: queries.ts** (news `listNews` + incidents `listIncidents` 패턴 — Read 후 동형 작성)

`src/features/quotes/queries.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { quoteRowSchema, type QuoteRow, type QuoteStatus } from "./schemas";

/** 견적서 목록 — quote_date desc, status eq 필터, customer ilike 검색, range 페이지네이션. */
export async function listQuotes(
  input: {
    page?: number;
    pageSize?: number;
    status?: QuoteStatus;
    search?: string;
  } = {},
): Promise<{ rows: QuoteRow[]; total: number }> {
  const page = input.page && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : 30;
  const search = input.search?.trim();

  const supabase = await createClient();
  let q = supabase.from("quotes").select("*", { count: "exact" });
  if (input.status) q = q.eq("status", input.status);
  if (search) q = q.ilike("customer", `%${search}%`);
  const { data, count, error } = await q
    .order("quote_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    console.error("[listQuotes] supabase error:", error);
    return { rows: [], total: 0 };
  }
  const rows: QuoteRow[] = [];
  for (const row of data ?? []) {
    const p = quoteRowSchema.safeParse(row);
    if (p.success) rows.push(p.data);
    else console.error("[listQuotes] zod parse fail:", p.error.issues);
  }
  return { rows, total: count ?? 0 };
}
```

- [ ] **Step 5: actions.ts** (incidents `actions.ts` 패턴 — Read 후 동형: `"use server"`, `createClient`, `revalidatePath`)

`src/features/quotes/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { quoteInputSchema, type QuoteInput } from "./schemas";

const PATH = "/dashboard/quotes";
type Result = { ok: boolean; error?: string };

export async function createQuote(input: QuoteInput): Promise<Result> {
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").insert({
    ...parsed.data,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateQuote(
  id: string,
  input: QuoteInput,
): Promise<Result> {
  if (!id) return { ok: false, error: "id가 없습니다." };
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteQuote(id: string): Promise<Result> {
  if (!id) return { ok: false, error: "id가 없습니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}
```

- [ ] **Step 6: 테스트 통과 + 검증**

Run: `npx vitest run src/features/quotes/__tests__/quotes.test.ts` → PASS (4)
Run: `npm run typecheck` → 0, `npx eslint src/features/quotes/` → 0

- [ ] **Step 7: Commit**
```bash
git add src/features/quotes/
git commit -m "feat(quotes): 견적서 스키마·쿼리·액션"
```

---

## Task 3: ListRow 필드 + Variant union + list-variant quotes/

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` (ListRow에 quote* 필드)
- Modify: `src/app/dashboard/_components/inspector/list-variants/types.ts` (Variant union)
- Create: `src/app/dashboard/_components/inspector/list-variants/quotes/filters.ts`
- Create: `src/app/dashboard/_components/inspector/list-variants/quotes/Table.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/quotes/View.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/quotes/EditForm.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/registry.ts`

**Interfaces:**
- Consumes: `QuoteStatus`, `QUOTE_STATUS_LABEL` from `@/features/quotes/schemas`.
- Produces: ListRow에 `quoteCustomer/quoteDate/quoteAmount/quoteOwner/quoteStatus/quoteValidUntil/quoteNote`; Variant `"quotes"`; `QUOTE_FILTERS`, `blankQuoteRow()`; registry `quotes` 매핑.

- [ ] **Step 1: ListRow 필드 추가** (`ListPattern.tsx` ListRow 타입 끝에)
```ts
  /** quotes 도메인 — 견적서 필드 */
  quoteCustomer?: string;
  quoteDate?: string; // YYYY-MM-DD
  quoteAmount?: number | null;
  quoteOwner?: string; // owner_email
  quoteStatus?: "draft" | "sent" | "won" | "lost";
  quoteValidUntil?: string | null;
  quoteNote?: string | null;
```

- [ ] **Step 2: Variant union** (`types.ts`의 `export type Variant =` 합집합에 한 줄)
```ts
  | "quotes"
```

- [ ] **Step 3: filters.ts** — 상태 칩 + blank row factory

`list-variants/quotes/filters.ts`:
```ts
import type { ListRow } from "../../../patterns/ListPattern";

/** 견적서 상태 필터 칩 (ScopeChips 옆). value=QuoteStatus. */
export const QUOTE_FILTERS = [
  { key: "draft", label: "작성중" },
  { key: "sent", label: "발송" },
  { key: "won", label: "수주" },
  { key: "lost", label: "실주" },
] as const;

/** '+ 새 견적서' 신규 행 factory. */
export function blankQuoteRow(opts?: { currentUserEmail?: string }): ListRow {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  }); // YYYY-MM-DD KST
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserEmail ?? "",
    quoteCustomer: "",
    quoteDate: today,
    quoteAmount: null,
    quoteOwner: opts?.currentUserEmail ?? "",
    quoteStatus: "draft",
    quoteValidUntil: null,
    quoteNote: null,
  };
}

/** 금액 KRW 천단위 콤마. null/undefined → "—". */
export function formatKrw(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return amount.toLocaleString("ko-KR") + "원";
}
```

- [ ] **Step 4: Table.tsx / View.tsx / EditForm.tsx** — `list-variants/incidents/`의 동명 파일을 **템플릿으로 Read**해 동형 구조로 작성하되, 필드를 견적서로 교체.
  - **Table.tsx**: 컬럼 = 고객(`quoteCustomer`) · 견적일(`quoteDate`) · 금액(`formatKrw(quoteAmount)`) · 담당(`operatorNameByEmail(quoteOwner)` — `@/features/auth/operators`) · 상태 뱃지(`QUOTE_STATUS_LABEL[quoteStatus]`). incidents Table의 행/헤더/뱃지 마크업·클래스 토큰 재사용.
  - **View.tsx**: `Section title="견적 정보"` + `DefList`(고객/견적일/금액/담당/상태/유효기간/비고). shared `Section`/`DefList`(`../shared`) 사용. 상태는 `QUOTE_STATUS_LABEL`.
  - **EditForm.tsx**: `EditFormProps`(`row`, `onSave(next)`, `onCancel`) 시그니처(types.ts). 필드: 고객(text) · 견적일(date) · 금액(number → quoteAmount) · 담당(operator select 또는 본인 default) · 상태(select: 작성중/발송/수주/실주) · 유효기간(date) · 비고(textarea). 저장 시 `onSave({ ...row, quote* })`. incidents EditForm의 입력/버튼/레이아웃 토큰 재사용. **삭제 버튼**은 `onSave({ ...row, quoteStatus: row.quoteStatus, /* delete 신호 */ })` 대신, incidents 패턴 확인 후 동일 메커니즘(`onSave({...row, status:"deleted"})` 등)을 따른다 — incidents EditForm Read로 삭제 흐름 확인 후 정합.
  - **TDD 훅**: 이 variant 컴포넌트(.tsx)는 기존 list-variant 컴포넌트의 테스트 유무를 확인(`incidents/__tests__/` 존재)하고, 있으면 동형 테스트 1개라도 추가, 없으면 면제. 면제 시 TDD 훅이 막으면 `CLAUDE_TDD_ENFORCE=off`로 작성.

- [ ] **Step 5: registry.ts 매핑** (incidents 매핑 블록을 Read해 동형으로 한 블록 추가)
```ts
import { QuoteView } from "./quotes/View";
import { QuoteEditForm } from "./quotes/EditForm";
import { QuoteTable } from "./quotes/Table";
import { QUOTE_FILTERS, blankQuoteRow } from "./quotes/filters";
// ... registry 객체에:
  quotes: {
    View: QuoteView,
    EditForm: QuoteEditForm,
    Table: QuoteTable,
    Filters: QUOTE_FILTERS,
    blankRow: blankQuoteRow,
  },
```
실제 registry 항목 키 형태(`View/EditForm/Table/Filters/blankRow`)는 incidents 항목을 Read해 정확히 맞춘다.

- [ ] **Step 6: 검증**

Run: `npm run typecheck` → 0
Run: `npx eslint src/app/dashboard/_components/inspector/list-variants/quotes/` → 0
Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants` → 기존 + (추가 시)신규 통과

- [ ] **Step 7: Commit**
```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/_components/inspector/list-variants/types.ts src/app/dashboard/_components/inspector/list-variants/quotes/ src/app/dashboard/_components/inspector/list-variants/registry.ts
git commit -m "feat(quotes): 견적서 list-variant(View/EditForm/Table/filters) + registry"
```

---

## Task 4: 페이지 + 메뉴 + 카운트 (배선·검증)

**Files:**
- Create: `src/app/dashboard/quotes/page.tsx`
- Create: `src/app/dashboard/quotes/_row-mapper.ts`
- Modify: `src/app/dashboard/_data.ts` (메뉴)
- Modify: `src/features/menu-counts/queries.ts` (count)

**Interfaces:**
- Consumes: `listQuotes`, `createQuote/updateQuote/deleteQuote`, `QuoteRow`, `QUOTE_STATUS_LABEL`, `blankQuoteRow`.
- Produces: `/dashboard/quotes` 라우트 + 사이드바 메뉴 + 카운트.

- [ ] **Step 1: _row-mapper.ts** — QuoteRow → ListRow

`src/app/dashboard/quotes/_row-mapper.ts`:
```ts
import type { ListRow } from "../_components/patterns/ListPattern";
import type { QuoteRow } from "@/features/quotes/schemas";

/** quotes 상태 → ListRow.status(행 틴트). won=approved/sent=review/lost=inactive/draft=active. */
function tint(status: QuoteRow["status"]): ListRow["status"] {
  switch (status) {
    case "won":
      return "approved";
    case "sent":
      return "review";
    case "lost":
      return "inactive";
    default:
      return "active";
  }
}

export function quoteRowToListRow(q: QuoteRow): ListRow {
  return {
    id: q.id,
    name: q.customer,
    status: tint(q.status),
    owner: q.owner_email ?? "",
    quoteCustomer: q.customer,
    quoteDate: q.quote_date,
    quoteAmount: q.amount ?? null,
    quoteOwner: q.owner_email ?? "",
    quoteStatus: q.status,
    quoteValidUntil: q.valid_until ?? null,
    quoteNote: q.note ?? null,
  };
}
```

- [ ] **Step 2: page.tsx** — `incidents/page.tsx` 또는 `news/page.tsx`를 템플릿으로 Read해 동형 작성. 요지:
  - `requireMenu("quotes")`, `findSidebarMeta("quotes")`.
  - searchParams `{ page?, status?, q? }`. `listQuotes({page, status, search:q})`.
  - `ListPattern` `variant="quotes"`, `data={{ rows: quotes.map(quoteRowToListRow) }}`, `controlsRow`(ScopeChips/ListSearch — 기존 contracts/news Controls 패턴), `footer`(`ListPagination`).
  - onSave 배선: EditForm 저장 → id 있으면 `updateQuote(id, input)`, 없으면 `createQuote(input)`; 삭제 신호면 `deleteQuote(id)`. (incidents page의 onSave→action 분기 패턴을 Read해 동형. ListRow→QuoteInput 역매핑 포함.)
  - 신규 작성: `blankQuoteRow({ currentUserEmail: me.email })`.

- [ ] **Step 3: 사이드바 메뉴** (`_data.ts` '자료 보관' 그룹 items에서 회의록 다음에 추가)
```ts
          {
            ico: "·",
            label: "견적서",
            slug: "quotes",
            pattern: "list",
          },
```

- [ ] **Step 4: 메뉴 카운트** (`menu-counts/queries.ts`의 `Promise.all` 배열에 추가)
```ts
    countOf("quotes", supabase.from("quotes").select("*", head)),
```

- [ ] **Step 5: 검증**

Run: `npm run typecheck` → 0
Run: `npx eslint src/app/dashboard/quotes/ src/app/dashboard/_data.ts src/features/menu-counts/queries.ts` → 0
Run: `unset NODE_ENV; npm run build` → 성공(`/dashboard/quotes` 라우트 출력 확인)

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/quotes/ src/app/dashboard/_data.ts src/features/menu-counts/queries.ts
git commit -m "feat(quotes): 견적서 페이지 + 사이드바 메뉴 + 카운트"
```

---

## 운영 선행 (구현 후)

- 마이그(`20260624c`, `20260624d`) 프로덕션 적용 — 컨트롤러가 pg 직접 적용 + RLS/GRANT 검증(quotes select/insert 권한, 권한별 정책).
- 메뉴 노출: viewer 권한 운영자에게도 보이려면 `allowed_menus`에 `quotes` 추가 필요(admin·member는 기본 노출 정책 따름 — 기존 메뉴 가드 동작 확인).

## Self-Review

- **Spec coverage**: §2 테이블→T1, §3 features→T2, §4 variant→T3, §6 페이지→T4, §7 메뉴/카운트→T4, §5 상태라벨→T2(QUOTE_STATUS_LABEL)/T3. 전 섹션 매핑.
- **Placeholder**: 데이터층(T1/T2)·_row-mapper·filters는 완전 코드. variant 컴포넌트(T3 Step4)·page(T4 Step2)는 "incidents/news 동명 파일을 템플릿으로 Read해 동형 + 명시된 필드/컬럼/onSave 분기로 교체" — 추상 지시가 아닌 구체 변환 스펙(필드 목록·컬럼·매핑 명시). EditForm 삭제 흐름·registry 키·page onSave 분기는 "incidents Read 후 정합" 명시.
- **Type 일관성**: `QuoteStatus`(T2) = ListRow `quoteStatus` union(T3) = _row-mapper(T4) 일치. `quoteInputSchema`(T2) = actions 입력(T2) = page onSave 역매핑(T4) 일치. `blankQuoteRow`(T3) = page 신규(T4) 일치. registry 키는 incidents 실제 형태로 맞추라 명시.
- **위험 지점**: RLS operators 권한 표현식(T1 Step2) — 실제 incidents RLS Read로 검증 명시. registry 항목 키 형태(T3 Step5) — incidents Read로 검증 명시. 이 두 곳이 추측 금지 지점.
