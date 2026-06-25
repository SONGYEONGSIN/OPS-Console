# 견적서 문서 양식 SP1(기반) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 견적서 상세 페이지(`/dashboard/quotes/[id]`)에서 dev/fee 유형 견적서 문서를 작성·저장하고, 문서 총계가 목록 amount에 동기화되는 기반을 구축한다.

**Architecture:** `quotes`에 `quote_type`+`document`(jsonb) 컬럼 추가. `features/quotes/`에 document zod 스키마 + 발신자 상수 + 순수 계산 엔진. 상세 페이지는 meetings `[id]` 에디터 패턴 동형 — 마스트헤드(머리말)+섹션 표(dev/fee)+합계(자동)+약관. 저장은 server action이 서버 재계산 후 jsonb+amount 적재.

**Tech Stack:** Next.js App Router, Supabase(jsonb), zod, Vitest, Tailwind. 참조 템플릿: `src/app/dashboard/meetings/[id]/`, `src/features/meetings/`.

## Global Constraints

- 저장 단일 경로: `saveQuoteDocument(id, document)` — 서버에서 calc 재계산해 `document`+`amount`(=totals.total) 적재(클라이언트 값 불신). admin client 사용(meetings saveMeetingContent 동형).
- 계산 정확성 핵심: calc 순수함수 TDD. dev/fee 행금액=비용 직접, 소계=Σ, 공급가=Σ소계, 부가세=공급가×0.1, 합계=공급가+부가세.
- 발신자(진학어플라이) 정보는 상수. 하드코딩 색상 금지, `any` 금지, 미사용 import 금지. zod 에러 `issues[0].message`.
- quote_type 기본 'dev'. document jsonb는 nullable(Phase1 기존 행 호환).

---

## File Structure

- `supabase/migrations/20260625_quotes_document.sql` (create)
- `src/features/quotes/sender.ts` (create) — 발신자 상수
- `src/features/quotes/document-schema.ts` (create) — QuoteDocument zod
- `src/features/quotes/calc/index.ts` (create) — 계산 엔진
- `src/features/quotes/calc/__tests__/calc.test.ts` (create)
- `src/features/quotes/document-actions.ts` (create) — saveQuoteDocument
- `src/features/quotes/document-queries.ts` (create) — getQuoteDocument
- `src/app/dashboard/quotes/[id]/page.tsx` (create) + `_components/` (create) — 에디터
- `src/features/quotes/schemas.ts` (modify) — quote_type 추가

---

## Task 1: 마이그레이션 — quote_type + document 컬럼

**Files:** Create `supabase/migrations/20260625_quotes_document.sql`

- [ ] **Step 1: 마이그 작성**
```sql
-- 견적서 문서 양식(Phase 2) — 유형 + 문서 jsonb
begin;
alter table public.quotes
  add column if not exists quote_type text not null default 'dev',
  add column if not exists document jsonb;
commit;
notify pgrst, 'reload schema';
```
(RLS 변경 없음 — 기존 quotes 정책/grant가 신규 컬럼 포함. 적용은 컨트롤러.)

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260625_quotes_document.sql
git commit -m "feat(quotes): 문서 양식 컬럼(quote_type+document) 마이그"
```

---

## Task 2: 발신자 상수 + document 스키마

**Files:** Create `src/features/quotes/sender.ts`, `document-schema.ts`; Test `__tests__/document-schema.test.ts`; Modify `schemas.ts`

**Interfaces:**
- Produces: `QUOTE_SENDER`(상수), `QuoteType`/`quoteTypeSchema`, `quoteDocumentSchema`/`QuoteDocument`, `QuoteHeader`/`QuoteSection`/`QuoteRow`/`QuoteTotals` 타입, `blankDocument(type)`.

- [ ] **Step 1: sender.ts** (분석에서 확인된 진학어플라이 상수 — 실제 값은 샘플/기존 메일 서명에서 확인해 채움. 미상값은 빈 문자열 두고 주석)
```ts
/** 견적서 발신자(진학어플라이) 상수. 샘플 4종 공통값. */
export const QUOTE_SENDER = {
  company: "주식회사 진학어플라이",
  ceo: "신원근",
  bizNo: "", // 사업자등록번호 — 운영 확인 후 채움
  address: "",
  tel: "",
  fax: "",
  email: "",
} as const;
export type QuoteSender = typeof QUOTE_SENDER;
```
**주의**: bizNo/address/tel 등 실제 값은 `design-ref/quotes/` 샘플 또는 기존 `src/lib/mail-signature.ts`에서 확인해 채운다(추측 금지 — 모르면 빈 문자열 + TODO 주석).

- [ ] **Step 2: RED 테스트** (`document-schema.test.ts`)
```ts
import { describe, it, expect } from "vitest";
import { quoteTypeSchema, quoteDocumentSchema, blankDocument } from "../document-schema";

