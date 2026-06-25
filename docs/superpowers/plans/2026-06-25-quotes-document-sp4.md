# 견적서 문서 양식 SP4(PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 견적서 문서(4유형)를 PDF로 출력한다 — `renderQuotePdf`(react-pdf) + 다운로드 라우트 + 상세 페이지 PDF 버튼.

**Architecture:** meeting-pdf/handover-pdf 패턴. `lib/pdf/quote-pdf.tsx`가 QuoteDocument(머리말+섹션표+합계+약관, labor는 적산 블록)를 react-pdf로 렌더. `/api/quotes/[id]/pdf` 라우트가 getQuoteDocument→renderToBuffer→application/pdf. 에디터/View에 PDF 링크.

**Tech Stack:** @react-pdf/renderer, Pretendard 폰트. 기반: `src/lib/pdf/handover-pdf.tsx`(다중표·고정 header/footer 참조), `src/app/api/meetings/[id]/pdf/route.ts`(라우트 패턴).

## Global Constraints

- 금액 표시는 calc 값 사용(서버 저장 document의 totals/subtotal). PDF는 재계산하지 않고 저장값 렌더(서버 recompute가 이미 신뢰값). 단 표시 일관 위해 `recomputeDocument`로 한 번 정규화 후 렌더 가능.
- 브랜드/발신자: `QUOTE_SENDER` 상수. Pretendard Regular+Bold, 고정 footer(페이지 번호). handover-pdf 폰트 등록 재사용.
- 하드코딩 색상은 PDF StyleSheet 특성상 hex 허용(react-pdf는 토큰 미지원) — 단 기존 pdf 파일들의 색상 팔레트와 일관.
- 4유형(simple dev/fee, platform, labor) 컬럼 가변 → 섹션 columns 기반 동적 표 렌더.

---

## Task 1: quote-pdf.tsx (4유형 렌더)

**Files:**
- Create: `src/lib/pdf/quote-pdf.tsx`
- Test: `src/lib/pdf/__tests__/quote-pdf.test.ts`

**Interfaces:**
- Consumes: `QuoteDocument`, `QUOTE_SENDER`, `koreanAmount`, `laborRollup`, `laborRowDirect`, `recomputeDocument`.
- Produces: `renderQuotePdf(input: { document: QuoteDocument; customer: string }): JSX.Element`(react-pdf Document).

- [ ] **Step 1: handover-pdf 학습** — `src/lib/pdf/handover-pdf.tsx`를 Read해 Font.register(Pretendard 경로 `public/fonts/`), StyleSheet, Document/Page, 다중 섹션 표, fixed footer(`render={({pageNumber,totalPages})=>...}`) 패턴 파악.

- [ ] **Step 2: RED 테스트** (`__tests__/quote-pdf.test.ts` — meeting-pdf.test 패턴: renderToBuffer가 PDF 버퍼 생성)
```ts
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderQuotePdf } from "../quote-pdf";
import { blankDocument } from "@/features/quotes/document-schema";

describe("renderQuotePdf", () => {
  it("dev 문서 → PDF 버퍼 생성", async () => {
    const doc = {
      ...blankDocument("dev"),
      sections: [{ id: "main", title: "견적 내역", kind: "simple" as const,
        columns: blankDocument("dev").sections[0].columns,
        rows: [{ category: "개발", detail: "시스템 구축", note: "", amount: 1000000 }], subtotal: 0 }],
    };
    const buf = await renderToBuffer(renderQuotePdf({ document: doc, customer: "가천대" }));
    expect(buf.length).toBeGreaterThan(1000);
  });
  it("labor 문서 → PDF 버퍼 생성(적산 포함)", async () => {
    const doc = {
      ...blankDocument("labor"),
      sections: blankDocument("labor").sections.map((s) => ({
        ...s, rows: [{ role: "기획", count: 1, daily: 578206, days: 10, ratio: 1, direct: null }],
      })),
    };
    const buf = await renderToBuffer(renderQuotePdf({ document: doc, customer: "국평원" }));
    expect(buf.length).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/lib/pdf/__tests__/quote-pdf.test.ts` → FAIL

