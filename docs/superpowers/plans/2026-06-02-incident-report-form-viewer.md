# 경위서 실제 양식 뷰어/편집 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인스펙터 경위서를 실제 Word 양식 모양 그대로 보여주고, 좌측 편집 필드를 고치면 우측 A4 양식 미리보기에 실시간 반영되는 전체화면 모달을 추가한다.

**Architecture:** 보일러플레이트 문구·파생 로직을 pure 모듈(`form-content.ts`) 단일 소스로 두고, HTML 미리보기(client)와 PDF 렌더러(server)가 모두 이를 소비해 "보는 것 = 보내는 것"을 보장한다. 모달은 로컬 draft 상태로 편집→미리보기 라이브 갱신, 저장 시 `updateIncidentReport` 호출.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS 4(디자인 토큰: ink/cream/line/washi/muted/vermilion/sage), @react-pdf/renderer, Vitest + React Testing Library, zod.

**참고 스펙:** `docs/superpowers/specs/2026-06-02-incident-report-form-viewer-design.md`

---

## 파일 구조

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `src/features/incident-reports/form-content.ts` | 보일러플레이트 상수 + `deriveFormModel` 파생 (pure, client-safe) | 신규 |
| `src/features/incident-reports/__tests__/form-content.test.ts` | 파생 로직 단위 테스트 | 신규 |
| `src/lib/pdf/incident-report-pdf.tsx` | PDF 2장 렌더 — `form-content` 소비, 실제 양식 요소 추가 | 수정 |
| `src/app/api/incident-reports/[id]/pdf/route.ts` | 경위서 PDF 다운로드(inline) GET 라우트 | 신규 |
| `src/app/dashboard/incident-reports/_row-mapper.ts` | `incidentReportDocNumber` 매핑 1줄 | 수정 |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | ListRow에 `incidentReportDocNumber` 타입 1줄 | 수정 |
| `.../inspector/list-variants/incident-reports/FormPreview.tsx` | A4 2장 HTML 양식 (순수 표현) | 신규 |
| `.../incident-reports/__tests__/FormPreview.test.tsx` | 렌더 테스트 | 신규 |
| `.../incident-reports/FormModal.tsx` | 편집↔미리보기 오케스트레이션 + 저장/PDF | 신규 |
| `.../incident-reports/__tests__/FormModal.test.tsx` | 편집 반영/저장/읽기전용 테스트 | 신규 |
| `.../incident-reports/View.tsx` | "양식으로 보기" 버튼 + 모달 마운트 | 수정 |

---

## Task 1: 공유 콘텐츠 모듈 `form-content.ts`

**Files:**
- Create: `src/features/incident-reports/form-content.ts`
- Test: `src/features/incident-reports/__tests__/form-content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/incident-reports/__tests__/form-content.test.ts
import { describe, it, expect } from "vitest";
import {
  deriveFormModel,
  greeting,
  jeonkyeolDate,
  DEFAULT_APOLOGY,
  type FormSource,
} from "../form-content";

const base: FormSource = {
  recipientUniversity: "건국대학교",
  title: "전산파일 오류 건",
  draftDate: "2026-06-02",
  authorName: "이해영",
  approverName: "송영신",
  directorName: null,
  ceoName: null,
  docNumber: null,
  apology: null,
  gyeongwi: "경위 내용",
  cause: "원인 내용",
  handling: "처리 내용",
  prevention: "대책 내용",
};

describe("greeting", () => {
  it("대학명을 인사말에 삽입한다", () => {
    expect(greeting("건국대학교")).toBe("건국대학교의 무궁한 발전을 기원합니다.");
  });
});

describe("jeonkyeolDate", () => {
  it("YYYY-MM-DD를 MM/DD로 변환한다", () => {
    expect(jeonkyeolDate("2026-06-02")).toBe("06/02");
  });
  it("'YYYY. MM. DD' 형식도 변환한다", () => {
    expect(jeonkyeolDate("2025. 02. 13")).toBe("02/13");
  });
});

describe("deriveFormModel", () => {
  it("apology가 null이면 기본 문구를 쓴다", () => {
    expect(deriveFormModel(base).apology).toBe(DEFAULT_APOLOGY);
  });
  it("apology 입력이 있으면 그 값을 우선한다", () => {
    expect(deriveFormModel({ ...base, apology: "직접 사과문" }).apology).toBe(
      "직접 사과문",
    );
  });
  it("4섹션을 번호·라벨·본문으로 만든다", () => {
    const m = deriveFormModel(base);
    expect(m.sections).toHaveLength(4);
    expect(m.sections[0]).toEqual({ no: 1, label: "경위", body: "경위 내용" });
    expect(m.sections[3].label).toBe("향후 대책");
  });
  it("결재라인 4칸을 채운다(빈 값은 빈 문자열)", () => {
    const m = deriveFormModel(base);
    expect(m.approvalLine).toEqual([
      { role: "담당자", name: "이해영" },
      { role: "팀장", name: "송영신" },
      { role: "본부장", name: "" },
      { role: "사장", name: "" },
    ]);
  });
  it("붙임 라인에 제목을 넣는다", () => {
    expect(deriveFormModel(base).attachment).toBe(
      "붙임 : 1. 전산파일 오류 건 경위서 1부.  끝.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/incident-reports/__tests__/form-content.test.ts`
