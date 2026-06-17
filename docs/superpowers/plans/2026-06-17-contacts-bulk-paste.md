# 대학연락처 붙여넣기 일괄 등록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 엑셀에서 복사한 연락처 표를 textarea에 붙여넣어 다건 일괄 등록한다(헤더 유연 매핑 / 중복·오류 행 제외+보고).

**Architecture:** 클라이언트 순수 파서(`paste-parse.ts`)로 실시간 미리보기 → 서버 액션(`createContactsBulk`)이 zod 재검증·(대학+고객명) 중복 제외·insert. UI는 "신규 연락처" 왼쪽 버튼 → 모달. 진입은 `ListPattern`의 신규 `extraActionsLeft` 슬롯.

**Tech Stack:** Next.js App Router, TypeScript, Supabase(@supabase/ssr), zod, Vitest + @testing-library/react.

**스펙:** `docs/superpowers/specs/2026-06-17-contacts-bulk-paste-design.md`
**브랜치:** `feat/contacts-bulk-paste`

## File Structure

- Create `src/features/contacts/paste-parse.ts` — TSV 파싱 + 헤더 매핑 + 행 검증 + `toContactCreate` 헬퍼 (순수).
- Create `src/features/contacts/__tests__/paste-parse.test.ts`.
- Modify `src/features/contacts/actions.ts` — `createContactsBulk` 추가.
- Modify `src/features/contacts/__tests__/actions.test.ts` (없으면 Create) — bulk 액션 테스트.
- Modify `src/app/dashboard/_components/patterns/ListPattern.tsx` — `extraActionsLeft` prop 추가 + 생성 버튼 왼쪽 렌더.
- Create `src/app/dashboard/contacts/BulkPasteContacts.tsx` — 버튼 + 모달 UI (client).
- Create `src/app/dashboard/contacts/__tests__/BulkPasteContacts.test.tsx`.
- Modify `src/app/dashboard/contacts/page.tsx` — `extraActionsLeft={<BulkPasteContacts/>}` 연결.

---

### Task 1: 파서 `paste-parse.ts`

**Files:**
- Create: `src/features/contacts/paste-parse.ts`
- Test: `src/features/contacts/__tests__/paste-parse.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/features/contacts/__tests__/paste-parse.test.ts
import { describe, it, expect } from "vitest";
import { parsePastedContacts, toContactCreate } from "../paste-parse";

describe("parsePastedContacts", () => {
  it("헤더 별칭 + 열 순서 무관 매핑", () => {
    const text = "고객명\t대학명\t이메일\n김담당\t서강대학교\tkim@x.com";
    const r = parsePastedContacts(text);
    expect(r.headerError).toBeUndefined();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].values).toMatchObject({
      customer_name: "김담당",
      university_name: "서강대학교",
      contact_email: "kim@x.com",
    });
    expect(r.rows[0].errors).toEqual([]);
  });

  it("필수 헤더(대학명/고객명) 없으면 headerError", () => {
    const r = parsePastedContacts("이메일\ta@x.com");
    expect(r.headerError).toBeTruthy();
    expect(r.rows).toEqual([]);
  });

  it("필수값 누락 행은 errors", () => {
    const text = "대학명\t고객명\n서강대\t\n\t박담당";
    const r = parsePastedContacts(text);
    expect(r.rows[0].errors).toContain("고객명 누락");
    expect(r.rows[1].errors).toContain("대학명 누락");
  });

  it("매핑 안 된 헤더는 unmappedHeaders, 빈 줄 무시", () => {
    const text = "대학명\t고객명\t메모\n서강대\t김담당\t비고\n\n";
    const r = parsePastedContacts(text);
    expect(r.unmappedHeaders).toContain("메모");
    expect(r.rows).toHaveLength(1);
  });

  it("customer_active 미입력 시 기본 '재직'", () => {
    const r = parsePastedContacts("대학명\t고객명\n서강대\t김담당");
    expect(r.rows[0].values.customer_active).toBe("재직");
  });
});

describe("toContactCreate", () => {
  it("누락 nullable 필드는 null, customer_active 기본 재직", () => {
    const c = toContactCreate({ university_name: "서강대", customer_name: "김담당" });
    expect(c).toEqual({
      customer_active: "재직",
      customer_name: "김담당",
      university_name: "서강대",
      job_title: null,
      department_name: null,
      job_role: null,
      management_grade: null,
      relationship_grade: null,
      contact_phone: null,
      contact_ext: null,
      contact_email: null,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/contacts/__tests__/paste-parse.test.ts`
