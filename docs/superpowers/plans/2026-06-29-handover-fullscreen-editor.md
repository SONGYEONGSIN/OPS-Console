# 인수인계 풀스크린 작성 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인수인계 작성 목록 행을 클릭하면 우측 인스펙터 대신 회의록처럼 풀스크린 편집기(`/dashboard/handover/[serviceId]`)로 이동하여, 좌측 카테고리 레일 + 우측 폼으로 6카테고리·14필드를 버튼 없이 자동저장하며 작성한다.

**Architecture:** 기존 `features/handover`(actions/queries/categories/schemas)와 인스펙터 필드 위젯을 그대로 재사용한다. 인스펙터 `EditForm`의 필드-디스패치(`HandoverCategoryFields`)·복제 UI(`CopySection`)·upsert 매핑(`buildHandoverUpsertInput`)을 공용 모듈로 추출하여, 신규 풀스크린 편집기와 기존 인스펙터가 단일 소스를 공유한다. 신규 라우트는 서버 컴포넌트(`page.tsx`)가 데이터를 로드하고 클라이언트 `HandoverEditorWorkspace`가 레일+폼+디바운스 자동저장을 담당한다.

**Tech Stack:** Next.js App Router(RSC) + TypeScript, Tailwind CSS 4, Supabase, zod, Vitest + Testing Library.

## Global Constraints

- 색상 하드코딩 금지 — Tailwind 토큰 클래스만 사용(`text-ink`/`bg-cream`/`border-line`/`bg-vermilion` 등 기존 클래스 재사용).
- Immutability — 객체 직접 수정 금지, spread로 새 객체 생성.
- `any`/`@ts-ignore`/`eslint-disable`/`console.log` 금지. 미사용 import·변수 남기지 않기.
- TDD Iron Law: 런타임 로직은 테스트 RED → GREEN. 예외: 서버 컴포넌트 데이터 로딩 페이지·타입/설정 변경(검증은 typecheck/build/수동으로 대체).
- DB 스키마 변경 없음. 신규 의존성 없음.
- 테스트 실행: `npm test -- <경로>` (TZ=Asia/Seoul 자동). 타입: `npm run typecheck`. 린트: `npm run lint`.
- 브랜치: `feat/handover-fullscreen-editor` (이미 생성됨, 설계 문서 커밋 완료).
- 커밋 메시지: Conventional Commits, 한국어 본문. 각 태스크 끝에서 커밋.

**경로 alias:** `@/*` → `./src/*`.

**ListRow handover 키 (참조용):** `handoverContractInfoMd`, `handoverContractInfo`, `handoverContractDataMd`, `handoverContractChecklist`, `handoverWorkBasicMd`, `handoverWorkGeneratorMd`, `handoverWorkSiteMd`, `handoverWorkOutputMd`, `handoverWorkRateMd`, `handoverWorkFileMd`, `handoverWorkEtcMd`, `handoverPaymentFeeMd`, `handoverPaymentInvoiceMd`, `handoverPaymentFee`, `handoverPaymentInvoice`, `handoverSchoolContactMd`, `handoverSchoolContacts`, `handoverDocsMd`, `handoverDocsChecklist`, `handoverNotesMd`, `handoverSchoolContactCandidates`, `handoverServiceNumber`, `handoverStatus`.

---

## Task 1: 공용 upsert 매핑 추출 — `buildHandoverUpsertInput`

`page.tsx`의 `onPersist` 안에 인라인된 ListRow→upsert 입력 매핑을 순수 함수로 추출. 신규 편집기와 기존 인스펙터 저장이 동일 매핑을 공유한다.

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/handover/upsert-input.ts`
- Create (test): `src/app/dashboard/_components/inspector/list-variants/handover/__tests__/upsert-input.test.ts`
- Modify: `src/app/dashboard/handover/page.tsx` (onPersist 본문을 헬퍼 호출로 교체)

**Interfaces:**
- Produces: `buildHandoverUpsertInput(row: ListRow): HandoverRecordUpsert` — `service_id`는 `row.id`. 빈 체크리스트/연락처 항목은 필터링. 구조화 필드는 없으면 기본값.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_components/inspector/list-variants/handover/__tests__/upsert-input.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildHandoverUpsertInput } from "../upsert-input";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "서울대 · 수시",
  status: "active",
  owner: "송영신",
  handoverContractDataMd: "메모",
  handoverContractChecklist: [
    { id: "a", text: "항목1", done: false },
    { id: "b", text: "   ", done: false },
  ],
  handoverSchoolContacts: [
    { id: "c", name: "홍길동", jobTitle: null, phone: null, email: null },
    { id: "d", name: "  ", jobTitle: null, phone: null, email: null },
  ],
  handoverNotesMd: "특이사항",
};

describe("buildHandoverUpsertInput", () => {
  it("service_id는 row.id로 매핑", () => {
    expect(buildHandoverUpsertInput(row).service_id).toBe(row.id);
  });

  it("빈 텍스트 체크리스트 항목은 제외", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.contract_data_checklist).toHaveLength(1);
    expect(out.contract_data_checklist[0]?.text).toBe("항목1");
  });

  it("이름 없는 연락처 항목은 제외", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.school_contacts).toHaveLength(1);
    expect(out.school_contacts[0]?.name).toBe("홍길동");
  });

  it("구조화 필드 미지정 시 기본값 채움", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.contract_info).toEqual({
      title: "",
      type: "",
      progress: "",
      status: "",
      memo: "",
    });
    expect(out.payment_fee).toEqual({ deadline: "", manager: "", memo: "" });
    expect(out.payment_invoice).toEqual({ issueType: "", memo: "" });
  });

  it("md 필드 미지정 시 null", () => {
    const out = buildHandoverUpsertInput(row);
    expect(out.work_basic_md).toBeNull();
    expect(out.notes_md).toBe("특이사항");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/upsert-input.test.ts`
Expected: FAIL — `Cannot find module '../upsert-input'`.