describe("quoteTypeSchema", () => {
  it("dev/fee/platform/labor 통과, 그 외 거부", () => {
    expect(quoteTypeSchema.safeParse("dev").success).toBe(true);
    expect(quoteTypeSchema.safeParse("x").success).toBe(false);
  });
});
describe("blankDocument", () => {
  it("dev 빈 문서 — type=dev, 섹션 1, 빈 totals", () => {
    const d = blankDocument("dev");
    expect(d.type).toBe("dev");
    expect(d.sections.length).toBeGreaterThanOrEqual(1);
    expect(d.totals.total).toBe(0);
    expect(quoteDocumentSchema.safeParse(d).success).toBe(true);
  });
});
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/features/quotes/__tests__/document-schema.test.ts` → FAIL

- [ ] **Step 4: document-schema.ts**
```ts
import { z } from "zod";

export const QUOTE_TYPES = ["dev", "fee", "platform", "labor"] as const;
export const quoteTypeSchema = z.enum(QUOTE_TYPES);
export type QuoteType = z.infer<typeof quoteTypeSchema>;

export const QUOTE_TYPE_LABELS: Record<QuoteType, string> = {
  dev: "시스템 개발비",
  fee: "시스템 수수료",
  platform: "플랫폼 기반",
  labor: "노임단가 기준",
};

export const quoteHeaderSchema = z.object({
  recipient: z.string().default(""),
  quoteName: z.string().default(""),
  quoteNo: z.string().default(""),
  quoteDate: z.string().default(""),
  validUntil: z.string().default(""),
  manager: z.string().default(""),
});
export type QuoteHeader = z.infer<typeof quoteHeaderSchema>;

export const quoteRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()]),
);
export type QuoteRow = z.infer<typeof quoteRowSchema>;

export const quoteColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["text", "number", "amount"]).default("text"),
});
export const quoteSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  columns: z.array(quoteColumnSchema),
  rows: z.array(quoteRowSchema),
  subtotal: z.number().default(0),
});
export type QuoteSection = z.infer<typeof quoteSectionSchema>;

export const quoteTotalsSchema = z.object({
  supply: z.number().default(0),
  vat: z.number().default(0),
  total: z.number().default(0),
  vatIncluded: z.boolean().default(false),
});
export type QuoteTotals = z.infer<typeof quoteTotalsSchema>;

export const quoteDocumentSchema = z.object({
  type: quoteTypeSchema,
  header: quoteHeaderSchema,
  sections: z.array(quoteSectionSchema),
  totals: quoteTotalsSchema,
  terms: z.array(z.string()).default([]),
});
export type QuoteDocument = z.infer<typeof quoteDocumentSchema>;