Expected: FAIL (module/function 없음)

- [ ] **Step 3: 최소 구현**

```ts
// src/features/contacts/paste-parse.ts
import type { ContactCreate } from "./schemas";

type Field = keyof ContactCreate;

const ALIAS_GROUPS: [Field, string[]][] = [
  ["university_name", ["대학명", "학교명", "대학", "학교", "university"]],
  ["customer_name", ["고객명", "담당자명", "담당자", "이름", "성명", "name"]],
  ["contact_email", ["이메일", "메일", "email", "e-mail"]],
  ["contact_phone", ["전화", "전화번호", "연락처", "휴대폰", "핸드폰", "phone", "tel"]],
  ["contact_ext", ["내선", "내선번호", "ext"]],
  ["job_title", ["직위", "직급", "title"]],
  ["department_name", ["부서", "부서명", "department", "dept"]],
  ["job_role", ["직무", "역할", "role"]],
  ["management_grade", ["관리등급"]],
  ["relationship_grade", ["관계등급"]],
  ["customer_active", ["재직", "재직여부", "상태", "active"]],
];

const HEADER_ALIASES: Record<string, Field> = {};
for (const [field, aliases] of ALIAS_GROUPS) {
  for (const a of aliases) HEADER_ALIASES[a.toLowerCase()] = field;
}

export type ParsedValues = Partial<Record<Field, string>>;

export type ParsedContactRow = {
  rowIndex: number;
  values: ParsedValues;
  errors: string[];
};

export type ParseResult = {
  rows: ParsedContactRow[];
  unmappedHeaders: string[];
  headerError?: string;
};

export function parsePastedContacts(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return { rows: [], unmappedHeaders: [], headerError: "붙여넣은 내용이 없습니다." };
  }
  const headerCells = lines[0].split("\t").map((c) => c.trim());
  const fieldByCol = headerCells.map(
    (h): Field | null => HEADER_ALIASES[h.toLowerCase()] ?? null,
  );
  const unmappedHeaders = headerCells.filter((_, i) => fieldByCol[i] === null);
  const mapped = new Set(fieldByCol.filter((f): f is Field => f !== null));
  if (!mapped.has("university_name") || !mapped.has("customer_name")) {
    return {
      rows: [],
      unmappedHeaders,
      headerError:
        "필수 헤더(대학명·고객명)를 찾지 못했습니다. 첫 행에 열 이름을 포함해 주세요.",
    };
  }

  const rows: ParsedContactRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    const values: ParsedValues = {};
    fieldByCol.forEach((field, col) => {
      if (!field) return;
      const v = (cells[col] ?? "").trim();
      if (v !== "") values[field] = v;
    });
    if (values.customer_active === undefined) values.customer_active = "재직";
    const errors: string[] = [];
    if (!values.university_name) errors.push("대학명 누락");
    if (!values.customer_name) errors.push("고객명 누락");
    rows.push({ rowIndex: i, values, errors });
  }
  return { rows, unmappedHeaders };
}

/** ParsedValues → ContactCreate (누락 nullable=null, customer_active 기본 재직). */
export function toContactCreate(values: ParsedValues): ContactCreate {
  return {
    customer_active: values.customer_active ?? "재직",
    customer_name: values.customer_name ?? "",
    university_name: values.university_name ?? "",
    job_title: values.job_title ?? null,
    department_name: values.department_name ?? null,
    job_role: values.job_role ?? null,
    management_grade: values.management_grade ?? null,
    relationship_grade: values.relationship_grade ?? null,
    contact_phone: values.contact_phone ?? null,
    contact_ext: values.contact_ext ?? null,
    contact_email: values.contact_email ?? null,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/contacts/__tests__/paste-parse.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/features/contacts/paste-parse.ts src/features/contacts/__tests__/paste-parse.test.ts
git commit -m "feat(contacts): 붙여넣기 TSV 파서 + toContactCreate"
```