- [ ] **Step 3: 헬퍼 구현**

`src/app/dashboard/_components/inspector/list-variants/handover/upsert-input.ts`:

```ts
import type { ListRow } from "../../../patterns/ListPattern";
import type { HandoverRecordUpsert } from "@/features/handover/schemas";

/**
 * ListRow → handover_records upsert 입력. service_id는 row.id.
 * 빈 체크리스트/연락처 항목은 제외, 구조화 필드는 없으면 기본값.
 * 인스펙터 저장(page.tsx onPersist)과 풀스크린 편집기 자동저장이 공유한다.
 */
export function buildHandoverUpsertInput(row: ListRow): HandoverRecordUpsert {
  return {
    service_id: row.id,
    contract_info_md: row.handoverContractInfoMd ?? null,
    contract_info: row.handoverContractInfo ?? {
      title: "",
      type: "",
      progress: "",
      status: "",
      memo: "",
    },
    contract_data_md: row.handoverContractDataMd ?? null,
    contract_data_checklist: (row.handoverContractChecklist ?? []).filter((c) =>
      c.text.trim(),
    ),
    work_basic_md: row.handoverWorkBasicMd ?? null,
    work_generator_md: row.handoverWorkGeneratorMd ?? null,
    work_site_md: row.handoverWorkSiteMd ?? null,
    work_output_md: row.handoverWorkOutputMd ?? null,
    work_rate_md: row.handoverWorkRateMd ?? null,
    work_file_md: row.handoverWorkFileMd ?? null,
    work_etc_md: row.handoverWorkEtcMd ?? null,
    payment_fee_md: row.handoverPaymentFeeMd ?? null,
    payment_invoice_md: row.handoverPaymentInvoiceMd ?? null,
    payment_fee: row.handoverPaymentFee ?? {
      deadline: "",
      manager: "",
      memo: "",
    },
    payment_invoice: row.handoverPaymentInvoice ?? {
      issueType: "",
      memo: "",
    },
    school_contact_md: row.handoverSchoolContactMd ?? null,
    school_contacts: (row.handoverSchoolContacts ?? []).filter((c) =>
      c.name.trim(),
    ),
    docs_md: row.handoverDocsMd ?? null,
    docs_checklist: (row.handoverDocsChecklist ?? []).filter((c) =>
      c.text.trim(),
    ),
    notes_md: row.handoverNotesMd ?? null,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/upsert-input.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: page.tsx onPersist 교체 (DRY)**

`src/app/dashboard/handover/page.tsx`:
- import 추가(상단 import 블록):

```ts
import { buildHandoverUpsertInput } from "../_components/inspector/list-variants/handover/upsert-input";
```

- `onPersist`(현재 257-302행) 본문 교체:

```ts
  async function onPersist(
    row: ListRow,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await upsertHandoverRecord(buildHandoverUpsertInput(row));
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }
```

- [ ] **Step 6: 타입·기존 테스트 확인**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/`
Expected: PASS (기존 인스펙터 테스트 + 신규 upsert-input).

- [ ] **Step 7: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/handover/upsert-input.ts \
        src/app/dashboard/_components/inspector/list-variants/handover/__tests__/upsert-input.test.ts \
        src/app/dashboard/handover/page.tsx
git commit -m "refactor(handover): upsert 매핑 buildHandoverUpsertInput 추출"
```

---

## Task 2: 필드 디스패치·복제 UI 추출 (`HandoverCategoryFields`, `CopySection`)

인스펙터 `EditForm`에 인라인된 카테고리별 필드 렌더와 `CopySection`을 공용 컴포넌트로 추출. 추출 후 `EditForm`은 이들을 조합하는 얇은 래퍼가 된다. 기존 인스펙터 테스트(EditForm/Copy)는 마크업이 동일하므로 그대로 통과해야 한다.

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/handover/CopySection.tsx`
- Create (test): `src/app/dashboard/_components/inspector/list-variants/handover/__tests__/HandoverCategoryFields.test.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/handover/EditForm.tsx`

**Interfaces:**
- Produces: `HandoverCategoryFields(props: { row: ListRow; setRow: Dispatch<SetStateAction<ListRow>>; category: HandoverCategoryKey; contractsStatusOptions?: string[] })` — 선택 카테고리의 필드들을 `CollapsibleField` 아코디언으로 렌더.
- Produces: `CopySection(props: { fromServiceId: string; candidates; onCopy })` — 다른 서비스로 복제 UI (기존 동작 동일).
- Consumes: `buildHandoverUpsertInput` (Task 1 — 미사용, 참조 없음).

- [ ] **Step 1: 실패 테스트 작성 (`HandoverCategoryFields`)**

`__tests__/HandoverCategoryFields.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverCategoryFields } from "../HandoverCategoryFields";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "service-1",
  name: "서울대학교 · 수시",
  status: "active",
  owner: "송영신",
  universityName: "서울대학교",
  serviceName: "수시 일반전형",
  handoverContractInfo: {
    title: "원서접수",
    type: "수의",
    progress: "운영자",
    status: "완료",
    memo: "",
  },
  handoverWorkBasicMd: null,
};

describe("HandoverCategoryFields", () => {
  it("계약 카테고리 — 계약정보 prefill 노출", () => {
    render(
      <HandoverCategoryFields row={row} setRow={vi.fn()} category="contract" />,
    );
    expect(screen.getByLabelText("형태")).toHaveValue("수의");
    expect(screen.getByRole("button", { name: /계약자료/ })).toBeInTheDocument();
  });

  it("작업 카테고리 — 기초작업 아코디언 헤더 노출, 펼치면 입력", () => {
    render(
      <HandoverCategoryFields row={row} setRow={vi.fn()} category="work" />,
    );
    const header = screen.getByRole("button", { name: /기초작업/ });
    fireEvent.click(header);
    expect(screen.getByLabelText("기초작업")).toBeInTheDocument();
  });

  it("textarea 입력 시 setRow 호출", () => {
    const setRow = vi.fn();
    render(
      <HandoverCategoryFields row={row} setRow={setRow} category="contract" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /계약자료/ }));
    fireEvent.change(screen.getByLabelText("계약자료 메모"), {
      target: { value: "신규자료" },
    });
    expect(setRow).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/HandoverCategoryFields.test.tsx`
