# 견적서 문서 양식 SP3(labor 노임단가/적산) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** labor(노임단가 기준) 유형 견적서를 지원한다 — KOSA 2026 17등급 단가표 + 인건비 적산(직접인건비→제경비→기술료) + 등급 선택 lookup.

**Architecture:** SP1/SP2 기반. KOSA 단가 상수 + 적산 계산(labor-personnel 섹션 인지) + labor blankDocument(인건비 적산 섹션 + 일반 항목 섹션) + 에디터 labor 지원(등급 드롭다운→단가 자동, 제경비율·기술료율·참여율 입력). 적산은 단순 Σ가 아니므로 calc에 섹션 kind 분기 추가.

**Tech Stack:** Next.js, zod, Vitest, Tailwind. 기반: SP1/SP2 `features/quotes/{document-schema,calc}`, 에디터.

## Global Constraints

- **금액 정확성 최우선** — 적산 공식은 샘플 검증값과 일치해야. calc 순수함수 TDD 집중.
- 직접인건비 = `인원 × 노임단가(일) × 투입기간(일) × 참여율`. 제경비 = `직접인건비합계 × overheadRate`(기본 1.1). 기술료 = `(직접+제경비) × techFeeRate`(기본 0.2). 인건비합계 = 직접+제경비+기술료.
- KOSA 단가는 2026 17등급 상수. 등급 선택 시 노임단가 자동 채움.
- 저장 단일 경로(SP1) 무변경 — 서버 recompute가 labor 섹션도 재계산.
- 하드코딩 색상 금지, any 금지, 미사용 import 금지.

---

## Task 1: KOSA 2026 단가 상수 + 적산 계산

**Files:**
- Create: `src/features/quotes/kosa-2026.ts`
- Modify: `src/features/quotes/document-schema.ts` (섹션에 kind/rates)
- Modify: `src/features/quotes/calc/index.ts` (labor 적산)
- Test: `src/features/quotes/calc/__tests__/labor.test.ts`

**Interfaces:**
- Produces: `KOSA_2026`(등급 상수 배열), `kosaDaily(gradeKey)`, `laborRollup({direct, overheadRate, techFeeRate})`, `sectionSubtotal`가 labor-personnel 섹션 인지.

- [ ] **Step 1: kosa-2026.ts** — 한국SW산업협회 2025.12.19 공표, 일평균임금(M/D 20.5일 기준) 2026 적용 17등급:
```ts
/** KOSA SW기술자 노임단가 2026 적용(일평균임금, 원). 출처: 한국SW산업협회 2025.12.19. */
export const KOSA_2026 = [
  { key: "planner", name: "IT기획자", daily: 578206 },
  { key: "consultant", name: "IT컨설턴트", daily: 522340 },
  { key: "analyst", name: "업무분석가", daily: 475154 },
  { key: "data-analyst", name: "데이터분석가", daily: 414600 },
  { key: "pm", name: "IT PM", daily: 492039 },
  { key: "architect", name: "IT아키텍트", daily: 541621 },
  { key: "uiux-plan", name: "UI/UX기획·개발자", daily: 336666 },
  { key: "uiux-design", name: "UI/UX디자이너", daily: 251671 },
  { key: "app-dev", name: "응용SW개발자", daily: 378250 },
  { key: "sys-dev", name: "시스템SW개발자", daily: 284888 },
  { key: "operator", name: "정보시스템운용자", daily: 519469 },
  { key: "support", name: "IT지원기술자", daily: 252196 },
  { key: "marketer", name: "IT마케터", daily: 575293 },
  { key: "qa", name: "IT품질관리자", daily: 538638 },
  { key: "tester", name: "IT테스터", daily: 197714 },
  { key: "auditor", name: "IT감리", daily: 572934 },
  { key: "security", name: "정보보안전문가", daily: 507887 },
] as const;
export type KosaGradeKey = (typeof KOSA_2026)[number]["key"];

/** 등급 key → 일평균임금. 미상 → 0. */
export function kosaDaily(key: string): number {
  return KOSA_2026.find((g) => g.key === key)?.daily ?? 0;
}
```

- [ ] **Step 2: 섹션 스키마에 kind/rates 추가** (`document-schema.ts` `quoteSectionSchema`)
```ts
// quoteSectionSchema에 추가:
  kind: z.enum(["simple", "labor"]).default("simple"),
  rates: z.object({ overhead: z.number().default(1.1), techFee: z.number().default(0.2) }).optional(),
```
(기존 섹션은 kind 기본 'simple' — 회귀 없음.)