Expected: FAIL — Cannot find module `../form-content`

- [ ] **Step 3: Write the implementation**

```ts
// src/features/incident-reports/form-content.ts
// 경위서 양식 콘텐츠 단일 소스 — HTML 미리보기(client)와 PDF 렌더러(server)가 공유한다.
// server-only 금지: 양쪽에서 import.

export type FormSource = {
  recipientUniversity: string;
  title: string;
  draftDate: string;
  authorName: string;
  approverName: string | null;
  directorName: string | null;
  ceoName: string | null;
  docNumber: string | null;
  apology: string | null;
  gyeongwi: string | null;
  cause: string | null;
  handling: string | null;
  prevention: string | null;
};

export const BRAND_HEADER =
  "대한민국 대표 원서접수 사이트 진학어플라이 · 대한민국 최대 입시전문 포탈사이트 진학닷컴";
export const COMPANY_LINE = "(주)진학어플라이 대표이사";
export const CONTACT_LINES = [
  "주 소 (우)03175 서울시 종로구 경복궁길 34 진학기획빌딩",
  "홈페이지 www.jinhakapply.com",
  "전 화 (02)2013-0669 ㅣ 전 송 (02)722-5453 ㅣ 공 개",
] as const;
export const DEFAULT_APOLOGY =
  "귀교의 서비스 제공 중 발생한 오류로 업무에 불편을 드린 점 진심으로 사과드립니다. 향후 유사한 문제가 재발하지 않도록 서비스 프로세스를 개선하고 더 나은 서비스 제공을 위하여 최선의 노력을 다하겠습니다.";
export const CLOSING =
  "이번 오류로 업무에 불편을 드린 점 거듭 사과드립니다. 향후 이러한 문제가 다시 발생하지 않도록 하겠습니다.";

const SECTION_LABELS = ["경위", "원인", "처리", "향후 대책"] as const;

export function greeting(university: string): string {
  return `${university}의 무궁한 발전을 기원합니다.`;
}

/** draftDate("2026-06-02" | "2025. 02. 13") → "MM/DD". 숫자 그룹이 3개 미만이면 "". */
export function jeonkyeolDate(draftDate: string): string {
  const nums = draftDate.match(/\d+/g);
  if (!nums || nums.length < 3) return "";
  const [, mm, dd] = nums;
  return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}`;
}

export type FormModel = {
  brandHeader: string;
  recipientUniversity: string;
  title: string;
  greeting: string;
  apology: string;
  attachment: string;
  companyLine: string;
  jeonkyeolDate: string;
  approvalLine: { role: string; name: string }[];
  docNumber: string | null;
  contactLines: readonly string[];
  draftDate: string;
  authorName: string;
  sections: { no: number; label: string; body: string }[];
  closing: string;
};