/** 유형별 빈 문서. dev/fee는 4열 단일 섹션. (platform/labor은 SP2/SP3에서 확장) */
export function blankDocument(type: QuoteType): QuoteDocument {
  const simpleColumns = [
    { key: "category", label: "구분", kind: "text" as const },
    { key: "detail", label: "상세내역", kind: "text" as const },
    { key: "note", label: "비고", kind: "text" as const },
    { key: "amount", label: "비용", kind: "amount" as const },
  ];
  return {
    type,
    header: {
      recipient: "",
      quoteName: "",
      quoteNo: "",
      quoteDate: "",
      validUntil: "견적일로부터 30일 이내",
      manager: "",
    },
    sections: [
      { id: "main", title: "견적 내역", columns: simpleColumns, rows: [], subtotal: 0 },
    ],
    totals: { supply: 0, vat: 0, total: 0, vatIncluded: false },
    terms: [],
  };
}
```

- [ ] **Step 5: schemas.ts에 quote_type 반영** — `quoteRowSchema`(Phase1 DB row)에 `quote_type: quoteTypeSchema.optional()`, `document: z.unknown().nullable().optional()` 추가(목록 쿼리 호환). `import { quoteTypeSchema } from "./document-schema"`.

- [ ] **Step 6: 통과 + 검증** — vitest PASS, `npm run typecheck` 0, eslint 0

- [ ] **Step 7: Commit** — `feat(quotes): 견적서 문서 스키마 + 발신자 상수`

---

## Task 3: 계산 엔진 (순수·TDD 집중)

**Files:** Create `src/features/quotes/calc/index.ts`; Test `calc/__tests__/calc.test.ts`

**Interfaces:**
- Consumes: `QuoteSection`, `QuoteDocument`, `QuoteTotals`.
- Produces: `sectionSubtotal(section): number`, `quoteTotals(document, opts?): QuoteTotals`, `koreanAmount(n): string`, `recomputeDocument(document): QuoteDocument`(섹션 소계+totals 재계산본 반환).

- [ ] **Step 1: RED 테스트**
```ts
import { describe, it, expect } from "vitest";
import { sectionSubtotal, quoteTotals, koreanAmount, recomputeDocument } from "../index";
import { blankDocument } from "../../document-schema";

describe("sectionSubtotal", () => {
  it("amount 컬럼 합", () => {
    const s = {
      id: "main", title: "", subtotal: 0,
      columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
      rows: [{ amount: 1000 }, { amount: 2000 }, { amount: null }],
    };
    expect(sectionSubtotal(s)).toBe(3000);
  });
});
describe("quoteTotals", () => {
  it("공급가→부가세10%→합계", () => {
    const d = recomputeDocument({
      ...blankDocument("dev"),
      sections: [{
        id: "main", title: "", subtotal: 0,
        columns: [{ key: "amount", label: "비용", kind: "amount" as const }],
        rows: [{ amount: 1000000 }],
      }],
    });
    expect(d.totals.supply).toBe(1000000);
    expect(d.totals.vat).toBe(100000);
    expect(d.totals.total).toBe(1100000);
  });
});
describe("koreanAmount", () => {
  it("일금 변환", () => {
    expect(koreanAmount(1100000)).toContain("일백십만");
  });
  it("0 → 영원/빈", () => {
    expect(typeof koreanAmount(0)).toBe("string");
  });
});
```

- [ ] **Step 2: 실패 확인** — vitest FAIL

- [ ] **Step 3: calc/index.ts 구현**
```ts
import type { QuoteSection, QuoteDocument, QuoteTotals } from "../document-schema";

/** 섹션 소계 — kind 'amount' 컬럼들의 행 합. (dev/fee: 'amount' 단일) */
export function sectionSubtotal(section: QuoteSection): number {
  const amountKeys = section.columns
    .filter((c) => c.kind === "amount")
    .map((c) => c.key);
  let sum = 0;
  for (const row of section.rows) {
    for (const k of amountKeys) {
      const v = row[k];
      if (typeof v === "number") sum += v;
    }
  }
  return sum;
}

/** 문서 총계 — Σ섹션소계 = 공급가, 부가세 10%, 합계. vatIncluded면 분리. */
export function quoteTotals(
  document: QuoteDocument,
  opts?: { vatIncluded?: boolean },
): QuoteTotals {
  const vatIncluded = opts?.vatIncluded ?? document.totals.vatIncluded ?? false;
  const subtotalSum = document.sections.reduce(
    (acc, s) => acc + sectionSubtotal(s),
    0,
  );
  if (vatIncluded) {
    const total = subtotalSum;
    const supply = Math.round(total / 1.1);
    return { supply, vat: total - supply, total, vatIncluded: true };
  }
  const supply = subtotalSum;
  const vat = Math.round(supply * 0.1);
  return { supply, vat, total: supply + vat, vatIncluded: false };
}

/** 섹션 소계 + 총계를 재계산한 문서 반환(불변). 저장 시 서버가 호출. */
export function recomputeDocument(document: QuoteDocument): QuoteDocument {
  const sections = document.sections.map((s) => ({
    ...s,
    subtotal: sectionSubtotal(s),
  }));
  const next = { ...document, sections };
  return { ...next, totals: quoteTotals(next) };
}