Expected: FAIL — `Cannot find module '../HandoverCategoryFields'`.

- [ ] **Step 3: `HandoverCategoryFields.tsx` 구현**

`HandoverCategoryFields.tsx` (디스패치는 기존 EditForm 73-202행과 동일):

```tsx
"use client";

import { type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { ContractChecklist } from "./ContractChecklist";
import { ContractInfoForm } from "./ContractInfoForm";
import { SchoolContactPicker } from "./SchoolContactPicker";
import { CollapsibleField } from "./CollapsibleField";
import { StructuredInfoForm } from "./StructuredInfoForm";
import {
  PAYMENT_FEE_FIELDS,
  PAYMENT_INVOICE_FIELDS,
  EMPTY_PAYMENT_FEE,
  EMPTY_PAYMENT_INVOICE,
} from "./payment-fields";
import { isFieldFilled, ROW_TO_FIELD } from "./progress";
import { FIELD_EXAMPLE } from "@/features/handover/field-examples";

function pickValue(row: ListRow, key: HandoverFieldKey): string {
  const v = row[ROW_TO_FIELD[key]];
  return typeof v === "string" ? v : "";
}

export function HandoverCategoryFields({
  row,
  setRow,
  category,
  contractsStatusOptions,
}: {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  category: HandoverCategoryKey;
  contractsStatusOptions?: string[];
}) {
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === category);
  if (!cat) return null;

  return (
    <div className="space-y-3">
      {cat.fields.map((f) => {
        const filled = isFieldFilled(row, f.key);
        let body: ReactNode;
        if (f.key === "contract_info_md") {
          body = (
            <ContractInfoForm
              embedded
              value={
                row.handoverContractInfo ?? {
                  title: "",
                  type: "",
                  progress: "",
                  status: "",
                  memo: "",
                }
              }
              onChange={(next) =>
                setRow((prev) => ({ ...prev, handoverContractInfo: next }))
              }
              universityName={row.universityName ?? undefined}
              statusOptions={contractsStatusOptions ?? []}
            />
          );
        } else if (f.key === "school_contact_md") {
          body = (
            <SchoolContactPicker
              embedded
              candidates={row.handoverSchoolContactCandidates ?? []}
              items={row.handoverSchoolContacts ?? []}
              onChange={(next) =>
                setRow((prev) => ({ ...prev, handoverSchoolContacts: next }))
              }
            />
          );
        } else if (f.key === "contract_data_md" || f.key === "docs_md") {
          const isDocs = f.key === "docs_md";
          body = (
            <ContractChecklist
              embedded
              label={isDocs ? "제출서류" : "계약서류"}
              items={
                (isDocs
                  ? row.handoverDocsChecklist
                  : row.handoverContractChecklist) ?? []
              }
              onChange={(items) =>
                setRow((prev) => ({
                  ...prev,
                  ...(isDocs
                    ? { handoverDocsChecklist: items }
                    : { handoverContractChecklist: items }),
                }))
              }
            >
              <label className="block text-xs">
                <span className="mb-1 block text-muted">메모</span>
                <textarea
                  aria-label={isDocs ? "서류 메모" : "계약자료 메모"}
                  value={pickValue(row, f.key)}
                  onChange={(e) =>
                    setRow((prev) => ({
                      ...prev,
                      [ROW_TO_FIELD[f.key]]: e.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={10000}
                  placeholder="추가 메모(선택)"
                  className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
                />
              </label>
            </ContractChecklist>
          );
        } else if (f.key === "payment_fee_md") {
          body = (
            <StructuredInfoForm
              fields={PAYMENT_FEE_FIELDS}
              value={row.handoverPaymentFee ?? EMPTY_PAYMENT_FEE}
              onChange={(next) =>
                setRow((prev) => ({
                  ...prev,
                  handoverPaymentFee: next as ListRow["handoverPaymentFee"],
                }))
              }
            />
          );
        } else if (f.key === "payment_invoice_md") {
          body = (
            <StructuredInfoForm
              fields={PAYMENT_INVOICE_FIELDS}
              value={row.handoverPaymentInvoice ?? EMPTY_PAYMENT_INVOICE}
              onChange={(next) =>
                setRow((prev) => ({
                  ...prev,
                  handoverPaymentInvoice:
                    next as ListRow["handoverPaymentInvoice"],
                }))
              }
            />
          );
        } else {
          body = (
            <textarea
              aria-label={f.label}
              value={pickValue(row, f.key)}
              onChange={(e) =>
                setRow((prev) => ({
                  ...prev,
                  [ROW_TO_FIELD[f.key]]: e.target.value,
                }))
              }
              rows={6}
              maxLength={10000}
              placeholder={FIELD_EXAMPLE[f.key]}
              className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
            />
          );
        }
        return (
          <CollapsibleField
            key={f.key}
            label={f.label}
            filled={filled}
            defaultOpen={filled}
          >
            {body}
          </CollapsibleField>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인 (`HandoverCategoryFields`)**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/HandoverCategoryFields.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: `CopySection.tsx` 추출**

`CopySection.tsx` — 기존 EditForm 230-351행의 `CopySection` 함수를 그대로 이동(export 추가). 의존 타입은 `EditFormProps`에서 가져온다:

```tsx
"use client";

import { useState } from "react";
import type { EditFormProps } from "../types";