- [ ] **Step 3: RED 테스트** (`calc/__tests__/labor.test.ts`)
```ts
import { describe, it, expect } from "vitest";
import { laborRollup, sectionSubtotal } from "../index";
import { kosaDaily } from "../../kosa-2026";

describe("kosaDaily", () => {
  it("등급 단가 lookup", () => {
    expect(kosaDaily("planner")).toBe(578206);
    expect(kosaDaily("tester")).toBe(197714);
    expect(kosaDaily("없는등급")).toBe(0);
  });
});
describe("laborRollup", () => {
  it("제경비 110% + 기술료 20% 적산", () => {
    const r = laborRollup({ direct: 1000000, overheadRate: 1.1, techFeeRate: 0.2 });
    expect(r.overhead).toBe(1100000);          // 직접 × 1.1
    expect(r.techFee).toBe(420000);            // (100만+110만) × 0.2
    expect(r.total).toBe(2520000);             // 100만+110만+42만
  });
});
describe("sectionSubtotal labor", () => {
  it("직접인건비=인원×단가×투입일×참여율 합 → 적산 = 인건비합계", () => {
    // 1명 × 578206 × 10일 × 1.0 = 5,782,060 직접
    const section = {
      id: "labor", title: "인건비", kind: "labor" as const,
      rates: { overhead: 1.1, techFee: 0.2 },
      columns: [
        { key: "role", label: "직무", kind: "text" as const },
        { key: "count", label: "인원", kind: "number" as const },
        { key: "daily", label: "노임단가", kind: "number" as const },
        { key: "days", label: "투입일", kind: "number" as const },
        { key: "ratio", label: "참여율", kind: "number" as const },
        { key: "direct", label: "직접인건비", kind: "amount" as const },
      ],
      rows: [{ role: "기획", count: 1, daily: 578206, days: 10, ratio: 1, direct: null }],
      subtotal: 0,
    };
    // 직접합 = 5,782,060 → 제경비 6,360,266 → 기술료 (5782060+6360266)*0.2=2,428,465.2→round 2428465 → 합계 14,570,791
    expect(sectionSubtotal(section)).toBe(5782060 + 6360266 + 2428465);
  });
});
```

- [ ] **Step 4: 실패 확인** — `npx vitest run src/features/quotes/calc/__tests__/labor.test.ts` → FAIL

- [ ] **Step 5: calc 구현** (`calc/index.ts`에 추가/수정)
```ts
/** 적산 — 직접인건비 → 제경비 → 기술료 → 합계. (반올림: 원 단위) */
export function laborRollup(input: {
  direct: number;
  overheadRate: number;
  techFeeRate: number;
}): { direct: number; overhead: number; techFee: number; total: number } {
  const overhead = Math.round(input.direct * input.overheadRate);
  const techFee = Math.round((input.direct + overhead) * input.techFeeRate);
  return { direct: input.direct, overhead, techFee, total: input.direct + overhead + techFee };
}

/** labor 섹션 한 행의 직접인건비 = 인원×노임단가×투입일×참여율. */
function laborRowDirect(row: Record<string, string | number | null>): number {
  const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : 0);
  return Math.round(num("count") * num("daily") * num("days") * num("ratio"));
}
```
그리고 기존 `sectionSubtotal`을 labor 분기로 확장:
```ts
export function sectionSubtotal(section: QuoteSection): number {
  if (section.kind === "labor") {
    const direct = section.rows.reduce((acc, r) => acc + laborRowDirect(r), 0);
    const rates = section.rates ?? { overhead: 1.1, techFee: 0.2 };
    return laborRollup({ direct, overheadRate: rates.overhead, techFeeRate: rates.techFee }).total;
  }
  // 기존 simple: amount 컬럼 합
  const amountKeys = section.columns.filter((c) => c.kind === "amount").map((c) => c.key);
  let sum = 0;
  for (const row of section.rows) for (const k of amountKeys) {
    const v = row[k];
    if (typeof v === "number") sum += v;
  }
  return sum;
}
```
(`QuoteSection` 타입 import에 kind/rates 반영됨.)

- [ ] **Step 6: 통과 + 검증** — vitest PASS(기존 calc 회귀 포함), typecheck 0, eslint 0

- [ ] **Step 7: Commit** — `feat(quotes): KOSA 2026 단가 + 노임단가 적산 계산`

---

## Task 2: labor blankDocument + recompute에 행 직접인건비 반영

**Files:** Modify `src/features/quotes/document-schema.ts`, `calc/index.ts`; Test 보강

**Interfaces:**
- Produces: `blankDocument("labor")` = 인건비(labor 섹션, KOSA 컬럼) + 일반 항목(simple) 폴백. `recomputeDocument`가 labor 행의 `direct` 셀도 계산해 기입.