export function deriveFormModel(s: FormSource): FormModel {
  return {
    brandHeader: BRAND_HEADER,
    recipientUniversity: s.recipientUniversity,
    title: s.title,
    greeting: greeting(s.recipientUniversity),
    apology: s.apology && s.apology.trim() ? s.apology : DEFAULT_APOLOGY,
    attachment: `붙임 : 1. ${s.title} 경위서 1부.  끝.`,
    companyLine: COMPANY_LINE,
    jeonkyeolDate: jeonkyeolDate(s.draftDate),
    approvalLine: [
      { role: "담당자", name: s.authorName },
      { role: "팀장", name: s.approverName ?? "" },
      { role: "본부장", name: s.directorName ?? "" },
      { role: "사장", name: s.ceoName ?? "" },
    ],
    docNumber: s.docNumber,
    contactLines: CONTACT_LINES,
    draftDate: s.draftDate,
    authorName: s.authorName,
    sections: [
      { no: 1, label: SECTION_LABELS[0], body: s.gyeongwi ?? "" },
      { no: 2, label: SECTION_LABELS[1], body: s.cause ?? "" },
      { no: 3, label: SECTION_LABELS[2], body: s.handling ?? "" },
      { no: 4, label: SECTION_LABELS[3], body: s.prevention ?? "" },
    ],
    closing: CLOSING,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/incident-reports/__tests__/form-content.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/incident-reports/form-content.ts src/features/incident-reports/__tests__/form-content.test.ts
git commit -m "feat(incident-reports): 경위서 양식 콘텐츠 단일 소스 모듈"
```

---

## Task 2: PDF 템플릿이 `form-content` 소비 + 실제 양식 요소 추가

**Files:**
- Modify: `src/lib/pdf/incident-report-pdf.tsx`
- Test: `src/lib/pdf/__tests__/incident-report-pdf.test.ts`

> @react-pdf는 바이너리 PDF를 만들어 텍스트 단언이 어렵다. 콘텐츠 정확성은 Task 1의 `form-content.test.ts`가 담당하고, 여기서는 신규 필드를 포함해 렌더가 깨지지 않고 비어있지 않은 Buffer를 반환하는지 검증한다.

- [ ] **Step 1: Add the failing test**

기존 `incident-report-pdf.test.ts` 끝에 추가:

```ts
import { renderIncidentReportPdf } from "../incident-report-pdf";

it("실제 양식 요소(인사말/회사명/연락처)가 포함되어도 정상 렌더된다", async () => {
  const buf = await renderIncidentReportPdf({
    recipientUniversity: "건국대학교",
    title: "전산파일 오류 건",
    draftDate: "2026-06-02",
    authorName: "이해영",
    approverName: "송영신",
    directorName: "이이화",
    ceoName: "주정현",
    docNumber: "서비스사업2606-0201(2026. 06. 02)",
    apology: "",
    gyeongwi: "경위",
    cause: "원인",
    handling: "처리",
    prevention: "대책",
  });
  expect(Buffer.isBuffer(buf)).toBe(true);
  expect(buf.byteLength).toBeGreaterThan(1000);
});
```

- [ ] **Step 2: Run test to verify it fails or passes-trivially**

Run: `npm test -- src/lib/pdf/__tests__/incident-report-pdf.test.ts`
Expected: 신규 케이스는 PASS 가능(렌더 자체는 동작). 본 Task의 목적은 Step 3 리팩토링 후에도 GREEN을 유지하는 것. Step 3 적용 전 베이스라인으로 한 번 실행해 통과 확인.

- [ ] **Step 3: Refactor template to consume `form-content` and add real-form elements**

`incident-report-pdf.tsx` 상단 import에 추가:

```tsx
import { deriveFormModel, type FormSource } from "@/features/incident-reports/form-content";
```

`renderIncidentReportPdf` 본문에서 `ensureFontRegistered()` 직후 모델을 만든다:

```tsx
ensureFontRegistered();
const m = deriveFormModel(input as FormSource);
```

styles에 다음 키를 추가(기존 StyleSheet.create 객체 내):

```tsx
greeting: { marginBottom: 6 },
companyLine: { marginTop: 18, fontWeight: 700 },
jeonkyeol: { fontSize: 8.5, color: "#6b6253", marginBottom: 4 },
contact: { marginTop: 10, fontSize: 8, color: "#6b6253", lineHeight: 1.5 },
```

① 공문 페이지를 아래로 교체(브랜드 헤더~footer 사이):

```tsx
<Text style={styles.brand} fixed>{m.brandHeader}</Text>
<Text style={styles.row}>수신자  {m.recipientUniversity}</Text>
<Text style={styles.row}>참  조</Text>
<Text style={styles.row}>제  목  {m.title}</Text>
<Text style={styles.greeting}>{m.greeting}</Text>
<Text style={styles.apology}>{m.apology}</Text>
<Text style={styles.row}>{m.attachment}</Text>
<Text style={styles.companyLine}>{m.companyLine}</Text>
<Text style={styles.jeonkyeol}>전결 {m.jeonkyeolDate}</Text>
<View style={styles.approvalTable}>
  {m.approvalLine.map((a, i) => (
    <Text
      key={a.role}
      style={i === m.approvalLine.length - 1 ? styles.approvalCellLast : styles.approvalCell}
    >
      {a.role}{"\n"}{a.name}
    </Text>
  ))}
</View>
{m.docNumber ? <Text style={styles.docNumber}>시행  {m.docNumber}</Text> : null}
<View style={styles.contact}>
  {m.contactLines.map((line) => (
    <Text key={line}>{line}</Text>
  ))}
</View>
<Text style={styles.footer} fixed>운영부 상황실 · 자동 발송 문서</Text>
```

② 경위서 본문 페이지의 섹션을 모델 기반으로 교체:

```tsx
<Text style={styles.reportTitle}>경 위 서</Text>
<Text style={styles.row}>
  작 성 일 자 : {m.draftDate}      작 성 자 : {m.authorName}
</Text>
<Text style={[styles.row, styles.bold]}>제    목 : {m.title}</Text>
{m.sections.map((sec) => (
  <View key={sec.no} wrap={false}>
    <Text style={styles.sectionH}>{sec.no}. {sec.label}</Text>
    <Text style={styles.sectionBody}>{sec.body}</Text>
  </View>
))}
<Text style={styles.apology}>{m.closing}</Text>
<Text style={styles.footer} fixed>운영부 상황실 · 자동 발송 문서</Text>
```

기존 로컬 `Section` 컴포넌트(파일 내 `function Section`)는 더 이상 쓰이지 않으면 제거한다(본인 변경이 만든 orphan).

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/pdf/__tests__/incident-report-pdf.test.ts`
Expected: PASS (기존 + 신규 케이스)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/incident-report-pdf.tsx src/lib/pdf/__tests__/incident-report-pdf.test.ts
git commit -m "feat(incident-reports): PDF 템플릿 실제 양식 완전 재현 + 콘텐츠 단일 소스화"
```

---

## Task 3: 경위서 PDF 다운로드 라우트

**Files:**
- Create: `src/app/api/incident-reports/[id]/pdf/route.ts`

> `/api/reports/[id]/pdf`는 다른 도메인이다. 경위서 전용 라우트를 신규 추가한다. `getIncidentReport`는 타입 없는 row를 반환하므로 `IncidentReportRow`로 캐스팅한다.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/incident-reports/[id]/pdf/route.ts
import { NextResponse } from "next/server";
import { getIncidentReport } from "@/features/incident-reports/queries";
import { renderIncidentReportPdf } from "@/lib/pdf/incident-report-pdf";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rep = (await getIncidentReport(id)) as IncidentReportRow | null;
  if (!rep) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const pdf = await renderIncidentReportPdf({
    recipientUniversity: rep.recipient_university,
    title: rep.title,
    draftDate: rep.draft_date,
    authorName: rep.author_name,
    approverName: rep.approver_name,
    directorName: rep.director_name,
    ceoName: rep.ceo_name,
    docNumber: rep.doc_number,
    apology: rep.apology ?? "",
    gyeongwi: rep.gyeongwi,
    cause: rep.cause,
    handling: rep.handling,
    prevention: rep.prevention,
  });
  const safeTitle = rep.title.replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "_").slice(0, 60);
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeTitle)}.pdf`,
    },
  });
}
```

- [ ] **Step 2: Verify typecheck + build of route**

Run: `npm run typecheck`
Expected: PASS (에러 없음)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/incident-reports/\[id\]/pdf/route.ts
git commit -m "feat(incident-reports): 경위서 PDF 다운로드 라우트"
```