export function CopySection({
  fromServiceId,
  candidates,
  onCopy,
}: {
  fromServiceId: string;
  candidates: NonNullable<EditFormProps["handoverServiceCandidates"]>;
  onCopy: NonNullable<EditFormProps["onCopyHandover"]>;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const term = q.trim();
  const results = term
    ? candidates
        .filter((c) => c.id !== fromServiceId)
        .filter(
          (c) =>
            c.universityName.includes(term) ||
            c.serviceName.includes(term) ||
            String(c.serviceId).includes(term),
        )
        .slice(0, 12)
    : [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const overwriting = candidates.filter(
      (c) => ids.includes(c.id) && c.hasRecord,
    );
    if (overwriting.length > 0) {
      const names = overwriting
        .map((c) => `${c.universityName} · ${c.serviceName}`)
        .join("\n");
      if (
        !window.confirm(
          `다음 ${overwriting.length}개 서비스는 이미 작성된 내용이 있습니다. 덮어쓰시겠습니까?\n\n${names}`,
        )
      )
        return;
    }
    setPending(true);
    setMsg(null);
    const r = await onCopy(fromServiceId, ids);
    setPending(false);
    if (r.ok) {
      setMsg(`${r.copiedCount ?? ids.length}개 서비스로 복제 완료`);
      setSelected(new Set());
      setQ("");
    } else {
      setMsg(r.error ?? "복제 실패");
    }
  }

  return (
    <section className="mt-4 space-y-2 border-t border-line-soft pt-3">
      <p className="text-2xs uppercase tracking-[0.18em] text-muted">
        다른 서비스로 복제
      </p>
      <p className="text-2xs text-muted">
        현재 내용을 1차 기준으로 2·3차 등 다른 서비스에 복사합니다.
      </p>
      <input
        aria-label="복제 대상 서비스 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="대학명 · 서비스명 · service_id 검색"
        className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
      />
      {term && results.length === 0 ? (
        <p className="text-2xs text-muted">검색 결과 없음</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto border border-line-soft p-1">
          {results.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs hover:bg-washi-raised">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-3.5 w-3.5 accent-vermilion"
                />
                <span className="truncate text-ink">
                  {c.universityName} · {c.serviceName}
                </span>
                {c.hasRecord ? (
                  <span className="ml-auto shrink-0 bg-vermilion/20 px-1 py-0.5 text-2xs text-vermilion-deep">
                    작성됨
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.size > 0 ? (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="w-full border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
        >
          {pending ? "복제 중…" : `${selected.size}개 서비스로 복제`}
        </button>
      ) : null}
      {msg ? <p className="text-2xs text-ink-soft">{msg}</p> : null}
    </section>
  );
}
```

- [ ] **Step 6: `EditForm.tsx`를 추출 컴포넌트로 재구성**

`EditForm.tsx` 전체를 아래로 교체(필드 디스패치·`CopySection` 정의·`ROW_TO_FIELD`·`pickValue` 제거, 추출본 import):

```tsx
"use client";

import { useState } from "react";
import {
  type HandoverCategoryKey,
} from "@/features/handover/categories";
import { CategoryTabs } from "./CategoryTabs";
import { HandoverCategoryFields } from "./HandoverCategoryFields";
import { CopySection } from "./CopySection";
import type { EditFormProps } from "../types";

export function HandoverEditForm({
  row,
  setRow,
  onSave,
  onCancel,
  handoverServiceCandidates,
  onCopyHandover,
  contractsStatusOptions,
}: EditFormProps) {
  const [active, setActive] = useState<HandoverCategoryKey>("contract");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="mb-6">
        <CategoryTabs active={active} onChange={setActive} />
      </div>

      <HandoverCategoryFields
        row={row}
        setRow={setRow}
        category={active}
        contractsStatusOptions={contractsStatusOptions}
      />

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {onCopyHandover ? (
        <CopySection
          fromServiceId={row.id}
          candidates={handoverServiceCandidates ?? []}
          onCopy={onCopyHandover}
        />
      ) : null}
    </form>
  );
}
```

- [ ] **Step 7: 기존 인스펙터 테스트 회귀 확인 (추출 무손상)**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/`
Expected: PASS — EditForm.test(8) / CopyButton.test / HandoverCategoryFields.test(3) / 기타 전부 통과.

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 8: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields.tsx \
        src/app/dashboard/_components/inspector/list-variants/handover/CopySection.tsx \
        src/app/dashboard/_components/inspector/list-variants/handover/EditForm.tsx \
        src/app/dashboard/_components/inspector/list-variants/handover/__tests__/HandoverCategoryFields.test.tsx
git commit -m "refactor(handover): 필드 디스패치·복제 UI 공용 컴포넌트 추출"
```

---

## Task 3: 좌측 카테고리 레일 — `HandoverCategoryRail`

6카테고리 세로 네비 + 카테고리별 진행도(N/M) + 채움 점 + 전체 진행도. 클릭 시 active 전환.

**Files:**
- Create: `src/app/dashboard/handover/[serviceId]/_components/HandoverCategoryRail.tsx`
- Create (test): `src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverCategoryRail.test.tsx`

**Interfaces:**
- Consumes: `categoryProgress(row, key)` from inspector `progress.ts` (filled/total).
- Produces: `HandoverCategoryRail(props: { row: ListRow; active: HandoverCategoryKey; onChange: (k: HandoverCategoryKey) => void })`.

- [ ] **Step 1: 실패 테스트 작성**

`[serviceId]/_components/__tests__/HandoverCategoryRail.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverCategoryRail } from "../HandoverCategoryRail";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";

const row: ListRow = {
  id: "service-1",
  name: "서울대 · 수시",
  status: "active",
  owner: "송영신",
  handoverContractInfo: {
    title: "원서접수",
    type: "",
    progress: "",
    status: "",
    memo: "",
  },
  handoverContractChecklist: [{ id: "a", text: "항목", done: false }],
};

describe("HandoverCategoryRail", () => {
  it("6개 카테고리 라벨 노출", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    for (const label of ["계약", "작업", "정산", "컨텍", "서류", "기타"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("계약 카테고리 진행도 2/2 표시", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /계약/ })).toHaveTextContent("2/2");
  });

  it("전체 진행도 표시 (14필드 중 채운 수)", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/진행 2\/14/)).toBeInTheDocument();
  });

  it("카테고리 클릭 시 onChange(key) 호출", () => {
    const onChange = vi.fn();
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /작업/ }));
    expect(onChange).toHaveBeenCalledWith("work");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverCategoryRail.test.tsx`
Expected: FAIL — `Cannot find module '../HandoverCategoryRail'`.

- [ ] **Step 3: 구현**

`[serviceId]/_components/HandoverCategoryRail.tsx`:

```tsx
"use client";