---

### Task 2: 일괄 액션 `createContactsBulk`

**Files:**
- Modify: `src/features/contacts/actions.ts`
- Test: `src/features/contacts/__tests__/actions.test.ts` (없으면 Create)

- [ ] **Step 1: 실패 테스트 작성** (파일 없으면 신규, 있으면 describe 추가)

```ts
// src/features/contacts/__tests__/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockClient, mockGetOperator } = vi.hoisted(() => ({
  mockClient: vi.fn(),
  mockGetOperator: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockClient }));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: mockGetOperator }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));

import { createContactsBulk } from "../actions";
import type { ContactCreate } from "../schemas";

function contact(over: Partial<ContactCreate>): ContactCreate {
  return {
    customer_active: "재직", customer_name: "이름", university_name: "대학",
    job_title: null, department_name: null, job_role: null,
    management_grade: null, relationship_grade: null,
    contact_phone: null, contact_ext: null, contact_email: null, ...over,
  };
}

// 기존(중복) 페어 + insert 캡처용 mock supabase
function makeClient(existing: { university_name: string; customer_name: string }[]) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table !== "contacts") throw new Error("unexpected table");
    return {
      select: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data: existing, error: null }),
      }),
      insert,
    };
  });
  return { client: { from }, insert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOperator.mockResolvedValue({ permission: "member", email: "op@x.com" });
});

describe("createContactsBulk", () => {
  it("권한 없으면 ok:false", async () => {
    mockGetOperator.mockResolvedValue({ permission: "viewer" });
    const r = await createContactsBulk([contact({})]);
    expect(r.ok).toBe(false);
  });

  it("기존 중복(대학+고객명)은 제외하고 신규만 insert + duplicates 보고", async () => {
    const { client, insert } = makeClient([
      { university_name: "서강대", customer_name: "김담당" },
    ]);
    mockClient.mockResolvedValue(client);
    const r = await createContactsBulk([
      contact({ university_name: "서강대", customer_name: "김담당" }), // dup
      contact({ university_name: "연세대", customer_name: "박담당" }), // new
    ]);
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(1);
    expect(r.duplicates).toEqual([{ university_name: "서강대", customer_name: "김담당" }]);
    const inserted = insert.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].customer_name).toBe("박담당");
  });

  it("배치 내 자체 중복은 1건만 insert", async () => {
    const { client, insert } = makeClient([]);
    mockClient.mockResolvedValue(client);
    const r = await createContactsBulk([
      contact({ university_name: "연세대", customer_name: "박담당" }),
      contact({ university_name: "연세대", customer_name: "박담당" }),
    ]);
    expect(r.inserted).toBe(1);
    expect(insert.mock.calls[0][0]).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/contacts/__tests__/actions.test.ts`
Expected: FAIL (createContactsBulk 없음)

- [ ] **Step 3: 구현** — `actions.ts` 끝에 추가 (기존 import 재사용: `createClient`, `getCurrentOperator`, `contactCreateSchema`, `revalidatePath`, `isOperator`, `PERMISSION_ERROR`, `CONTACTS_PATH`)