- [ ] **Step 4: quote-pdf.tsx 구현** — handover-pdf 구조 차용. 렌더 요소(저장 전 `recomputeDocument`로 정규화):
  - **머리말**: 문서 제목 "견 적 서", 수신·견적명·견적번호·견적일·유효기간·담당(document.header), 발신자(QUOTE_SENDER company/ceo/address/tel/fax/email — 빈 값은 생략).
  - **섹션 표**(각 section): 제목 + columns 헤더(label) + rows(셀 값, amount/direct는 천단위 콤마). labor 섹션은 행에 인원·단가·투입일·참여율·직접인건비(laborRowDirect) 표시 + 섹션 아래 **적산 블록**(직접합·제경비·기술료·인건비합계, laborRollup(rates)).
  - **합계**: 공급가·부가세·합계(document.totals) + 한글금액(`일금 {koreanAmount(total)} 원정 (VAT 포함)`).
  - **약관**: terms 라인(가/나/다 또는 ※).
  - 고정 footer: 페이지 번호 + `[운영부 상황실]` 또는 발신자명.
  - Pretendard 폰트 등록(handover-pdf와 동일 경로).

- [ ] **Step 5: 통과 + 검증** — `npx vitest run src/lib/pdf/__tests__/quote-pdf.test.ts`(PASS), `npm run typecheck` 0, `npx eslint src/lib/pdf/quote-pdf.tsx` 0

- [ ] **Step 6: Commit** — `feat(quotes): 견적서 PDF 렌더(4유형)`

---

## Task 2: 다운로드 라우트 + 상세 PDF 버튼

**Files:**
- Create: `src/app/api/quotes/[id]/pdf/route.ts`
- Modify: 상세 에디터 또는 quotes View에 PDF 링크

**Interfaces:**
- Consumes: `getQuoteDocument`, `renderQuotePdf`, `renderToBuffer`.

- [ ] **Step 1: 라우트** (`/api/quotes/[id]/pdf/route.ts` — meeting pdf route 동형)
```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { getQuoteDocument } from "@/features/quotes/document-queries";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { blankDocument } from "@/features/quotes/document-schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const q = await getQuoteDocument(id);
  if (!q) return new Response("not found", { status: 404 });
  const document = q.document ?? blankDocument(q.quoteType);
  const buffer = await renderToBuffer(
    renderQuotePdf({ document, customer: q.customer }),
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${id}.pdf"`,
    },
  });
}
```

- [ ] **Step 2: PDF 버튼** — 상세 에디터(QuoteDocumentEditor 상단바) 또는 page에 `<a href="/api/quotes/{id}/pdf" target="_blank">PDF</a>` 추가(기존 저장 버튼 옆, 토큰 버튼 스타일). 저장 후 PDF가 최신이도록 — 안내(저장 먼저) 또는 단순 링크.

- [ ] **Step 3: 검증** — `npm run typecheck` 0, eslint 0, `unset NODE_ENV; npm run build` 성공(`/api/quotes/[id]/pdf` 라우트). 빌드에서 라우트 확인.

- [ ] **Step 4: Commit** — `feat(quotes): 견적서 PDF 다운로드 라우트 + 버튼`

---

## Self-Review
- Spec(SP4=PDF) 커버: 렌더 컴포넌트→T1, 라우트·버튼→T2.
- 4유형 가변 표: section.columns 기반 동적 렌더. labor 적산 블록 + 한글금액.
- 금액: 저장 document 값 사용(서버 recompute 신뢰), 표시 정규화는 recomputeDocument.
- 패턴 일관: handover-pdf(폰트·footer)·meeting route 동형. PDF StyleSheet hex는 react-pdf 특성상 허용.