import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";
import { categoryProgress } from "@/app/dashboard/_components/inspector/list-variants/handover/progress";

export function HandoverCategoryRail({
  row,
  active,
  onChange,
}: {
  row: ListRow;
  active: HandoverCategoryKey;
  onChange: (key: HandoverCategoryKey) => void;
}) {
  let filledTotal = 0;
  let fieldTotal = 0;

  const items = HANDOVER_CATEGORIES.map((cat) => {
    const { filled, total } = categoryProgress(row, cat.key);
    filledTotal += filled;
    fieldTotal += total;
    const mark = filled === 0 ? "○" : filled === total ? "●" : "◐";
    return { cat, filled, total, mark };
  });

  return (
    <nav className="flex w-44 shrink-0 flex-col border-r border-line">
      <ul>
        {items.map(({ cat, filled, total, mark }) => {
          const on = cat.key === active;
          return (
            <li key={cat.key}>
              <button
                type="button"
                onClick={() => onChange(cat.key)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  on
                    ? "bg-washi-raised font-medium text-ink"
                    : "text-ink-soft hover:bg-washi"
                }`}
              >
                <span>
                  <span aria-hidden className="mr-2 text-muted">
                    {mark}
                  </span>
                  {cat.label}
                </span>
                <span className="text-2xs text-muted">
                  {filled}/{total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto border-t border-line-soft px-4 py-3 text-xs text-muted">
        진행 {filledTotal}/{fieldTotal}
      </p>
    </nav>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverCategoryRail.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add "src/app/dashboard/handover/[serviceId]/_components/HandoverCategoryRail.tsx" \
        "src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverCategoryRail.test.tsx"
git commit -m "feat(handover): 풀스크린 편집기 좌측 카테고리 레일"
```

---

## Task 4: 편집기 초기 ListRow 빌더 — `buildEditorRow`

서버 페이지가 로드한 service(`ServiceLite`) + record(`HandoverRecordRow | null`) + 연락처 후보를 클라이언트 편집기 상태용 `ListRow`로 변환.

**Files:**
- Create: `src/app/dashboard/handover/[serviceId]/build-editor-row.ts`
- Create (test): `src/app/dashboard/handover/[serviceId]/__tests__/build-editor-row.test.ts`

**Interfaces:**
- Consumes: `ServiceLite`, `HandoverRecordRow`, `HandoverContactCandidate` from `@/features/handover/queries`/`schemas`.
- Produces: `buildEditorRow(service: ServiceLite, record: HandoverRecordRow | null, contacts: { name: string; jobTitle: string | null; phone: string | null; email: string | null }[]): ListRow`.

- [ ] **Step 1: 실패 테스트 작성**

`[serviceId]/__tests__/build-editor-row.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildEditorRow } from "../build-editor-row";
import type { ServiceLite } from "@/features/handover/queries";
import type { HandoverRecordRow } from "@/features/handover/schemas";

const service: ServiceLite = {
  id: "svc-uuid",
  service_id: 1098001,
  university_name: "숙명여자대학교",
  service_name: "Fall Admission",
  application_type: "반응형원서",
  operator_name: "송영신",
};

describe("buildEditorRow", () => {
  it("record 없으면 id·기본정보만, handover 필드는 비어있음", () => {
    const row = buildEditorRow(service, null, []);
    expect(row.id).toBe("svc-uuid");
    expect(row.universityName).toBe("숙명여자대학교");
    expect(row.handoverStatus).toBeUndefined();
    expect(row.handoverContractInfoMd ?? null).toBeNull();
    expect(row.handoverContractChecklist).toEqual([]);
  });

  it("record 있으면 14필드 매핑 + status 반영", () => {
    const record = {
      id: "rec-uuid",
      service_id: "svc-uuid",
      contract_info_md: "계약메모",
      contract_info: { title: "A", type: "", progress: "", status: "", memo: "" },
      contract_data_md: null,
      contract_data_checklist: [{ id: "a", text: "항목", done: false }],
      work_basic_md: "기초",
      work_generator_md: null,
      work_site_md: null,
      work_output_md: null,
      work_rate_md: null,
      work_file_md: null,
      work_etc_md: null,
      payment_fee_md: null,
      payment_invoice_md: null,
      payment_fee: { deadline: "", manager: "", memo: "" },
      payment_invoice: { issueType: "", memo: "" },
      school_contact_md: null,
      school_contacts: [],
      docs_md: null,
      docs_checklist: [],
      notes_md: "특이",
      author_email: "a@b.com",
      author_name: "송영신",
      status: "draft",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    } as HandoverRecordRow;
    const row = buildEditorRow(service, record, []);
    expect(row.handoverContractInfoMd).toBe("계약메모");
    expect(row.handoverContractInfo?.title).toBe("A");
    expect(row.handoverWorkBasicMd).toBe("기초");
    expect(row.handoverNotesMd).toBe("특이");
    expect(row.handoverStatus).toBe("draft");
    expect(row.handoverContractChecklist).toHaveLength(1);
  });

  it("연락처 후보 부착", () => {
    const row = buildEditorRow(service, null, [
      { name: "홍길동", jobTitle: "팀장", phone: "010", email: "x@y.z" },
    ]);
    expect(row.handoverSchoolContactCandidates).toHaveLength(1);
    expect(row.handoverSchoolContactCandidates?.[0]?.name).toBe("홍길동");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/dashboard/handover/[serviceId]/__tests__/build-editor-row.test.ts`
Expected: FAIL — `Cannot find module '../build-editor-row'`.

- [ ] **Step 3: 구현**

`[serviceId]/build-editor-row.ts`:

```ts
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import type { ServiceLite } from "@/features/handover/queries";
import type { HandoverRecordRow } from "@/features/handover/schemas";

type ContactCandidate = {
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
};

const EMPTY_CONTRACT_INFO = {
  title: "",
  type: "",
  progress: "",
  status: "",
  memo: "",
};
const EMPTY_PAYMENT_FEE = { deadline: "", manager: "", memo: "" };
const EMPTY_PAYMENT_INVOICE = { issueType: "", memo: "" };

/** 서버 로드 데이터 → 풀스크린 편집기 클라이언트 상태(ListRow). */
export function buildEditorRow(
  service: ServiceLite,
  record: HandoverRecordRow | null,
  contacts: ContactCandidate[],
): ListRow {
  return {
    id: service.id,
    name: `${service.university_name} · ${service.service_name}`,
    status: "active",
    owner: service.operator_name ?? "—",
    universityName: service.university_name,
    serviceName: service.service_name,
    applicationType: service.application_type,
    handoverServiceNumber: service.service_id,
    handoverStatus: record?.status ?? undefined,
    handoverContractInfoMd: record?.contract_info_md ?? null,
    handoverContractInfo: record?.contract_info ?? EMPTY_CONTRACT_INFO,
    handoverContractDataMd: record?.contract_data_md ?? null,
    handoverContractChecklist: record?.contract_data_checklist ?? [],
    handoverWorkBasicMd: record?.work_basic_md ?? null,
    handoverWorkGeneratorMd: record?.work_generator_md ?? null,
    handoverWorkSiteMd: record?.work_site_md ?? null,
    handoverWorkOutputMd: record?.work_output_md ?? null,
    handoverWorkRateMd: record?.work_rate_md ?? null,
    handoverWorkFileMd: record?.work_file_md ?? null,
    handoverWorkEtcMd: record?.work_etc_md ?? null,
    handoverPaymentFeeMd: record?.payment_fee_md ?? null,
    handoverPaymentInvoiceMd: record?.payment_invoice_md ?? null,
    handoverPaymentFee: record?.payment_fee ?? EMPTY_PAYMENT_FEE,
    handoverPaymentInvoice: record?.payment_invoice ?? EMPTY_PAYMENT_INVOICE,
    handoverSchoolContactMd: record?.school_contact_md ?? null,
    handoverSchoolContacts: record?.school_contacts ?? [],
    handoverDocsMd: record?.docs_md ?? null,
    handoverDocsChecklist: record?.docs_checklist ?? [],
    handoverNotesMd: record?.notes_md ?? null,
    handoverSchoolContactCandidates: contacts.map((c) => ({
      name: c.name,
      jobTitle: c.jobTitle,
      phone: c.phone,
      email: c.email,
    })),
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/app/dashboard/handover/[serviceId]/__tests__/build-editor-row.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add "src/app/dashboard/handover/[serviceId]/build-editor-row.ts" \
        "src/app/dashboard/handover/[serviceId]/__tests__/build-editor-row.test.ts"
git commit -m "feat(handover): 편집기 초기 ListRow 빌더 buildEditorRow"
```

---

## Task 5: 풀스크린 편집기 워크스페이스 — `HandoverEditorWorkspace`

상단바(목록 이동 + 작성상태 배지 + 자동저장 인디케이터) + 레일 + 카테고리 필드 + 복제 섹션. 필드 변경 시 800ms 디바운스로 `upsertHandoverRecord` 자동저장.

**Files:**
- Create: `src/app/dashboard/handover/[serviceId]/_components/HandoverEditorWorkspace.tsx`
- Create (test): `src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverEditorWorkspace.test.tsx`

**Interfaces:**
- Consumes: `HandoverCategoryRail` (Task 3), `HandoverCategoryFields`/`CopySection` (Task 2), `buildHandoverUpsertInput` (Task 1), `upsertHandoverRecord` (`@/features/handover/actions`).
- Produces: `HandoverEditorWorkspace(props: { initialRow: ListRow; contractsStatusOptions: string[]; handoverServiceCandidates: EditFormProps["handoverServiceCandidates"]; onCopyHandover: EditFormProps["onCopyHandover"] })`.

- [ ] **Step 1: 실패 테스트 작성**

`[serviceId]/_components/__tests__/HandoverEditorWorkspace.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HandoverEditorWorkspace } from "../HandoverEditorWorkspace";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";

const upsertMock = vi.fn();
vi.mock("@/features/handover/actions", () => ({
  upsertHandoverRecord: (input: unknown) => upsertMock(input),
}));

const initialRow: ListRow = {
  id: "svc-1",
  name: "숙명여대 · Fall",
  status: "active",
  owner: "송영신",
  universityName: "숙명여자대학교",
  serviceName: "Fall Admission",
  handoverContractInfo: { title: "", type: "", progress: "", status: "", memo: "" },
};

function setup() {
  render(
    <HandoverEditorWorkspace
      initialRow={initialRow}
      contractsStatusOptions={[]}
      handoverServiceCandidates={[]}
      onCopyHandover={undefined}
    />,
  );
}

describe("HandoverEditorWorkspace", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ ok: true, row: { status: "draft" } });
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("상단 목록 이동 링크 + 미작성 배지", () => {
    setup();
    const link = screen.getByRole("link", { name: /목록 이동/ });
    expect(link).toHaveAttribute("href", "/dashboard/handover");
    expect(screen.getByText("미작성")).toBeInTheDocument();
  });

  it("레일 클릭 → 우측 카테고리 전환", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /작업/ }));
    fireEvent.click(screen.getByRole("button", { name: /기초작업/ }));
    expect(screen.getByLabelText("기초작업")).toBeInTheDocument();
  });

  it("필드 입력 → 800ms 후 upsertHandoverRecord 자동 호출", async () => {
    setup();
    // 기타 카테고리 특이사항 textarea 입력
    fireEvent.click(screen.getByRole("button", { name: /기타/ }));
    fireEvent.click(screen.getByRole("button", { name: /특이사항/ }));
    fireEvent.change(screen.getByLabelText("특이사항"), {
      target: { value: "메모입력" },
    });
    expect(screen.getByText("저장 중…")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      service_id: "svc-1",
      notes_md: "메모입력",
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverEditorWorkspace.test.tsx`
Expected: FAIL — `Cannot find module '../HandoverEditorWorkspace'`.

- [ ] **Step 3: 구현**

`[serviceId]/_components/HandoverEditorWorkspace.tsx`:

```tsx
"use client";

import { useRef, useState, type SetStateAction } from "react";
import Link from "next/link";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import { HandoverCategoryFields } from "@/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields";
import { CopySection } from "@/app/dashboard/_components/inspector/list-variants/handover/CopySection";
import { buildHandoverUpsertInput } from "@/app/dashboard/_components/inspector/list-variants/handover/upsert-input";
import { upsertHandoverRecord } from "@/features/handover/actions";
import { type HandoverCategoryKey } from "@/features/handover/categories";
import type { HandoverStatus } from "@/features/handover/schemas";
import type { EditFormProps } from "@/app/dashboard/_components/inspector/list-variants/types";
import { HandoverCategoryRail } from "./HandoverCategoryRail";

type StatusKey = HandoverStatus | "none";

const STATUS_LABEL: Record<StatusKey, string> = {
  none: "미작성",
  draft: "작성중",
  ready: "작성완료",
  published: "인계완료",
};
const STATUS_TONE: Record<StatusKey, string> = {
  none: "bg-washi-raised text-muted",
  draft: "bg-vermilion/15 text-vermilion",
  ready: "bg-sage/15 text-sage",
  published: "bg-ink/10 text-ink",
};

export function HandoverEditorWorkspace({
  initialRow,
  contractsStatusOptions,
  handoverServiceCandidates,
  onCopyHandover,
}: {
  initialRow: ListRow;
  contractsStatusOptions: string[];
  handoverServiceCandidates: EditFormProps["handoverServiceCandidates"];
  onCopyHandover: EditFormProps["onCopyHandover"];
}) {
  const [row, setRowState] = useState<ListRow>(initialRow);
  const [active, setActive] = useState<HandoverCategoryKey>("contract");
  const [status, setStatus] = useState<StatusKey>(
    (initialRow.handoverStatus as StatusKey | undefined) ?? "none",
  );
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: ListRow) {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await upsertHandoverRecord(buildHandoverUpsertInput(next));
      setSaved(res.ok);
      if (res.ok) setStatus(res.row.status);
    }, 800);
  }

  function setRow(updater: SetStateAction<ListRow>) {
    setRowState((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: ListRow) => ListRow)(prev)
          : updater;
      scheduleSave(next);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/dashboard/handover"
          className="inline-flex shrink-0 items-center border border-line px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
        >
          ← 목록 이동
        </Link>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-xs text-muted">
            {saved ? "✓ 자동 저장됨" : "저장 중…"}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 border border-line">
        <HandoverCategoryRail row={row} active={active} onChange={setActive} />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <HandoverCategoryFields
            row={row}
            setRow={setRow}
            category={active}
            contractsStatusOptions={contractsStatusOptions}
          />
          {onCopyHandover ? (
            <CopySection
              fromServiceId={row.id}
              candidates={handoverServiceCandidates ?? []}
              onCopy={onCopyHandover}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverEditorWorkspace.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: 타입 확인**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: 커밋**

```bash
git add "src/app/dashboard/handover/[serviceId]/_components/HandoverEditorWorkspace.tsx" \
        "src/app/dashboard/handover/[serviceId]/_components/__tests__/HandoverEditorWorkspace.test.tsx"
git commit -m "feat(handover): 풀스크린 편집기 워크스페이스 + 자동저장"
```

---

## Task 6: 편집기 서버 페이지 — `[serviceId]/page.tsx`

권한 가드 + 데이터 로드(service/record/연락처/계약상태옵션/복제후보) + 복제 server action + 워크스페이스 렌더. 서버 컴포넌트(데이터 로딩) → TDD 예외, typecheck/build/수동 검증.

**Files:**
- Create: `src/app/dashboard/handover/[serviceId]/page.tsx`

**Interfaces:**
- Consumes: `requireMenu`, `getServiceForHandover`/`getHandoverByServiceId`/`getHandoverContactCandidates`/`listServicesWithHandover`, `listContracts`, `copyHandoverRecord`, `buildEditorRow` (Task 4), `HandoverEditorWorkspace` (Task 5).

- [ ] **Step 1: 구현**

`[serviceId]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  getServiceForHandover,
  getHandoverByServiceId,
  getHandoverContactCandidates,
  listServicesWithHandover,
} from "@/features/handover/queries";
import { copyHandoverRecord } from "@/features/handover/actions";
import { listContracts } from "@/features/contracts/queries";
import { buildEditorRow } from "./build-editor-row";
import { HandoverEditorWorkspace } from "./_components/HandoverEditorWorkspace";

export default async function HandoverEditorPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  await requireMenu("handover");
  const { serviceId } = await params;

  const service = await getServiceForHandover(serviceId);
  if (!service) notFound();

  const record = await getHandoverByServiceId(serviceId);
  const contacts = await getHandoverContactCandidates([service.university_name]);
  const row = buildEditorRow(
    service,
    record,
    contacts.map((c) => ({
      name: c.name,
      jobTitle: c.jobTitle,
      phone: c.phone,
      email: c.email,
    })),
  );

  // 복제 대상 후보 (전체 서비스 light)
  const { rows: allWithHandover } = await listServicesWithHandover({
    pageSize: 3000,
  });
  const handoverServiceCandidates = allWithHandover.map((r) => ({
    id: r.service_id,
    serviceId: r.service_number,
    universityName: r.university_name,
    serviceName: r.service_name,
    hasRecord: r.handover_status != null,
  }));

  // 계약정보 상태 셀렉트 옵션 (best-effort)
  let contractsStatusOptions: string[] = [];
  try {
    const { rows: allContracts } = await listContracts();
    contractsStatusOptions = [
      ...new Set(allContracts.map((c) => c.status).filter((v) => v.trim())),
    ];
  } catch {
    contractsStatusOptions = [];
  }

  async function onCopyHandover(
    fromServiceId: string,
    toServiceIds: string[],
  ): Promise<{ ok: boolean; error?: string; copiedCount?: number }> {
    "use server";
    return await copyHandoverRecord(fromServiceId, toServiceIds);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col px-5 pb-3 pt-6 md:px-6 lg:px-7">
        <HandoverEditorWorkspace
          initialRow={row}
          contractsStatusOptions={contractsStatusOptions}
          handoverServiceCandidates={handoverServiceCandidates}
          onCopyHandover={onCopyHandover}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 타입·린트 확인**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run lint`
Expected: 0 errors/warnings.

- [ ] **Step 3: 커밋**

```bash
git add "src/app/dashboard/handover/[serviceId]/page.tsx"
git commit -m "feat(handover): 풀스크린 편집기 서버 페이지 라우트"
```

---

## Task 7: 목록 행 클릭 → 풀스크린 이동 (`Table.tsx`)

handover 인스펙터 `Table`의 행 클릭을 인스펙터 오픈 대신 `/dashboard/handover/[serviceId]` 라우팅으로 변경. ListPattern/registry/dispatcher 무변경(인스펙터가 트리거되지 않을 뿐).

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/handover/Table.tsx`
- Modify (test): `src/app/dashboard/_components/inspector/list-variants/handover/__tests__/Table.test.tsx`

**Interfaces:**
- Consumes: `useRouter` from `next/navigation`.

- [ ] **Step 1: 테스트 변경 (RED) — 네비게이션 단언**

`__tests__/Table.test.tsx` — 마지막 "row 클릭 → onSelect 호출" 테스트를 아래로 교체. 상단에 `next/navigation` 모킹 추가:

```tsx
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
```

교체할 테스트:

```tsx
  it("row 클릭 → 풀스크린 편집기로 라우팅", () => {
    pushMock.mockReset();
    render(
      <HandoverTable rows={[baseRow]} selectedId={null} onSelect={() => {}} />,
    );
    fireEvent.click(screen.getByText("서울대학교").closest("tr")!);
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/handover/${baseRow.id}`,
    );
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/Table.test.tsx`
Expected: FAIL — `pushMock` 미호출(현재 onSelect 호출).

- [ ] **Step 3: `Table.tsx` 구현 변경**

상단 import 추가:

```tsx
import { useRouter } from "next/navigation";
```

`Props`는 유지(ListPattern이 selectedId/onSelect 전달). 컴포넌트 시그니처를 `rows`만 구조분해로 변경하고 router 사용:

```tsx
export function HandoverTable({ rows }: Props) {
  const router = useRouter();
  return (
```

행의 `onClick`·하이라이트 변경(`onSelect`/`selectedId` 미사용):

```tsx
              <tr
                key={row.id}
                onClick={() => router.push(`/dashboard/handover/${row.id}`)}
                className="cursor-pointer border-b border-line-soft hover:bg-washi-raised"
              >
```

> 주: `Props`의 `selectedId`/`onSelect`는 ListPattern 호출 호환을 위해 타입에는 남기되 구조분해하지 않아 미사용 경고가 없다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/app/dashboard/_components/inspector/list-variants/handover/__tests__/Table.test.tsx`
Expected: PASS (4 tests — 빈/컬럼/미작성/라우팅).

- [ ] **Step 5: 타입·린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: exit 0, 0 warnings.

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/handover/Table.tsx \
        src/app/dashboard/_components/inspector/list-variants/handover/__tests__/Table.test.tsx
git commit -m "feat(handover): 목록 행 클릭 시 풀스크린 편집기로 이동"
```

---

## Task 8: 전체 검증 + 수동 스모크

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 단위 테스트**

Run: `npm test`
Expected: 전체 PASS (신규 + 기존 회귀 포함, 0 실패).

- [ ] **Step 2: 타입·린트·빌드**

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run lint`
Expected: 0 errors/warnings.

Run: `unset NODE_ENV; npm run build`
Expected: 빌드 성공(exit 0). `/dashboard/handover/[serviceId]` 라우트가 빌드 출력에 포함.

- [ ] **Step 3: 수동 스모크 (개발 서버)**

`npm run dev` 후:
1. `/dashboard/handover` 작성 탭 → 서비스 행 클릭 → `/dashboard/handover/<id>` 풀스크린 진입 확인.
2. 좌측 레일에서 카테고리 전환 → 우측 필드 교체 확인. 진행도 N/M 갱신 확인.
3. 임의 필드 입력 → "저장 중…" → 잠시 후 "✓ 자동 저장됨", 상단 배지(미작성→작성중) 갱신 확인.
4. 목록으로 돌아가 작성상태 컬럼이 반영됐는지 확인(새로고침).
5. `← 목록 이동` 링크 동작 확인.

- [ ] **Step 4: 마무리**

`/finish` 또는 superpowers:finishing-a-development-branch로 PR/머지 경로 결정. PR 제목(squash 기준): `feat(handover): 인수인계 풀스크린 작성 화면`.

---

## 비범위 (후속 PR)

- 인스펙터 `View.tsx`/`EditForm.tsx`의 완전 제거 + `registry.ts`/`types.ts` handover variant 정리(작성 탭에서 미사용이 됨). 본 PR은 추출·재사용까지만.
- PDF/메일 편집기 통합(현재 '인수인계 진행' 탭 유지).
- 단일 스크롤(B안)·가로 탭(C안) 레이아웃.
