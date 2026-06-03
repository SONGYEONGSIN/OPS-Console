# 경위서 전용 편집 워크스페이스 (개정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 경위서를 모달이 아닌 전용 라우트 `/dashboard/incident-reports/[id]`에서 — 메인에 큰 Word 양식 뷰어(페이지 넘기기) + 우측 편집 인스펙터(라이브 반영)로 보여준다. 동시에 1차에서 생긴 인사말 중복 버그를 단일 소스로 고친다.

**Architecture:** 콘텐츠 단일 소스 `form-content.deriveFormModel`은 유지. 페이지 렌더를 `FormPage`(한 면)로 분리하고, 모달(`FormModal`)·`FormPreview`는 제거. 신규 라우트가 `ReportEditorWorkspace`(client, 로컬 draft 라이브 바인딩)를 렌더.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind 4 (tokens: ink/cream/line/washi/washi-raised/muted/vermilion/sage), Vitest + RTL.

**참고 스펙:** `docs/superpowers/specs/2026-06-02-incident-report-form-viewer-design.md` (§개정)

---

## 파일 구조

| 파일 | 변경 | 책임 |
|---|---|---|
| `src/features/incident-reports/form-content.ts` (+test) | 수정 | greeting 별도 줄 제거, apology 기본값 `defaultApology(university)`로 통일 |
| `src/lib/pdf/incident-report-pdf.tsx` | 수정 | 별도 인사말 `<Text>` 제거 (apology가 포함) |
| `.../incident-reports/FormPage.tsx` (+test) | 신규 | A4 한 면 렌더 (page 1 공문 / 2 경위서) |
| `.../incident-reports/FormPreview.tsx` (+test) | **제거** | FormModal과 함께 폐기 (소비자 없음) |
| `.../incident-reports/FormModal.tsx` (+test) | **제거** | 라우트로 대체 |
| `src/app/dashboard/incident-reports/[id]/page.tsx` | 신규 | 서버: 가드 + 보고서 fetch + 워크스페이스 렌더 |
| `.../incident-reports/[id]/_components/ReportEditorWorkspace.tsx` (+test) | 신규 | client: 페이지 뷰어 + 편집 패널 + 라이브 + 저장/PDF |
| `.../inspector/list-variants/incident-reports/View.tsx` (+test) | 수정 | "양식으로 보기" → `router.push` 네비게이션 |

---

## Task R1: 인사말 단일 소스 — `form-content.ts`

**Files:** Modify `src/features/incident-reports/form-content.ts`; Modify test `src/features/incident-reports/__tests__/form-content.test.ts`.

`src/features/incident-reports/apology.ts` 의 `defaultApology(university)`는 `"{university}의 무궁한 발전을 기원합니다.\n\n서비스 제공 중..."` — **인사말을 본문에 내장**한다. 1차에서 추가한 별도 `greeting`/`DEFAULT_APOLOGY`가 이와 중복되므로 제거하고 apology 단일 소스로 통일한다.

- [ ] **Step 1: 테스트 갱신(RED)** — `__tests__/form-content.test.ts`를 아래로 교체(greeting/jeonkyeolDate/deriveFormModel 검증, greeting 단독 테스트 삭제, apology 기본값을 `defaultApology` 기준으로):