const KO_DIGITS = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const KO_SMALL = ["", "십", "백", "천"];
const KO_BIG = ["", "만", "억", "조", "경"];

/** 숫자 → 한글 금액(예: 1100000 → '일백십만'). 0 → '영'. */
export function koreanAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "영";
  let v = Math.floor(n);
  const groups: string[] = [];
  let gi = 0;
  while (v > 0) {
    const g = v % 10000;
    if (g > 0) {
      let part = "";
      let gg = g;
      let si = 0;
      while (gg > 0) {
        const d = gg % 10;
        if (d > 0) part = KO_DIGITS[d] + KO_SMALL[si] + part;
        gg = Math.floor(gg / 10);
        si++;
      }
      groups.unshift(part + KO_BIG[gi]);
    } else {
      groups.unshift("");
    }
    v = Math.floor(v / 10000);
    gi++;
  }
  return groups.join("");
}
```

- [ ] **Step 4: 통과 확인** — vitest PASS

- [ ] **Step 5: Commit** — `feat(quotes): 견적서 계산 엔진(소계·총계·한글금액)`

---

## Task 4: 문서 저장/조회 액션 + 목록 amount 동기화

**Files:** Create `src/features/quotes/document-actions.ts`, `document-queries.ts`

**Interfaces:**
- Consumes: `recomputeDocument`, `quoteDocumentSchema`, `QuoteDocument`, `createAdminClient`, `getCurrentOperator`.
- Produces: `saveQuoteDocument(id, document, quoteType): Promise<{ok,error?}>`, `getQuoteDocument(id): Promise<{ type, document, customer, status } | null>`.

- [ ] **Step 1: document-queries.ts**
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { quoteDocumentSchema, type QuoteDocument, type QuoteType } from "./document-schema";

export async function getQuoteDocument(
  id: string,
): Promise<{ id: string; quoteType: QuoteType; document: QuoteDocument | null; customer: string; status: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_type, document, customer, status")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = quoteDocumentSchema.safeParse(data.document);
  return {
    id: data.id as string,
    quoteType: (data.quote_type as QuoteType) ?? "dev",
    document: parsed.success ? parsed.data : null,
    customer: (data.customer as string) ?? "",
    status: (data.status as string) ?? "draft",
  };
}
```