---

## Task 4: ListRow에 `incidentReportDocNumber` 추가

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` (incidentReport 필드 블록, ~341행 근처)
- Modify: `src/app/dashboard/incident-reports/_row-mapper.ts`

> 시행번호를 미리보기에 반영하려면 ListRow가 운반해야 한다. 타입 정의만 변경(런타임 영향 없음) → TDD 예외, 매핑은 Task 6 테스트에서 간접 검증.

- [ ] **Step 1: Add the type field**

`ListPattern.tsx`의 `incidentReportIncidentId?: string | null;` 다음 줄에 추가:

```ts
  incidentReportDocNumber?: string | null;
```

- [ ] **Step 2: Map it in the row mapper**

`_row-mapper.ts`의 `incidentReportIncidentId: r.incident_id,` 다음 줄에 추가:

```ts
    incidentReportDocNumber: r.doc_number,
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/incident-reports/_row-mapper.ts
git commit -m "feat(incident-reports): ListRow에 시행번호(docNumber) 운반 추가"
```

---

## Task 5: `FormPreview` — A4 2장 HTML 양식

**Files:**
- Create: `.../inspector/list-variants/incident-reports/FormPreview.tsx`
- Test: `.../inspector/list-variants/incident-reports/__tests__/FormPreview.test.tsx`

경로 베이스: `src/app/dashboard/_components/inspector/list-variants/incident-reports/`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/FormPreview.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { FormPreview } from "../FormPreview";
import { DEFAULT_APOLOGY } from "@/features/incident-reports/form-content";

const row: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "전산파일 오류 건",
  status: "active",
  incidentReportUniversity: "건국대학교",
  incidentReportTitle: "전산파일 오류 건",
  incidentReportDraftDate: "2026-06-02",
  incidentReportAuthorName: "이해영",
  incidentReportApproverName: "송영신",
  incidentReportGyeongwi: "경위 내용입니다",
  incidentReportCause: "원인 내용입니다",
  incidentReportHandling: "처리 내용입니다",
  incidentReportPrevention: "대책 내용입니다",
  incidentReportApology: null,
};

describe("FormPreview", () => {
  it("수신대학·제목·인사말을 공문에 렌더한다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText(/건국대학교/)).toBeInTheDocument();
    expect(
      screen.getByText("건국대학교의 무궁한 발전을 기원합니다."),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/전산파일 오류 건/).length).toBeGreaterThan(0);
  });

  it("4섹션 본문을 모두 렌더한다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText("경위 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("원인 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("처리 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("대책 내용입니다")).toBeInTheDocument();
  });

  it("apology 미입력 시 기본 사과 문구를 보인다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText(DEFAULT_APOLOGY)).toBeInTheDocument();
  });

  it("결재라인 4칸을 보인다", () => {
    render(<FormPreview row={row} />);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("팀장")).toBeInTheDocument();
    expect(screen.getByText("본부장")).toBeInTheDocument();
    expect(screen.getByText("사장")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormPreview.test.tsx`