```ts
import { describe, it, expect } from "vitest";
import { deriveFormModel, jeonkyeolDate, type FormSource } from "../form-content";
import { defaultApology } from "../apology";

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

describe("jeonkyeolDate", () => {
  it("YYYY-MM-DD를 MM/DD로 변환한다", () => {
    expect(jeonkyeolDate("2026-06-02")).toBe("06/02");
  });
  it("'YYYY. MM. DD' 형식도 변환한다", () => {
    expect(jeonkyeolDate("2025. 02. 13")).toBe("02/13");
  });
  it("숫자 그룹이 3개 미만이면 빈 문자열을 반환한다", () => {
    expect(jeonkyeolDate("2026")).toBe("");
  });
});

describe("deriveFormModel", () => {
  it("apology가 null이면 defaultApology(대학명)을 쓴다 (인사말 포함)", () => {
    const m = deriveFormModel(base);
    expect(m.apology).toBe(defaultApology("건국대학교"));
    expect(m.apology).toContain("건국대학교의 무궁한 발전을 기원합니다.");
  });
  it("apology 입력이 있으면 그 값을 우선한다", () => {
    expect(deriveFormModel({ ...base, apology: "직접 사과문" }).apology).toBe(
      "직접 사과문",
    );
  });
  it("apology가 공백만 있으면 기본 문구로 대체한다", () => {
    expect(deriveFormModel({ ...base, apology: "   " }).apology).toBe(
      defaultApology("건국대학교"),
    );
  });
  it("greeting을 별도 필드로 노출하지 않는다 (apology 단일 소스)", () => {
    expect("greeting" in deriveFormModel(base)).toBe(false);
  });
  it("4섹션을 번호·라벨·본문으로 만든다", () => {
    const m = deriveFormModel(base);
    expect(m.sections).toHaveLength(4);
    expect(m.sections[0]).toEqual({ no: 1, label: "경위", body: "경위 내용" });
    expect(m.sections[3].label).toBe("향후 대책");
  });
  it("결재라인 4칸을 채운다(빈 값은 빈 문자열)", () => {
    expect(deriveFormModel(base).approvalLine).toEqual([
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

- [ ] **Step 2: RED 확인** — `npm test -- src/features/incident-reports/__tests__/form-content.test.ts` → FAIL (greeting 필드 still present / DEFAULT_APOLOGY import 등).

- [ ] **Step 3: 구현** — `form-content.ts` 수정:
  1. 최상단에 import 추가: `import { defaultApology } from "./apology";`
  2. `export const DEFAULT_APOLOGY = ...` 삭제, `export function greeting(...) {...}` 삭제.
  3. `FormModel` 타입에서 `greeting: string;` 줄 삭제.
  4. `deriveFormModel`에서 `greeting: greeting(...)` 줄 삭제하고, apology 계산을 변경:
     ```ts
     apology: s.apology && s.apology.trim() ? s.apology : defaultApology(s.recipientUniversity),
     ```
  나머지(BRAND_HEADER/COMPANY_LINE/CONTACT_LINES/CLOSING/jeonkyeolDate/sections/approvalLine/attachment)는 유지.

- [ ] **Step 4: GREEN** — `npm test -- src/features/incident-reports/__tests__/form-content.test.ts` → PASS. `npx tsc --noEmit` → 0. (이 시점에 PDF/Preview가 `m.greeting`을 참조하면 tsc 에러 — Task R2/R3에서 해소되므로, tsc 전체는 R3 이후 통과. 단위 테스트는 통과해야 함.)

- [ ] **Step 5: Commit**
```bash
git add src/features/incident-reports/form-content.ts src/features/incident-reports/__tests__/form-content.test.ts
git commit -m "fix(incident-reports): 인사말 중복 제거 — apology 단일 소스(defaultApology)로 통일"
```

---

## Task R2: PDF 템플릿 별도 인사말 줄 제거

**Files:** Modify `src/lib/pdf/incident-report-pdf.tsx`.

R1으로 `m.greeting`이 사라졌다. PDF에서 이를 참조하는 줄을 제거한다 (apology가 인사말을 포함).

- [ ] **Step 1: 수정** — `incident-report-pdf.tsx`의 ① 공문 페이지에서 인사말 줄을 삭제:
  - 삭제: `<Text style={styles.greeting}>{m.greeting}</Text>`
  - `styles` 객체의 `greeting: { marginBottom: 6 },` 키도 삭제(미사용 orphan).
  - apology 줄(`<Text style={styles.apology}>{m.apology}</Text>`)은 그대로 유지 — 인사말+본문 모두 여기서 렌더.

- [ ] **Step 2: 검증** — `npm test -- src/lib/pdf/__tests__/incident-report-pdf.test.ts` → PASS (Buffer 렌더). `npx tsc --noEmit` → 0. `npx eslint src/lib/pdf/incident-report-pdf.tsx` → clean.

- [ ] **Step 3: Commit**
```bash
git add src/lib/pdf/incident-report-pdf.tsx
git commit -m "fix(incident-reports): 발송 PDF 인사말 중복 제거 (apology 단일 소스)"
```

---

## Task R3: `FormPage` 신규 + `FormPreview`·`FormModal` 제거

**Files:**
- Create: `.../inspector/list-variants/incident-reports/FormPage.tsx`
- Create test: `.../incident-reports/__tests__/FormPage.test.tsx`
- Delete: `.../incident-reports/FormPreview.tsx` + `__tests__/FormPreview.test.tsx`
- Delete: `.../incident-reports/FormModal.tsx` + `__tests__/FormModal.test.tsx`

경로 베이스: `src/app/dashboard/_components/inspector/list-variants/incident-reports/`

- [ ] **Step 1: 실패 테스트 작성(RED)** — `__tests__/FormPage.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormPage } from "../FormPage";
import { deriveFormModel, type FormSource } from "@/features/incident-reports/form-content";