```ts
export type BulkCreateResult = {
  ok: boolean;
  inserted: number;
  duplicates: { university_name: string; customer_name: string }[];
  error?: string;
};

function dupKey(u: string, n: string): string {
  return `${u} ${n}`;
}

export async function createContactsBulk(
  rows: import("./schemas").ContactCreate[],
): Promise<BulkCreateResult> {
  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, inserted: 0, duplicates: [], error: PERMISSION_ERROR };
  }

  // 1) zod 재검증 — 유효 행만
  const valid = rows.filter((r) => contactCreateSchema.safeParse(r).success);

  const supabase = await createClient();

  // 2) 기존 (university_name, customer_name) 페어 — chunk loop
  const existingKeys = new Set<string>();
  for (let p = 0; p < 30; p++) {
    const { data, error } = await supabase
      .from("contacts")
      .select("university_name, customer_name")
      .range(p * 1000, p * 1000 + 999);
    if (error) return { ok: false, inserted: 0, duplicates: [], error: error.message };
    if (!data || data.length === 0) break;
    for (const c of data) existingKeys.add(dupKey(c.university_name, c.customer_name));
    if (data.length < 1000) break;
  }

  // 3) 중복(DB + 배치 내 자체) 제외
  const duplicates: { university_name: string; customer_name: string }[] = [];
  const seen = new Set<string>();
  const toInsert: import("./schemas").ContactCreate[] = [];
  for (const r of valid) {
    const k = dupKey(r.university_name, r.customer_name);
    if (existingKeys.has(k)) {
      duplicates.push({ university_name: r.university_name, customer_name: r.customer_name });
      continue;
    }
    if (seen.has(k)) continue; // 배치 내 자체 중복 1건만
    seen.add(k);
    toInsert.push(r);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("contacts").insert(toInsert);
    if (error) return { ok: false, inserted: 0, duplicates, error: error.message };
  }

  revalidatePath(CONTACTS_PATH);
  return { ok: true, inserted: toInsert.length, duplicates };
}
```

> 참고: `import("./schemas").ContactCreate` 대신 파일 상단 import에 `ContactCreate`를 추가해도 됨 — 기존 import 블록 `from "./schemas"`에 `type ContactCreate` 추가하고 인라인 import 제거.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/contacts/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/contacts/actions.ts src/features/contacts/__tests__/actions.test.ts
git commit -m "feat(contacts): createContactsBulk 일괄 등록 액션(중복 제외)"
```

---

### Task 3: `ListPattern`에 `extraActionsLeft` 슬롯

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` (props 타입 ~555-559, 구조분해 ~651-653, 렌더 ~855-878)

플레이스홀더 없는 추가형 prop. 단위테스트 없이 typecheck + 다운스트림(Task 4/5)으로 검증(타입 pass-through plumbing — 프로젝트 TDD 예외: 타입/플러밍).

- [ ] **Step 1: props 타입에 추가** — `extraActions?: React.ReactNode;` 줄 아래에 추가

```ts
  extraActions?: React.ReactNode;
  /** 생성 버튼 왼쪽에 렌더할 액션(예: 일괄등록 버튼). 기존 extraActions는 오른쪽 유지. */
  extraActionsLeft?: React.ReactNode;
```

- [ ] **Step 2: 구조분해에 추가** — `extraActions,` 줄 아래

```ts
  extraActions,
  extraActionsLeft,
```

- [ ] **Step 3: 생성 버튼 왼쪽 렌더** — 액션 영역 `<div className="flex flex-wrap items-center gap-1">` 바로 다음(생성 버튼 블록 `{(variant === "team" || canCreate) && ...}` 앞)에 삽입

```tsx
            <div className="flex flex-wrap items-center gap-1">
              {extraActionsLeft}
              {(variant === "team" || canCreate) && !readOnly && (
```

- [ ] **Step 4: typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx
git commit -m "feat(list): ListPattern extraActionsLeft 슬롯(생성 버튼 왼쪽)"
```

---

### Task 4: `BulkPasteContacts` 컴포넌트

**Files:**
- Create: `src/app/dashboard/contacts/BulkPasteContacts.tsx`
- Test: `src/app/dashboard/contacts/__tests__/BulkPasteContacts.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/app/dashboard/contacts/__tests__/BulkPasteContacts.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockBulk } = vi.hoisted(() => ({ mockBulk: vi.fn() }));
vi.mock("@/features/contacts/actions", () => ({ createContactsBulk: mockBulk }));

import { BulkPasteContacts } from "../BulkPasteContacts";
import { createContactsBulk } from "@/features/contacts/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockBulk.mockResolvedValue({ ok: true, inserted: 1, duplicates: [] });
});

function open() {
  render(<BulkPasteContacts />);
  fireEvent.click(screen.getByRole("button", { name: /일괄등록/ }));
}