Expected: FAIL — Cannot find module `../FormPreview`

- [ ] **Step 3: Write the component**

```tsx
// FormPreview.tsx
"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { deriveFormModel, type FormSource } from "@/features/incident-reports/form-content";

function rowToFormSource(row: ListRow): FormSource {
  return {
    recipientUniversity: row.incidentReportUniversity ?? "",
    title: row.incidentReportTitle ?? "",
    draftDate: row.incidentReportDraftDate ?? "",
    authorName: row.incidentReportAuthorName ?? "",
    approverName: row.incidentReportApproverName ?? null,
    directorName: row.incidentReportDirectorName ?? null,
    ceoName: row.incidentReportCeoName ?? null,
    docNumber: row.incidentReportDocNumber ?? null,
    apology: row.incidentReportApology ?? null,
    gyeongwi: row.incidentReportGyeongwi ?? null,
    cause: row.incidentReportCause ?? null,
    handling: row.incidentReportHandling ?? null,
    prevention: row.incidentReportPrevention ?? null,
  };
}

/** A4 한 장 — 흰 종이 느낌의 문서 면 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] border border-line bg-cream px-10 py-12 text-sm leading-relaxed text-ink shadow-sm">
      {children}
    </div>
  );
}

export function FormPreview({ row }: { row: ListRow }) {
  const m = deriveFormModel(rowToFormSource(row));

  return (
    <div className="space-y-6">
      {/* ① 공문 */}
      <Sheet>
        <p className="mb-5 text-center text-2xs text-muted">{m.brandHeader}</p>
        <p>수신자&nbsp;&nbsp;{m.recipientUniversity}</p>
        <p>참&nbsp;&nbsp;조</p>
        <p>제&nbsp;&nbsp;목&nbsp;&nbsp;{m.title}</p>
        <p className="mt-3">{m.greeting}</p>
        <p className="my-3 whitespace-pre-wrap">{m.apology}</p>
        <p>{m.attachment}</p>
        <p className="mt-6 font-bold">{m.companyLine}</p>
        <p className="text-2xs text-muted">전결 {m.jeonkyeolDate}</p>
        <div className="mt-3 flex border-y border-ink">
          {m.approvalLine.map((a, i) => (
            <div
              key={a.role}
              className={`flex-1 px-1 py-2 text-center text-2xs ${
                i < m.approvalLine.length - 1 ? "border-r border-line" : ""
              }`}
            >
              <div>{a.role}</div>
              <div className="mt-1">{a.name}</div>
            </div>
          ))}
        </div>
        {m.docNumber ? (
          <p className="mt-3 text-xs">시행&nbsp;&nbsp;{m.docNumber}</p>
        ) : null}
        <div className="mt-5 space-y-0.5 text-2xs text-muted">
          {m.contactLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Sheet>

      {/* ② 경위서 본문 */}
      <Sheet>
        <p className="mb-5 text-center text-xl font-bold tracking-[0.5em]">
          경 위 서
        </p>
        <p>
          작 성 일 자 : {m.draftDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;작 성 자 :{" "}
          {m.authorName}
        </p>
        <p className="font-bold">제&nbsp;&nbsp;&nbsp;&nbsp;목 : {m.title}</p>
        <div className="mt-4 space-y-4">
          {m.sections.map((sec) => (
            <div key={sec.no}>
              <p className="font-bold">
                {sec.no}. {sec.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{sec.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 whitespace-pre-wrap">{m.closing}</p>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormPreview.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/list-variants/incident-reports/FormPreview.tsx src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormPreview.test.tsx
git commit -m "feat(incident-reports): A4 2장 HTML 양식 미리보기 컴포넌트"
```