const source: FormSource = {
  recipientUniversity: "건국대학교",
  title: "전산파일 오류 건",
  draftDate: "2026-06-02",
  authorName: "이해영",
  approverName: "송영신",
  directorName: null,
  ceoName: null,
  docNumber: null,
  apology: null,
  gyeongwi: "경위 내용입니다",
  cause: "원인 내용입니다",
  handling: "처리 내용입니다",
  prevention: "대책 내용입니다",
};
const model = deriveFormModel(source);

describe("FormPage", () => {
  it("page=1: 공문(수신대학·제목·결재라인)을 렌더한다", () => {
    render(<FormPage model={model} page={1} />);
    expect(screen.getByText(/수신자/)).toBeInTheDocument();
    expect(screen.getAllByText(/전산파일 오류 건/).length).toBeGreaterThan(0);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("사장")).toBeInTheDocument();
  });

  it("page=1: 인사말이 정확히 한 번만 나온다 (중복 없음)", () => {
    render(<FormPage model={model} page={1} />);
    expect(
      screen.getAllByText(/무궁한 발전을 기원합니다/).length,
    ).toBe(1);
  });

  it("page=2: 경위서 4섹션 본문을 렌더한다", () => {
    render(<FormPage model={model} page={2} />);
    expect(screen.getByText("경 위 서")).toBeInTheDocument();
    expect(screen.getByText("경위 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("원인 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("처리 내용입니다")).toBeInTheDocument();
    expect(screen.getByText("대책 내용입니다")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED 확인** — `npm test -- .../incident-reports/__tests__/FormPage.test.tsx` → FAIL (모듈 없음). (전체 경로: `src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormPage.test.tsx`)

- [ ] **Step 3: 구현** — `FormPage.tsx`. Tailwind 토큰만, 하드코딩 색상 금지, props만(순수):

```tsx
"use client";

import type { FormModel } from "@/features/incident-reports/form-content";

/** A4 한 장 — 흰 종이 느낌의 문서 면 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] border border-line bg-cream px-10 py-12 text-sm leading-relaxed text-ink shadow-sm">
      {children}
    </div>
  );
}

export function FormPage({ model: m, page }: { model: FormModel; page: number }) {
  if (page === 1) {
    return (
      <Sheet>
        <p className="mb-5 text-center text-2xs text-muted">{m.brandHeader}</p>
        <p>수신자&nbsp;&nbsp;{m.recipientUniversity}</p>
        <p>참&nbsp;&nbsp;조</p>
        <p>제&nbsp;&nbsp;목&nbsp;&nbsp;{m.title}</p>
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
    );
  }
  return (
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
  );
}
```

- [ ] **Step 4: 구파일 제거** — FormModal과 FormPreview는 이제 소비자가 없다(View는 R6에서 navigation으로 전환). 4개 파일 삭제:
```bash
git rm "src/app/dashboard/_components/inspector/list-variants/incident-reports/FormModal.tsx" \
       "src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormModal.test.tsx" \
       "src/app/dashboard/_components/inspector/list-variants/incident-reports/FormPreview.tsx" \
       "src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormPreview.test.tsx"
```
> 주의: View.tsx가 아직 `./FormModal`을 import한다 → R6 전까지 tsc/build 실패. 이 Task에서는 FormPage 테스트 통과만 확인하고, View 수정(R6)과 함께 전체 검증한다. (R3→R6 연속 실행)

- [ ] **Step 5: GREEN(부분)** — `npm test -- .../incident-reports/__tests__/FormPage.test.tsx` → PASS (3 tests). `npx eslint` FormPage.tsx → clean.

- [ ] **Step 6: Commit**
```bash
git add "src/app/dashboard/_components/inspector/list-variants/incident-reports/FormPage.tsx" \
        "src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/FormPage.test.tsx"
git commit -m "feat(incident-reports): 페이지 단위 FormPage 추출 + FormModal/FormPreview 제거"
```

---

## Task R4: 전용 라우트 페이지

**Files:** Create `src/app/dashboard/incident-reports/[id]/page.tsx`.

`reports/[id]/page.tsx` 패턴을 미러. 가드 `requireMenu("incidents")`(경위서는 사고보고 메뉴로 통합됨). `getIncidentReport(id)`는 untyped → `IncidentReportRow`로 캐스팅.

- [ ] **Step 1: 작성**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { resolvePageMeta } from "../../_data/page-meta-derive";
import { PageHeader } from "../../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getIncidentReport } from "@/features/incident-reports/queries";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";
import { ReportEditorWorkspace } from "./_components/ReportEditorWorkspace";

export default async function IncidentReportEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("incidents");
  const meta = findSidebarMeta("incidents");
  if (!meta) return null;
  const { id } = await params;
  const report = (await getIncidentReport(id)) as IncidentReportRow | null;
  if (!report) notFound();

  const config = resolvePageMeta("incidents", meta);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname="/dashboard/incidents"
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4 flex items-center gap-3">
          <Link
            href="/dashboard/incidents"
            className="text-vermilion hover:underline"
          >
            ← 사고 보고 목록
          </Link>
        </header>
        <ReportEditorWorkspace report={report} />
      </section>
    </div>
  );
}
```

> `findSidebarMeta`/`resolvePageMeta`의 시그니처는 `reports/[id]/page.tsx`와 동일하다고 가정. 구현 시 실제 import 경로/시그니처를 reports 라우트와 대조해 일치시켜라(상대경로 `../../`). 불일치 시 reports 패턴을 따르라.

- [ ] **Step 2: 검증** — (ReportEditorWorkspace는 R5에서 생성) R5 완료 후 `npx tsc --noEmit`로 함께 확인. 이 Task만 단독 커밋하지 말고 R5와 함께 커밋한다.

---

## Task R5: `ReportEditorWorkspace` (client)

**Files:**
- Create: `src/app/dashboard/incident-reports/[id]/_components/ReportEditorWorkspace.tsx`
- Create test: `src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx`

- [ ] **Step 1: 실패 테스트(RED)**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

const { mockUpdate, mockRefresh } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockRefresh: vi.fn(),
}));
vi.mock("@/features/incident-reports/actions", () => ({
  updateIncidentReport: mockUpdate,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn(), back: vi.fn() }),
}));

import { ReportEditorWorkspace } from "../ReportEditorWorkspace";

const report: IncidentReportRow = {
  id: "11111111-1111-4111-8111-111111111111",
  incident_id: null,
  recipient_university: "건국대학교",
  title: "원서 오류",
  draft_date: "2026-06-02",
  gyeongwi: "초기 경위",
  cause: null,
  handling: null,
  prevention: null,
  apology: null,
  author_name: "이해영",
  author_email: "lee@example.com",
  approver_name: "송영신",
  approver_email: null,
  director_name: null,
  ceo_name: null,
  status: "draft",
  reject_reason: null,
  approved_at: null,
  recipient_emails: [],
  doc_number: null,
  created_at: "2026-06-02T00:00:00Z",
  updated_at: "2026-06-02T00:00:00Z",
};

beforeEach(() => vi.clearAllMocks());

describe("ReportEditorWorkspace", () => {
  it("경위 편집이 메인 뷰어(2페이지)에 즉시 반영된다", () => {
    render(<ReportEditorWorkspace report={report} />);
    fireEvent.change(screen.getByLabelText("경위"), {
      target: { value: "수정된 경위" },
    });
    // 2페이지로 이동해야 경위서 본문이 보인다
    fireEvent.click(screen.getByLabelText("다음 페이지"));
    const reflected = screen
      .getAllByText("수정된 경위")
      .filter((el) => el.tagName !== "TEXTAREA");
    expect(reflected.length).toBeGreaterThan(0);
  });

  it("페이지 넘기기: 기본 1페이지(공문), 다음 누르면 2페이지(경위서)", () => {
    render(<ReportEditorWorkspace report={report} />);
    expect(screen.getByText(/수신자/)).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("다음 페이지"));
    expect(screen.getByText("경 위 서")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("저장 시 편집값으로 updateIncidentReport를 호출한다", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    render(<ReportEditorWorkspace report={report} />);
    fireEvent.change(screen.getByLabelText("원인"), {
      target: { value: "새 원인" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        report.id,
        expect.objectContaining({ cause: "새 원인" }),
      ),
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("approved 상태면 편집 패널을 숨긴다", () => {
    render(
      <ReportEditorWorkspace report={{ ...report, status: "approved" }} />,
    );
    expect(screen.queryByLabelText("경위")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED 확인** — `npm test -- src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx` → FAIL (모듈 없음).

- [ ] **Step 3: 구현**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  REPORT_STATUS_LABEL,
  type IncidentReportRow,
} from "@/features/incident-reports/schemas";
import {
  deriveFormModel,
  type FormSource,
} from "@/features/incident-reports/form-content";
import { updateIncidentReport } from "@/features/incident-reports/actions";
import { FormPage } from "@/app/dashboard/_components/inspector/list-variants/incident-reports/FormPage";

type EditableKey =
  | "recipient_university"
  | "title"
  | "gyeongwi"
  | "cause"
  | "handling"
  | "prevention"
  | "apology";

type Editable = Record<EditableKey, string>;

const FIELD_DEFS: { key: EditableKey; label: string; textarea: boolean }[] = [
  { key: "title", label: "제목", textarea: false },
  { key: "recipient_university", label: "수신대학", textarea: false },
  { key: "gyeongwi", label: "경위", textarea: true },
  { key: "cause", label: "원인", textarea: true },
  { key: "handling", label: "처리", textarea: true },
  { key: "prevention", label: "대책", textarea: true },
  { key: "apology", label: "사과 본문", textarea: true },
];

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

export function ReportEditorWorkspace({
  report,
}: {
  report: IncidentReportRow;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Editable>({
    recipient_university: report.recipient_university,
    title: report.title,
    gyeongwi: report.gyeongwi ?? "",
    cause: report.cause ?? "",
    handling: report.handling ?? "",
    prevention: report.prevention ?? "",
    apology: report.apology ?? "",
  });
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const editable = report.status === "draft" || report.status === "rejected";

  const source: FormSource = {
    recipientUniversity: draft.recipient_university,
    title: draft.title,
    draftDate: report.draft_date,
    authorName: report.author_name,
    approverName: report.approver_name,
    directorName: report.director_name,
    ceoName: report.ceo_name,
    docNumber: report.doc_number,
    apology: draft.apology || null,
    gyeongwi: draft.gyeongwi || null,
    cause: draft.cause || null,
    handling: draft.handling || null,
    prevention: draft.prevention || null,
  };
  const model = deriveFormModel(source);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateIncidentReport(report.id, {
        recipient_university: draft.recipient_university || undefined,
        title: draft.title || undefined,
        gyeongwi: draft.gyeongwi || null,
        cause: draft.cause || null,
        handling: draft.handling || null,
        prevention: draft.prevention || null,
        apology: draft.apology || null,
      });
      if (!r.ok) {
        setError(r.error ?? "저장에 실패했습니다.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto bg-washi-raised p-6">
          <FormPage model={model} page={page} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-sm text-ink hover:bg-washi-raised disabled:opacity-40"
          >
            ◀
          </button>
          <span className="text-sm text-muted">{page} / 2</span>
          <button
            type="button"
            aria-label="다음 페이지"
            disabled={page >= 2}
            onClick={() => setPage((p) => Math.min(2, p + 1))}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-sm text-ink hover:bg-washi-raised disabled:opacity-40"
          >
            ▶
          </button>
          <a
            href={`/api/incident-reports/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 cursor-pointer border border-line bg-transparent px-3 py-1 text-sm text-ink hover:bg-washi-raised"
          >
            PDF
          </a>
        </div>
      </div>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-line pl-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">편집</span>
          <span className="text-2xs text-muted">
            {REPORT_STATUS_LABEL[report.status]}
          </span>
        </div>
        {editable ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {FIELD_DEFS.map(({ key, label, textarea }) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block text-muted">{label}</span>
                  {textarea ? (
                    <textarea
                      aria-label={label}
                      value={draft[key]}
                      rows={4}
                      maxLength={5000}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className={inputClass}
                    />
                  ) : (
                    <input
                      aria-label={label}
                      value={draft[key]}
                      maxLength={200}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className={inputClass}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {error && <p className="text-xs text-vermilion">{error}</p>}
              {saved && <p className="text-xs text-sage">저장되었습니다.</p>}
              <button
                type="button"
                disabled={pending}
                onClick={onSave}
                className="w-full cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                {pending ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">
            편집할 수 없는 상태입니다. (미리보기·PDF만)
          </p>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: GREEN** — `npm test -- src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx` → PASS (4). `npx tsc --noEmit` → 0(R4 page.tsx도 함께 해소). `npx eslint` 두 신규 파일 → clean.

- [ ] **Step 5: Commit (R4 + R5 함께)**
```bash
git add "src/app/dashboard/incident-reports/[id]/page.tsx" \
        "src/app/dashboard/incident-reports/[id]/_components/ReportEditorWorkspace.tsx" \
        "src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx"
git commit -m "feat(incident-reports): 전용 편집 워크스페이스 라우트 (Word 뷰어 + 페이지 넘기기 + 라이브 편집)"
```

---

## Task R6: `IncidentReportView` 진입을 navigation으로 전환

**Files:**
- Modify: `.../inspector/list-variants/incident-reports/View.tsx`
- Modify test: `.../incident-reports/__tests__/View.test.tsx`

R3에서 `FormModal`을 제거했으므로 View.tsx의 import/사용을 navigation으로 교체한다.

- [ ] **Step 1: 테스트 갱신(RED)** — `View.test.tsx`에서:
  1. 기존 `vi.mock("../FormModal", ...)` 블록을 삭제.
  2. next/navigation 라우터 mock 추가(파일 상단 mock 그룹에):
     ```tsx
     const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
     vi.mock("next/navigation", () => ({
       useRouter: () => ({ push: mockPush, refresh: vi.fn(), back: vi.fn() }),
     }));
     ```
  3. 기존 "'양식으로 보기' 클릭 시 모달이 열린다" 테스트를 navigation 검증으로 교체:
     ```tsx
     it("'양식으로 보기' 클릭 시 편집 워크스페이스로 이동한다", () => {
       render(<IncidentReportView row={baseRow} />);
       fireEvent.click(screen.getByRole("button", { name: /양식으로 보기/ }));
       expect(mockPush).toHaveBeenCalledWith(
         `/dashboard/incident-reports/${baseRow.id}`,
       );
     });
     ```
  (`beforeEach`에 `mockPush` clear가 포함되는지 확인 — 기존 `vi.clearAllMocks()`가 처리.)

- [ ] **Step 2: RED 확인** — `npm test -- .../incident-reports/__tests__/View.test.tsx` → FAIL.

- [ ] **Step 3: 구현** — `View.tsx`:
  1. `import { FormModal } from "./FormModal";` 삭제.
  2. `import { useRouter } from "next/navigation";` 추가.
  3. 컴포넌트 본문 훅에 `const router = useRouter();` 추가(다른 훅 근처). `const [formOpen, setFormOpen] = useState(false);` 삭제.
  4. 버튼 onClick 교체 + `<FormModal .../>` 마운트 삭제:
     ```tsx
     <button
       type="button"
       onClick={() => router.push(`/dashboard/incident-reports/${row.id}`)}
       className="w-full cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
     >
       양식으로 보기
     </button>
     ```
     (기존 `<FormModal key={row.id} ... />` JSX 블록 전체 제거.)

- [ ] **Step 4: GREEN(전체)** — 이제 FormModal 참조가 사라져 전체가 통과해야 한다:
  - `npm test -- .../incident-reports/__tests__/View.test.tsx` → PASS
  - `npx tsc --noEmit` → 0
  - `npx eslint src/app/dashboard/_components/inspector/list-variants/incident-reports/View.tsx` → clean

- [ ] **Step 5: Commit**
```bash
git add src/app/dashboard/_components/inspector/list-variants/incident-reports/View.tsx \
        src/app/dashboard/_components/inspector/list-variants/incident-reports/__tests__/View.test.tsx
git commit -m "feat(incident-reports): '양식으로 보기' → 전용 편집 워크스페이스 이동"
```

---

## Task R7: 최종 검증

- [ ] **Step 1:** `npm test` → 전체 PASS (FormModal/FormPreview 테스트 제거 반영, FormPage/Workspace 추가)
- [ ] **Step 2:** `npm run lint` (신규 경고 0 — 기존 receivables 경고 1건은 무관) + `npm run typecheck` (0)
- [ ] **Step 3:** `unset NODE_ENV && npm run build` → 성공. 신규 라우트 `/dashboard/incident-reports/[id]` 매니페스트 등록 확인
- [ ] **Step 4 (수동, 선택):** `npm run dev` → 사고 보고 인스펙터 경위서 "양식으로 보기" → `/dashboard/incident-reports/<id>` 이동 → 메인 큰 Word 뷰어 + ◀ 1/2 ▶ 페이지 넘기기 + 우측 편집 시 즉시 반영 + 저장/PDF + 인사말 중복 없음 확인

---

## Self-Review

**Spec(§개정) coverage:**
- 모달 폐기 + 전용 라우트 → R3(제거) + R4/R5 ✓
- 메인 큰 Word 뷰어 + 페이지 넘기기 → R5(FormPage + ◀/▶) ✓
- 우측 편집 라이브 반영 → R5(draft → deriveFormModel → FormPage) ✓
- Word처럼 보이는 HTML(.docx 제외) → FormPage HTML A4 ✓
- 인사말 중복 버그 수정(화면+PDF) → R1 + R2 ✓
- 진입 navigation → R6 ✓
- 재사용(form-content/PDF/route/docNumber) → 유지 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. R4의 `findSidebarMeta`/`resolvePageMeta` 시그니처는 reports 라우트 대조 지시(실존 패턴) — placeholder 아님.

**Type consistency:** `FormSource`(form-content) ↔ ReportEditorWorkspace `source` 13필드 일치. `FormModel` ↔ FormPage `m.*` 일치(greeting 제거 반영). `updateIncidentReport(id, input)` ↔ `incidentReportUpdateSchema`(recipient_university/title/gyeongwi/cause/handling/prevention/apology) 일치. `IncidentReportRow` 필드명(snake_case) ↔ 테스트 fixture/workspace mapping 일치.

**Cross-task order risk:** R1이 `m.greeting`을 제거하면 R2/R3 전까지 PDF/Preview에서 tsc 에러 → R1~R6를 연속 실행하고 전체 tsc/build는 R6 이후 확정. 각 Task의 단위 테스트는 독립적으로 GREEN.