describe("BulkPasteContacts", () => {
  it("버튼 클릭 시 모달(붙여넣기 textarea) 노출", () => {
    open();
    expect(screen.getByLabelText("연락처 붙여넣기")).toBeInTheDocument();
  });

  it("붙여넣기 시 유효/오류 행 미리보기", () => {
    open();
    fireEvent.change(screen.getByLabelText("연락처 붙여넣기"), {
      target: { value: "대학명\t고객명\n서강대\t김담당\n연세대\t" },
    });
    expect(screen.getByText(/유효 1건/)).toBeInTheDocument();
    expect(screen.getByText(/오류 1건/)).toBeInTheDocument();
  });

  it("등록 클릭 시 유효 행만 createContactsBulk 호출", async () => {
    open();
    fireEvent.change(screen.getByLabelText("연락처 붙여넣기"), {
      target: { value: "대학명\t고객명\n서강대\t김담당" },
    });
    fireEvent.click(screen.getByRole("button", { name: /등록/ }));
    await waitFor(() => expect(createContactsBulk).toHaveBeenCalledTimes(1));
    const arg = mockBulk.mock.calls[0][0];
    expect(arg).toHaveLength(1);
    expect(arg[0]).toMatchObject({ university_name: "서강대", customer_name: "김담당" });
  });

  it("결과(등록/중복) 표시", async () => {
    mockBulk.mockResolvedValue({
      ok: true, inserted: 1,
      duplicates: [{ university_name: "연세대", customer_name: "박담당" }],
    });
    open();
    fireEvent.change(screen.getByLabelText("연락처 붙여넣기"), {
      target: { value: "대학명\t고객명\n서강대\t김담당" },
    });
    fireEvent.click(screen.getByRole("button", { name: /등록/ }));
    expect(await screen.findByText(/1건 등록/)).toBeInTheDocument();
    expect(screen.getByText(/중복 1건/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/dashboard/contacts/__tests__/BulkPasteContacts.test.tsx`
Expected: FAIL (컴포넌트 없음)

- [ ] **Step 3: 구현**

```tsx
// src/app/dashboard/contacts/BulkPasteContacts.tsx
"use client";

import { useMemo, useState } from "react";
import {
  parsePastedContacts,
  toContactCreate,
} from "@/features/contacts/paste-parse";
import { createContactsBulk } from "@/features/contacts/actions";

type RunResult = {
  inserted: number;
  duplicates: { university_name: string; customer_name: string }[];
};

export function BulkPasteContacts() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePastedContacts(text), [text]);
  const validRows = parsed.rows.filter((r) => r.errors.length === 0);
  const errorRows = parsed.rows.filter((r) => r.errors.length > 0);

  function close() {
    setOpen(false);
    setText("");
    setResult(null);
    setError(null);
  }

  async function submit() {
    setPending(true);
    setError(null);
    const payload = validRows.map((r) => toContactCreate(r.values));
    const res = await createContactsBulk(payload);
    setPending(false);
    if (res.ok) setResult({ inserted: res.inserted, duplicates: res.duplicates });
    else setError(res.error ?? "등록 실패");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border border-line bg-cream px-3 py-1 text-xs font-medium text-ink transition-colors hover:bg-washi"
      >
        연락처 일괄등록
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
          role="dialog"
          aria-label="연락처 일괄등록"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden border border-line bg-paper">
            <div className="flex items-center justify-between border-b border-line px-4 py-2">
              <h2 className="text-sm font-bold text-ink">연락처 일괄등록</h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={close}
                className="cursor-pointer border-none bg-transparent px-1 text-muted hover:text-vermilion"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-2 text-xs leading-[1.6] text-muted">
                엑셀에서 표(첫 행=열 이름)를 복사해 붙여넣으세요. 대학명·고객명은
                필수입니다. (이메일/전화/내선/직위/부서 등 열 이름 자동 인식)
              </p>
              <textarea
                aria-label="연락처 붙여넣기"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={"대학명\t고객명\t이메일\t전화\n..."}
                className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
              />

              {parsed.headerError ? (
                <p className="mt-2 text-xs text-vermilion">{parsed.headerError}</p>
              ) : text.trim() !== "" ? (
                <div className="mt-2 text-xs text-ink-soft">
                  <span className="text-ink">유효 {validRows.length}건</span>
                  {errorRows.length > 0 && (
                    <span className="ml-2 text-vermilion">
                      오류 {errorRows.length}건
                    </span>
                  )}
                  {parsed.unmappedHeaders.length > 0 && (
                    <span className="ml-2 text-muted">
                      (무시된 열: {parsed.unmappedHeaders.join(", ")})
                    </span>
                  )}
                  {errorRows.length > 0 && (
                    <ul className="mt-1 max-h-24 overflow-y-auto">
                      {errorRows.map((r) => (
                        <li key={r.rowIndex} className="text-vermilion">
                          {r.rowIndex}행: {r.errors.join(", ")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {result && (
                <div className="mt-3 border border-line-soft bg-cream p-2 text-xs text-ink">
                  <div>{result.inserted}건 등록 완료.</div>
                  {result.duplicates.length > 0 && (
                    <div className="mt-1 text-ink-soft">
                      중복 {result.duplicates.length}건 제외:{" "}
                      {result.duplicates
                        .map((d) => `${d.university_name}—${d.customer_name}`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
              {error && <p className="mt-2 text-xs text-vermilion">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-4 py-2">
              <button
                type="button"
                onClick={close}
                className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:bg-washi"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || validRows.length === 0}
                className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
              >
                {pending ? "등록 중…" : `${validRows.length}건 등록`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/dashboard/contacts/__tests__/BulkPasteContacts.test.tsx`
Expected: PASS (4 tests). (등록 버튼 name 정규식 `/등록/`은 "N건 등록" 매칭)

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/contacts/BulkPasteContacts.tsx src/app/dashboard/contacts/__tests__/BulkPasteContacts.test.tsx
git commit -m "feat(contacts): 붙여넣기 일괄등록 모달 컴포넌트"
```

---

### Task 5: 페이지 연결 + 최종 검증

**Files:**
- Modify: `src/app/dashboard/contacts/page.tsx`

- [ ] **Step 1: import 추가** (다른 import 옆)

```tsx
import { BulkPasteContacts } from "./BulkPasteContacts";
```

- [ ] **Step 2: ListPattern에 prop 추가** — `canCreate={canEdit}` 줄 아래(또는 onPersist 위)에:

```tsx
      extraActionsLeft={canEdit ? <BulkPasteContacts /> : undefined}
```

- [ ] **Step 3: typecheck + 전체 contacts 테스트**

Run: `npx tsc --noEmit`
Expected: 0 errors

Run: `npx vitest run src/features/contacts/ src/app/dashboard/contacts/`
Expected: PASS (전부)

- [ ] **Step 4: 커밋**

```bash
git add src/app/dashboard/contacts/page.tsx
git commit -m "feat(contacts): 일괄등록 버튼을 신규 연락처 왼쪽에 연결"
```

- [ ] **Step 5: PR 생성** (머지·배포는 사용자 승인 후)

```bash
git push -u origin feat/contacts-bulk-paste
gh pr create --base main --title "feat(contacts): 대학연락처 붙여넣기 일괄 등록" --body "스펙: docs/superpowers/specs/2026-06-17-contacts-bulk-paste-design.md"
```

---

## Self-Review

- **Spec coverage:** 파서(Task1)·중복판정/insert(Task2)·진입 슬롯(Task3)·UI 모달(Task4)·배치(Task5) — 스펙 ①~⑥ 모두 매핑. 오류/중복/headerError 처리 포함.
- **Placeholder scan:** 모든 코드 단계에 실제 코드 포함, TODO 없음.
- **Type consistency:** `ParsedValues`/`ParsedContactRow`/`ParseResult`/`toContactCreate`/`BulkCreateResult`/`createContactsBulk` 시그니처가 Task 간 일치. `ContactCreate`는 schemas에서 import.
- 비고: Task2의 `import("./schemas").ContactCreate` 인라인 타입은 상단 import로 정리 가능(동작 동일).