- [ ] **Step 2: RED 테스트** (`__tests__/document-actions.test.ts`) — saveQuoteDocument이 recompute 후 amount=총계로 갱신하는지(admin mock). meetings actions.test 패턴 차용.
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { mockAdmin, mockGetOperator } = vi.hoisted(() => ({ mockAdmin: vi.fn(), mockGetOperator: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: mockGetOperator }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveQuoteDocument } from "../document-actions";
import { blankDocument } from "../document-schema";

beforeEach(() => { vi.clearAllMocks(); mockGetOperator.mockResolvedValue({ email: "op@x.com" }); });

it("저장 시 recompute → amount=총계 update", async () => {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  mockAdmin.mockReturnValue({ from: () => ({ update }) });
  const doc = { ...blankDocument("dev"), sections: [{ id:"main", title:"", subtotal:0, columns:[{key:"amount",label:"비용",kind:"amount" as const}], rows:[{ amount: 1000000 }] }] };
  const r = await saveQuoteDocument("q1", doc, "dev");
  expect(r.ok).toBe(true);
  const payload = update.mock.calls[0][0];
  expect(payload.amount).toBe(1100000); // 공급가100만+VAT10만
  expect(payload.quote_type).toBe("dev");
  expect(payload.document.totals.total).toBe(1100000);
});
```

- [ ] **Step 3: 실패 확인** — FAIL

- [ ] **Step 4: document-actions.ts**
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  quoteDocumentSchema, quoteTypeSchema, type QuoteDocument, type QuoteType,
} from "./document-schema";
import { recomputeDocument } from "./calc";

export async function saveQuoteDocument(
  id: string,
  document: QuoteDocument,
  quoteType: QuoteType,
): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "id가 없습니다." };
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const tp = quoteTypeSchema.safeParse(quoteType);
  if (!tp.success) return { ok: false, error: "잘못된 견적 유형입니다." };
  const parsed = quoteDocumentSchema.safeParse(document);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };

  // 서버 재계산(클라이언트 값 불신) → amount 동기화
  const recomputed = recomputeDocument(parsed.data);
  const admin = createAdminClient();
  const { error } = await admin
    .from("quotes")
    .update({
      quote_type: tp.data,
      document: recomputed,
      amount: recomputed.totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${id}`);
  return { ok: true };
}
```

- [ ] **Step 5: 통과 + 검증** — vitest/typecheck/eslint 0

- [ ] **Step 6: Commit** — `feat(quotes): 문서 저장/조회 액션 + amount 동기화`

---

## Task 5: 상세 페이지 에디터 (dev/fee) — meetings [id] 동형

**Files:** Create `src/app/dashboard/quotes/[id]/page.tsx` + `_components/`(QuoteDocumentEditor 등); Modify 목록에서 상세 진입 경로

**Interfaces:**
- Consumes: `getQuoteDocument`, `saveQuoteDocument`, `blankDocument`, `recomputeDocument`, `koreanAmount`, `QUOTE_SENDER`, `QUOTE_TYPE_LABELS`.

- [ ] **Step 1: meetings [id] 템플릿 학습** — `src/app/dashboard/meetings/[id]/page.tsx` + `_components/` 를 Read해 양식 에디터 구조(서버 데이터 로드 → 클라이언트 에디터 컴포넌트 → 저장 액션) 파악.

- [ ] **Step 2: `[id]/page.tsx`** (RSC) — `requireMenu("quotes")`, `getQuoteDocument(id)`(없으면 notFound). `document ?? blankDocument(quoteType)` 전달. 클라이언트 `QuoteDocumentEditor`에 `{ id, quoteType, document, customer }` + `onSave` server action 바인딩(saveQuoteDocument).

- [ ] **Step 3: `_components/QuoteDocumentEditor.tsx`** (client) — meetings 양식 동형:
  - 마스트헤드(머리말): 수신·견적명·견적번호·견적일·유효기간·담당 입력(라벨·값 그리드) + 발신자 상수(읽기전용 표시, `QUOTE_SENDER`).
  - 섹션 표(dev/fee): columns 헤더 + rows 인라인 편집(비용은 number) + 행 추가/삭제(회의록 행추가 패턴). 입력 변경 시 `recomputeDocument`로 소계·합계 즉시 재계산 표시.
  - 합계 영역: 공급가·부가세·합계(자동, 읽기전용) + 한글금액(`koreanAmount(total)`).
  - 약관: terms 라인 추가/삭제 텍스트.
  - 저장 버튼 → onSave(document, quoteType). 디자인 토큰만.
  - **TDD 훅**: 에디터 thin/통합 컴포넌트는 meetings _components 테스트 관례 따름(있으면 핵심 1개, 없으면 면제 — `CLAUDE_TDD_ENFORCE=off`).

- [ ] **Step 4: 목록→상세 진입** — `dashboard/quotes/page.tsx`(또는 변형 Table/View)에서 "문서 작성/열기" 링크 `/dashboard/quotes/[id]` 추가. (Phase1 인스펙터 유지, 문서 진입 버튼만 추가 — 최소 변경.)

- [ ] **Step 5: 검증** — `npm run typecheck` 0, eslint 0, `unset NODE_ENV; npm run build` 성공(`/dashboard/quotes/[id]` 라우트). 수동 흐름(빌드 라우트 확인).

- [ ] **Step 6: Commit** — `feat(quotes): 견적서 문서 상세 에디터(dev/fee)`

---

## 운영 선행
- 마이그(`20260625_quotes_document`) 프로덕션 적용. 발신자 상수 실제값(사업자번호·주소·전화) 확인 후 sender.ts 채움.

## Self-Review
- Spec(SP1) 커버: 마이그→T1, 스키마/발신자→T2, calc→T3, 저장/동기화→T4, 상세에디터→T5. SP2(platform)/SP3(labor)/SP4(PDF)는 별도 plan.
- Placeholder: 데이터/calc층 완전 코드. T5 에디터는 "meetings [id] 동형 + 명시 필드/섹션/합계" — 구체 변환 스펙. sender 실제값은 "샘플/mail-signature 확인, 모르면 빈+TODO" 명시(추측 금지).
- Type 일관: QuoteDocument(T2)=calc 입출력(T3)=saveQuoteDocument(T4)=에디터(T5). recomputeDocument 서버 재계산 단일 경로.
