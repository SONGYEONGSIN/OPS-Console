# 견적서 문서 양식 SP2(platform) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 견적서 문서 에디터에 유형 선택기를 추가하고, platform(플랫폼 기반) 유형의 섹션(기능나열형)을 지원한다.

**Architecture:** SP1 기반 위에 `blankDocument`를 유형 분기(dev/fee=4열 simple, platform=기능나열 컬럼)로 확장. 에디터에 유형 선택 드롭다운(빈 문서일 때 유형 변경 시 섹션 재생성). 컬럼 `kind`에 `multiline` 추가(기능명세 textarea). 별도청구는 기존 약관(terms) 재사용. 한글금액 머리말은 SP1 합계 블록 그대로.

**Tech Stack:** Next.js, zod, Vitest, Tailwind. 기반: SP1 `features/quotes/document-schema.ts`, `app/dashboard/quotes/[id]/_components/QuoteDocumentEditor.tsx`.

## Global Constraints

- 유형 변경은 **빈 문서(섹션 행 없음)일 때만** 섹션 재생성 — 입력된 행 보존(데이터 손실 방지). 행이 있으면 유형 변경 차단 또는 경고.
- 저장 단일 경로(SP1 saveQuoteDocument) 무변경 — quote_type만 선택값 반영.
- 금액 계산은 SP1 calc 그대로(amount 컬럼 합산). platform도 amount 컬럼으로 금액 보유.
- 하드코딩 색상 금지, any 금지, 미사용 import 금지.

---

## Task 1: blankDocument 유형 분기 + platform 섹션 + multiline kind

**Files:**
- Modify: `src/features/quotes/document-schema.ts`
- Test: `src/features/quotes/__tests__/document-schema.test.ts`

**Interfaces:**
- Produces: `blankDocument`가 type별 섹션 반환(dev/fee=simple 4열, platform=기능나열). `quoteColumnSchema.kind`에 `"multiline"` 추가.

- [ ] **Step 1: kind에 multiline 추가** — `quoteColumnSchema`의 `kind: z.enum([...])`에 `"multiline"` 추가.

- [ ] **Step 2: RED 테스트** (`document-schema.test.ts`에 추가)
```ts
describe("blankDocument platform", () => {
  it("platform 섹션 컬럼 = 구분·세부서비스·기능명세·기간·수량·금액", () => {
    const d = blankDocument("platform");
    expect(d.type).toBe("platform");
    const keys = d.sections[0].columns.map((c) => c.key);
    expect(keys).toEqual(["category", "service", "features", "period", "qty", "amount"]);
    const amountCol = d.sections[0].columns.find((c) => c.key === "amount");
    expect(amountCol?.kind).toBe("amount");
    const featCol = d.sections[0].columns.find((c) => c.key === "features");
    expect(featCol?.kind).toBe("multiline");
    expect(quoteDocumentSchema.safeParse(d).success).toBe(true);
  });
  it("dev는 기존 simple 4열 유지", () => {
    const d = blankDocument("dev");
    expect(d.sections[0].columns.map((c) => c.key)).toEqual(["category", "detail", "note", "amount"]);
  });
});
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/features/quotes/__tests__/document-schema.test.ts` → FAIL

- [ ] **Step 4: blankDocument 분기 구현** — 기존 `blankDocument`를 type별 섹션 분기로:
```ts
function simpleSection() {
  return {
    id: "main",
    title: "견적 내역",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "detail", label: "상세내역", kind: "text" as const },
      { key: "note", label: "비고", kind: "text" as const },
      { key: "amount", label: "비용", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}
function platformSection() {
  return {
    id: "main",
    title: "서비스 내역",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "service", label: "세부서비스", kind: "text" as const },
      { key: "features", label: "기능명세", kind: "multiline" as const },
      { key: "period", label: "기간", kind: "text" as const },
      { key: "qty", label: "수량", kind: "text" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ],
    rows: [],
    subtotal: 0,
  };
}
export function blankDocument(type: QuoteType): QuoteDocument {
  const sections =
    type === "platform" ? [platformSection()] : [simpleSection()];
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
    sections,
    totals: { supply: 0, vat: 0, total: 0, vatIncluded: false },
    terms: [],
  };
}
```
(labor는 SP3에서 분기 추가 — 현재는 simple로 폴백.)

- [ ] **Step 5: 통과 + 검증** — vitest PASS, typecheck 0, eslint 0

- [ ] **Step 6: Commit** — `feat(quotes): platform 섹션 + multiline 컬럼 kind`

---

## Task 2: 에디터 유형 선택기 + multiline 셀

**Files:**
- Modify: `src/app/dashboard/quotes/[id]/_components/QuoteDocumentEditor.tsx`

**Interfaces:**
- Consumes: `QUOTE_TYPE_LABELS`, `QUOTE_TYPES`, `blankDocument` (document-schema).

- [ ] **Step 1: 유형 선택기** — 에디터 상단(머리말 위 또는 액션바)에 유형 select 추가:
  - 옵션 = `QUOTE_TYPES.map(t => ({ value: t, label: QUOTE_TYPE_LABELS[t] }))`.
  - 현재 `quoteType` state. 변경 시: **모든 섹션 rows가 비어있으면** `blankDocument(newType)`로 document 교체(머리말·약관은 보존). rows가 하나라도 있으면 `window.confirm` 경고 후 진행(확인 시 재생성, 취소 시 무시) — 데이터 손실 방지.
  - 디자인: 기존 토큰 select(border-line bg-cream 등).

- [ ] **Step 2: multiline 셀 렌더** — 섹션 표의 셀 렌더에서 컬럼 `kind === "multiline"`이면 `<textarea>`(rows 작게, 자동높이 불필요), 그 외 기존 input(text/number/amount). amount/number는 숫자 입력.

- [ ] **Step 3: 저장 시 quoteType 반영** — 저장 버튼이 현재 `quoteType` state를 `saveQuoteDocument(id, document, quoteType)`에 전달(이미 SP1 구조면 state 연결만 확인).

- [ ] **Step 4: 테스트** — 에디터 테스트(SP1 `__tests__/QuoteDocumentEditor.test.tsx`)에 유형 선택기 렌더 + platform 선택 시 컬럼 변경 케이스 1개 추가(빈 문서 기준). TDD 훅 막으면 기존 테스트 파일 수정이라 통과. 면제 시 `CLAUDE_TDD_ENFORCE=off`.

- [ ] **Step 5: 검증** — typecheck 0, eslint 0, `unset NODE_ENV; npm run build` 성공.

- [ ] **Step 6: Commit** — `feat(quotes): 견적서 유형 선택기 + 기능명세 multiline`

---

## Self-Review
- Spec(SP2=platform) 커버: blankDocument 분기·platform 컬럼·multiline→T1, 에디터 유형선택·multiline 셀→T2.
- 데이터 보존: 유형 변경 시 rows 있으면 confirm — 손실 방지 명시.
- 한글금액 머리말·별도청구: SP1 합계 블록 + 기존 terms 재사용(신규 구조 불필요, YAGNI).
- Type 일관: QuoteType/QuoteDocument(SP1) = blankDocument 분기(T1) = 에디터 선택기(T2).