- [ ] **Step 1: laborSection 팩토리 + blankDocument 분기** (`document-schema.ts`)
```ts
function laborSection() {
  return {
    id: "labor", title: "인건비 (적산)", kind: "labor" as const,
    rates: { overhead: 1.1, techFee: 0.2 },
    columns: [
      { key: "role", label: "직무/등급", kind: "text" as const },
      { key: "count", label: "인원(명)", kind: "number" as const },
      { key: "daily", label: "노임단가(일)", kind: "number" as const },
      { key: "days", label: "투입기간(일)", kind: "number" as const },
      { key: "ratio", label: "참여율", kind: "number" as const },
      { key: "direct", label: "직접인건비", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}
// blankDocument 분기에 추가: type === "labor" ? [laborSection()] : ...
```

- [ ] **Step 2: recomputeDocument가 labor 행 direct 기입** (`calc/index.ts` recomputeDocument 수정) — labor 섹션은 각 행 `direct = laborRowDirect(row)`로 채운 뒤 subtotal 계산(표시·저장 일관):
```ts
export function recomputeDocument(document: QuoteDocument): QuoteDocument {
  const sections = document.sections.map((s) => {
    if (s.kind === "labor") {
      const rows = s.rows.map((r) => ({ ...r, direct: laborRowDirect(r) }));
      const withRows = { ...s, rows };
      return { ...withRows, subtotal: sectionSubtotal(withRows) };
    }
    return { ...s, subtotal: sectionSubtotal(s) };
  });
  const next = { ...document, sections };
  return { ...next, totals: quoteTotals(next) };
}
```
(laborRowDirect를 export하여 테스트/에디터에서 재사용 가능하게.)

- [ ] **Step 3: 테스트 보강** — blankDocument("labor") 섹션 kind/columns 검증, recomputeDocument가 labor 행 direct 채우고 totals에 인건비합계 반영 검증.

- [ ] **Step 4: 통과 + 검증** — vitest/typecheck/eslint 0

- [ ] **Step 5: Commit** — `feat(quotes): labor 문서 + 행 직접인건비 자동 기입`

---

## Task 3: 에디터 labor 지원 (등급 드롭다운 + 요율 입력)

**Files:** Modify `src/app/dashboard/quotes/[id]/_components/QuoteDocumentEditor.tsx`

- [ ] **Step 1: labor 섹션 렌더 분기** — 섹션 `kind === "labor"`이면:
  - 노임단가(daily) 컬럼 셀에 **등급 드롭다운**(KOSA_2026 옵션) — 선택 시 해당 행 `daily = kosaDaily(key)` + (옵션)`role` 라벨 자동. 또는 daily 직접 숫자 입력도 허용(드롭다운 옆).
  - `direct` 컬럼은 읽기전용(자동계산, recompute 값 표시).
  - 섹션 상단/하단에 **요율 입력**: 제경비율(rates.overhead)·기술료율(rates.techFee) number 입력 → 변경 시 recompute. 적산 내역(직접합·제경비·기술료·인건비합계) 표시.
- [ ] **Step 2: 입력 변경 시 recompute** — 기존 updateDoc→recomputeDocument 흐름 재사용(labor 행 direct·소계 자동).
- [ ] **Step 3: 테스트** — labor 유형 선택 시 등급 드롭다운·요율 입력 렌더 + 단가 채움 케이스 1개. TDD 훅 막으면 기존 테스트 수정이라 통과/면제.
- [ ] **Step 4: 검증** — typecheck 0, eslint 0, build 성공.
- [ ] **Step 5: Commit** — `feat(quotes): 견적서 labor 에디터(등급 드롭다운+적산 요율)`

---

## Self-Review
- Spec(SP3=labor) 커버: KOSA 상수·적산 calc→T1, labor 문서·행계산→T2, 에디터→T3.
- 정확성: laborRollup·sectionSubtotal labor 분기 TDD(샘플 검증값 1000000→제경비110만·기술료42만·합계252만). 반올림 원 단위.
- 회귀: sectionSubtotal simple 분기·dev/fee/platform 기존 동작 보존(kind 기본 'simple').
- Type 일관: KosaGradeKey/laborRollup(T1) = laborSection rates(T2) = 에디터 드롭다운(T3). recompute 단일 경로(서버 재계산 포함).
- 주의: 샘플1 비고 "제경비 120%"는 셀(1.1)과 불일치 → 셀 값 1.1을 정답으로 채택(기본값). 사용자가 요율 입력으로 조정 가능.