---

## Task 6: `FormModal` — 편집 ↔ 미리보기 + 저장/PDF

**Files:**
- Create: `.../incident-reports/FormModal.tsx`
- Test: `.../incident-reports/__tests__/FormModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/FormModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));
vi.mock("@/features/incident-reports/actions", () => ({
  updateIncidentReport: mockUpdate,
}));

import { FormModal } from "../FormModal";

const row: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "원서 오류",
  status: "active",
  incidentReportStatus: "draft",
  incidentReportUniversity: "건국대학교",
  incidentReportTitle: "원서 오류",
  incidentReportDraftDate: "2026-06-02",
  incidentReportAuthorName: "이해영",
  incidentReportGyeongwi: "초기 경위",
};

beforeEach(() => vi.clearAllMocks());

describe("FormModal", () => {
  it("open=false면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <FormModal open={false} onClose={() => {}} row={row} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("경위 필드를 수정하면 미리보기에 즉시 반영된다", () => {
    render(<FormModal open onClose={() => {}} row={row} />);
    const textarea = screen.getByLabelText("경위");
    fireEvent.change(textarea, { target: { value: "수정된 경위 내용" } });
    expect(screen.getByText("수정된 경위 내용")).toBeInTheDocument();
  });

  it("저장 시 편집값으로 updateIncidentReport를 호출한다", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(<FormModal open onClose={() => {}} row={row} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("원인"), {
      target: { value: "새 원인" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        row.id,
        expect.objectContaining({ cause: "새 원인" }),
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("approved 상태면 편집 필드를 노출하지 않는다(읽기 전용)", () => {
    render(
      <FormModal
        open
        onClose={() => {}}
        row={{ ...row, incidentReportStatus: "approved" }}
      />,
    );
    expect(screen.queryByLabelText("경위")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormModal.test.tsx`
