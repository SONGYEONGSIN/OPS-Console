# 견적서 양식 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 견적서 문서를 표준 4섹션 양식(시스템이용/인건비 적산/외주비/총비용산출 + 섹션문구 + 안내사항)으로 재구성하고, "+ 새 견적서" 유형 선택 모달 생성 흐름 + Image #12 헤더 + 발신자 상수를 적용한다.

**Architecture:** 기존 Phase2 문서 모델(QuoteDocument jsonb) 확장 — 전 유형 4섹션 고정 + 섹션 note + document guide. 생성은 회의록 NewMeetingButton 동형 모달. 에디터는 타이틀+구분선+2열 헤더+4섹션(행추가/문구)+안내. PDF 반영.

**Tech Stack:** Next.js, zod, Vitest, Tailwind, @react-pdf. 기반: SP1~4 `features/quotes/*`, 에디터, `meetings/_components/NewMeetingButton.tsx`.

## Global Constraints

- 4종 유형 모두 4섹션 구조. 금액은 서버 recompute 단일 경로. 행 자동계산(system=수량×기간×단가, outsource=수량×단가, labor=적산) → amount/direct 읽기전용.
- 발신자 상수: 등록번호 101-86-62676, 주소 서울 종로구 경희궁길 34 진학기획빌딩(Image #12). 담당자 연락처는 header 가변.
- 기존 문서(옛 섹션) 호환: 에디터/PDF가 누락 섹션 폴백. 하드코딩 색상 금지(PDF 제외), any 금지, 미사용 import 금지.

---

## Task 1: 데이터 모델 + 발신자 상수 + 4섹션 + calc

**Files:**
- Modify: `src/features/quotes/sender.ts`, `document-schema.ts`, `calc/index.ts`
- Test: `calc/__tests__/`, `__tests__/document-schema.test.ts`

**Interfaces:**
- Produces: sender 상수 채움. QuoteHeader+(recipientCount/paymentTerms/managerTel/managerEmail). QuoteSection+`note`. QuoteDocument+`guide`. `blankDocument(type)`=4섹션. calc `rowComputed(section,row)`(system/outsource 자동), recompute 반영.

- [ ] **Step 1: sender.ts 채움**
```ts
export const QUOTE_SENDER = {
  company: "주식회사 진학어플라이",
  ceo: "신원근",
  bizNo: "101-86-62676",
  address: "서울 종로구 경희궁길 34 진학기획빌딩",
  tel: "", // 회사 대표번호 미상 — 담당자 연락처는 header
  fax: "",
  email: "",
} as const;
```

- [ ] **Step 2: 스키마 확장** (`document-schema.ts`)
  - `quoteHeaderSchema`에 추가: `recipientCount: z.string().default("")`, `paymentTerms: z.string().default("계약서 항목에 따름")`, `managerTel: z.string().default("")`, `managerEmail: z.string().default("")`.
  - `quoteSectionSchema`에 `note: z.string().default("")`.
  - `quoteDocumentSchema`에 `guide: z.array(z.string()).default([])`.

- [ ] **Step 3: 4섹션 blankDocument** — simpleSection/platformSection/laborSection 대신 4섹션 팩토리:
```ts
function systemSection() {
  return { id: "system", title: "1. 시스템(인프라·장비) 이용", kind: "simple" as const, note: "",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "item", label: "항목", kind: "text" as const },
      { key: "qty", label: "수량", kind: "number" as const },
      { key: "months", label: "기간(월)", kind: "number" as const },
      { key: "unit", label: "단가(원/월)", kind: "number" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ], rows: [], subtotal: 0 };
}
function laborSection() { /* SP3 KOSA 6열 + kind:"labor" + rates + note:"" + title "2. 인건비 (직접인건비·제경비·기술료)" */ }
function outsourceSection() {
  return { id: "outsource", title: "3. 외주비/비용 (장비·실비·수수료)", kind: "simple" as const, note: "",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "item", label: "항목", kind: "text" as const },
      { key: "qty", label: "수량/건수", kind: "number" as const },
      { key: "unit", label: "단가", kind: "number" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ], rows: [], subtotal: 0 };
}
function summarySection() {
  return { id: "summary", title: "4. 총 비용 및 단가 산출", kind: "simple" as const, note: "",
    columns: [
      { key: "category", label: "구분", kind: "text" as const },
      { key: "detail", label: "내역", kind: "text" as const },
      { key: "amount", label: "금액", kind: "amount" as const },
    ], rows: [], subtotal: 0 };
}
export function blankDocument(type: QuoteType): QuoteDocument {
  return {
    type,
    header: { recipient: "", quoteName: "", quoteNo: "", quoteDate: "",
      validUntil: "견적일로부터 30일 이내", manager: "",
      recipientCount: "", paymentTerms: "계약서 항목에 따름", managerTel: "", managerEmail: "" },
    sections: [systemSection(), laborSection(), outsourceSection(), summarySection()],
    totals: { supply: 0, vat: 0, total: 0, vatIncluded: false },
    guide: [],
    terms: [],
  };
}
```
(laborSection은 SP3 정의 재사용 + note:"" + title 변경. 전 유형 동일 4섹션 — type은 라벨/badge용.)

- [ ] **Step 4: calc 행 자동계산** — `rowComputed(section, row)`:
```ts
export function rowComputed(section: QuoteSection, row: Record<string, string|number|null>): number {
  const n = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : 0);
  if (section.kind === "labor") return laborRowDirect(row);
  if (section.id === "system") return Math.round(n("qty") * n("months") * n("unit"));
  if (section.id === "outsource") return Math.round(n("qty") * n("unit"));
  return n("amount"); // summary/기타: 직접입력
}
```
  - `sectionSubtotal`: labor 분기 유지. simple 분기를 `system`/`outsource`는 `rowComputed` 합으로, 그 외는 amount 합. recompute가 각 행 amount(또는 direct) = rowComputed 기입.
  - RED→GREEN 테스트: system 1행(수량2×기간3×단가10000=60000), outsource(수량5×단가2000=10000), labor 적산, summary 직접입력. quoteTotals=Σ.

- [ ] **Step 5: 통과 + 검증** — `npx vitest run src/features/quotes`(전부), typecheck 0, eslint 0

- [ ] **Step 6: Commit** — `feat(quotes): 4섹션 양식 모델 + 발신자 상수 + 행 자동계산`

---

## Task 2: 생성 모달 ("+ 새 견적서" 유형 선택)

**Files:**
- Create: `src/app/dashboard/quotes/_components/NewQuoteButton.tsx`
- Create: `src/features/quotes/document-actions.ts`에 `createQuoteWithType` (또는 actions.ts)
- Modify: `src/app/dashboard/quotes/page.tsx` (버튼 배치)

**Interfaces:**
- Produces: `createQuoteWithType(type: QuoteType): Promise<{ ok: boolean; id?: string; error?: string }>` — 빈 quote insert(quote_type, document=blankDocument(type), customer="", quote_date=today, status='draft') → id 반환. `NewQuoteButton`(모달 → pick → push).

- [ ] **Step 1: createQuoteWithType 액션** — incidents/meetings createX 패턴. `createClient`(RLS), insert 후 `.select("id").single()`로 id 반환. document=recomputeDocument(blankDocument(type)).
- [ ] **Step 2: NewQuoteButton** — `meetings/_components/NewMeetingButton.tsx` 동형: useState 모달 + ModalShell "견적서 유형 선택" + `QUOTE_TYPES.map`(QUOTE_TYPE_LABELS) 버튼 → `createQuoteWithType(type)` → `router.push('/dashboard/quotes/'+id)`. 모달 토큰 재사용. RED 테스트(NewMeetingButton.test 동형) 또는 면제.
- [ ] **Step 3: 목록 배치** — page.tsx ListPattern 헤더/액션에 `<NewQuoteButton/>` 추가(기존 인스펙터 blank 생성과 병존 — 둘 다 유지).
- [ ] **Step 4: 검증** — typecheck/eslint/build/test.
- [ ] **Step 5: Commit** — `feat(quotes): + 새 견적서 유형 선택 모달`

---

## Task 3: 에디터 레이아웃 재구성

**Files:** Modify `src/app/dashboard/quotes/[id]/_components/QuoteDocumentEditor.tsx`

- [ ] **Step 1: 타이틀 + 구분선** — 최상단 "견적서"(text-2xl font-bold text-ink, 중앙) + `border-b border-ink` 구분선.
- [ ] **Step 2: 공통 헤더 2열**(Image #12) — `grid grid-cols-2`: 좌(수신·견적명·접수인원·견적비용[totals.total 파생, font-bold text-vermilion]·견적일자·유효기간·결제조건 입력) / 우(법인명·대표이사·등록번호·주소=QUOTE_SENDER 읽기전용 / 담당자·전화·이메일=managerTel/Email 입력). `border-b` 구분선.
- [ ] **Step 3: 4섹션 렌더** — 기존 SectionTable 재사용(컬럼 기반). 각 섹션: 제목 + 표(행 추가/삭제) + **섹션 문구 textarea**(`section.note` → updateDoc). labor 섹션 등급 드롭다운+적산 블록(SP3) 유지. amount/direct 읽기전용(rowComputed 자동값 formatKrw).
- [ ] **Step 4: 안내사항(guide)** — 최하단 라인 추가/삭제 텍스트(기존 terms UI 패턴 → guide로). "산출 근거 및 주의 안내사항" 제목.
- [ ] **Step 5: 합계** — 헤더 견적비용(파생) + (옵션)하단 합계 블록 유지. 유형선택기·저장·PDF 버튼 유지.
- [ ] **Step 6: 검증** — typecheck/eslint/build(/dashboard/quotes/[id]). 기존 에디터 테스트 갱신/통과. TDD 훅 막으면 `CLAUDE_TDD_ENFORCE=off`.
- [ ] **Step 7: Commit** — `feat(quotes): 견적서 에디터 4섹션 양식 레이아웃`

---

## Task 4: PDF 새 레이아웃

**Files:** Modify `src/lib/pdf/quote-pdf.tsx`

- [ ] **Step 1** — 타이틀 "견적서"(bold 대) + 구분선, 2열 헤더(좌 견적정보/우 발신자 상수+담당자), 4섹션(제목·표·note), 안내사항(guide), 합계+한글금액. labor 적산 블록 유지. 발신자 상수 채움값.
- [ ] **Step 2: 검증** — `npx vitest run src/lib/pdf`(버퍼 생성), typecheck/eslint/build.
- [ ] **Step 3: Commit** — `feat(quotes): PDF 4섹션 양식 반영`

---

## Self-Review
- 8 요구 매핑: 모달→T2, 타이틀+구분선(#2)→T3-1, 헤더+구분선(#3)→T3-2, 4섹션 행추가+문구(#4~7)→T1(모델)+T3-3, 안내사항(#8)→T1(guide)+T3-4. 발신자 상수→T1. PDF→T4.
- 전 유형 4섹션(결정), 행 자동계산 calc TDD. 기존 문서 폴백.
- Type 일관: QuoteDocument(guide/section.note/4섹션) = calc = 에디터 = PDF.