Expected: FAIL — Cannot find module `../FormModal`

- [ ] **Step 3: Write the component**

```tsx
// FormModal.tsx
"use client";

import { useState, useTransition } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { FormPreview } from "./FormPreview";
import { updateIncidentReport } from "@/features/incident-reports/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  row: ListRow;
  onSaved?: () => void;
};

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

export function FormModal({ open, onClose, row, onSaved }: Props) {
  const [draft, setDraft] = useState<ListRow>(row);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const status = draft.incidentReportStatus ?? "draft";
  const editable = status === "draft" || status === "rejected";

  function field(key: keyof ListRow, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value || null }));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const r = await updateIncidentReport(row.id, {
        recipient_university: draft.incidentReportUniversity ?? undefined,
        title: draft.incidentReportTitle ?? undefined,
        gyeongwi: draft.incidentReportGyeongwi ?? null,
        cause: draft.incidentReportCause ?? null,
        handling: draft.incidentReportHandling ?? null,
        prevention: draft.incidentReportPrevention ?? null,
        apology: draft.incidentReportApology ?? null,
      });
      if (!r.ok) {
        setError(r.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved?.();
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-label="경위서 양식"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[90vh] w-full max-w-6xl flex-col border border-line bg-washi"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-bold text-ink">
            경위서 — {draft.incidentReportTitle ?? "제목 없음"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="cursor-pointer text-muted hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {editable && (
            <div className="w-80 shrink-0 space-y-3 overflow-y-auto border-r border-line p-4">
              <label className="block text-xs">
                <span className="mb-1 block text-muted">제목</span>
                <input
                  aria-label="제목"
                  value={draft.incidentReportTitle ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      incidentReportTitle: e.target.value,
                    }))
                  }
                  maxLength={200}
                  className={inputClass}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-muted">수신대학</span>
                <input
                  aria-label="수신대학"
                  value={draft.incidentReportUniversity ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      incidentReportUniversity: e.target.value,
                    }))
                  }
                  maxLength={200}
                  className={inputClass}
                />
              </label>
              {(
                [
                  ["경위", "incidentReportGyeongwi"],
                  ["원인", "incidentReportCause"],
                  ["처리", "incidentReportHandling"],
                  ["대책", "incidentReportPrevention"],
                  ["사과 본문", "incidentReportApology"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block text-muted">{label}</span>
                  <textarea
                    aria-label={label}
                    value={(draft[key] as string | null) ?? ""}
                    onChange={(e) => field(key, e.target.value)}
                    rows={4}
                    maxLength={5000}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="min-w-0 flex-1 overflow-y-auto bg-washi-raised p-6">
            <FormPreview row={draft} />
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
          {error && <span className="text-xs text-vermilion">{error}</span>}
          <div className="ml-auto flex gap-2">
            <a
              href={`/api/incident-reports/${row.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
            >
              PDF
            </a>
            {editable && (
              <button
                type="button"
                disabled={pending}
                onClick={onSave}
                className="cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                {pending ? "저장 중…" : "저장"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
            >
              닫기
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormModal.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/list-variants/incident-reports/FormModal.tsx src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormModal.test.tsx
git commit -m "feat(incident-reports): 경위서 양식 편집 모달 (편집↔미리보기 라이브)"
```

---

## Task 7: `IncidentReportView`에 "양식으로 보기" 진입 버튼

**Files:**
- Modify: `.../inspector/list-variants/incident-reports/View.tsx`
- Test: `.../incident-reports/__tests__/View.test.tsx` (기존 파일에 케이스 추가)

- [ ] **Step 1: Add the failing test**

기존 `View.test.tsx`에 모달 모킹과 케이스를 추가. 파일 상단 `vi.mock` 블록 다음에 추가:

```tsx
vi.mock("../FormModal", () => ({
  FormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="form-modal" /> : null,
}));
```

describe 블록 안에 케이스 추가:

```tsx
it("'양식으로 보기' 클릭 시 모달이 열린다", () => {
  render(<IncidentReportView row={baseRow} />);
  expect(screen.queryByTestId("form-modal")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /양식으로 보기/ }));
  expect(screen.getByTestId("form-modal")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/View.test.tsx`
Expected: FAIL — `양식으로 보기` 버튼 없음

- [ ] **Step 3: Wire the button + modal into View**

`View.tsx` import에 추가:

```tsx
import { FormModal } from "./FormModal";
```

`IncidentReportView` 본문 상단 훅에 상태 추가(기존 `const [selected, setSelected] = useState<string[]>([]);` 다음):

```tsx
  const [formOpen, setFormOpen] = useState(false);
```

상단 `<section>`(제목/상태 칩) 블록 바로 다음, `{status === "rejected" && ...}` 앞에 버튼 추가:

```tsx
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="w-full cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
      >
        양식으로 보기
      </button>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        row={row}
        onSaved={onChanged}
      />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/View.test.tsx`
Expected: PASS (기존 + 신규 케이스)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/list-variants/incident-reports/View.tsx src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/View.test.tsx
git commit -m "feat(incident-reports): 인스펙터에 '양식으로 보기' 진입 버튼"
```

---

## Task 8: 최종 검증

- [ ] **Step 1: 전체 단위 테스트**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 2: Lint + Typecheck**

Run: `npm run lint && npm run typecheck`
Expected: 에러/경고 없음

- [ ] **Step 3: 빌드**

Run: `unset NODE_ENV && npm run build`
Expected: 빌드 성공 (`/_global-error` useContext 에러 없음)

- [ ] **Step 4: 수동 확인 (선택)**

`npm run dev` → 사고 보고 인스펙터 경위서 탭 → "양식으로 보기" → 좌측 경위 수정 시 우측 양식 즉시 반영 / 저장 / PDF 버튼 동작 확인.

---

## Self-Review

**Spec coverage:**
- 전체화면 2-pane 모달 → Task 6 ✓
- 실제 양식 완전 재현(인사말/회사명/전결/연락처/참조) → Task 1(콘텐츠) + Task 2(PDF) + Task 5(HTML) ✓
- 미리보기 = 출력 동일(단일 소스) → Task 1 `deriveFormModel`을 Task 2(PDF)·Task 5(HTML) 공유 ✓
- 새 DB 컬럼 없음 → 마이그레이션 Task 없음 ✓
- 3.처리 text 유지 → `SECTION_LABELS`/sections에서 text 처리 ✓
- 진입 버튼 → Task 7 ✓
- 상태 가드(approved/sent 읽기 전용) → Task 6 `editable` ✓
- PDF 다운로드 → Task 3 신규 라우트 + Task 6 PDF 버튼 ✓
- 시행번호 운반 → Task 4 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. TODO/TBD 없음.

**Type consistency:** `FormSource`(Task 1) ↔ `rowToFormSource`(Task 5) ↔ PDF input(Task 2/3) 필드명 일치. `deriveFormModel`/`FormModel`/`approvalLine`/`sections` 시그니처 Task 1 정의를 Task 2·5에서 동일 사용. `updateIncidentReport(id, input)`(actions.ts 기존) 인자 형상 ↔ `incidentReportUpdateSchema`(recipient_university/title/gyeongwi/cause/handling/prevention/apology) 일치.
