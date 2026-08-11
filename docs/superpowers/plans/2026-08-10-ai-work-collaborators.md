# 내 작업 공동작업자 필드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard/my-ai-work` 등록 폼에 공동작업자(다중 선택, 기본 '없음')를 추가하고, 목록·읽기 화면에 함께 표시한다.

**Architecture:** `ai_work`에 `collaborator_emails text[]` 한 컬럼을 더한다. 이메일만 저장하고 이름은 서버(RSC)에서 해석해 `ListRow`로 내려준다. 표시 전용이므로 RLS·목록 필터는 건드리지 않는다. 자기지정·중복 제거는 순수 함수 하나로 뽑아 server action 양쪽에서 재사용한다.

**Tech Stack:** Next.js App Router(RSC + server action), TypeScript, zod, Supabase(PostgREST), Vitest + @testing-library/react, Tailwind

설계 문서: `docs/superpowers/specs/2026-08-10-ai-work-collaborators-design.md`

## Global Constraints

- 커밋 메시지는 Conventional Commits + 한국어 (`feat:`, `fix:`, `test:`, `docs:`). 접두사만 영어
- TDD 강제 — 테스트 먼저 쓰고 **실패를 눈으로 확인한 뒤** 구현한다. RED 없는 테스트는 무효
- 불변성 — 입력 배열/객체를 변형하지 않는다. 항상 새 값을 만든다
- 컴포넌트에 하드코딩 색상(`#xxx`, `rgb()`, `hsl()`) 금지. Tailwind 토큰 클래스만 사용
- 입력창 표준 클래스: `w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white`
- `any`, `@ts-ignore`, `eslint-disable`, `console.log` 금지
- 작업 브랜치는 `feat/ai-work-collaborators` (이미 생성됨, 설계 문서 커밋 `dd08c22`)
- 테스트 실행은 `npx vitest run <경로>` (전체는 `npm test`)
- 이 기능은 **표시 전용**이다. RLS 정책, `listAiWorks` 필터, 검색·필터 칩은 이 계획 어디에서도 수정하지 않는다

---

### Task 1: 마이그레이션 작성 + Supabase 선적용

프로젝트 규칙상 DB 스키마 변경은 머지 전에 Supabase에 적용하고 service_role로 확인한다. 적용은 사람이 Supabase SQL Editor에서 수행한다.

**Files:**
- Create: `supabase/migrations/20260810_ai_work_collaborators.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `public.ai_work.collaborator_emails text[] not null default '{}'`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- ai_work — 공동작업자(collaborator_emails) 컬럼 추가.
-- 함께 작업한 운영자를 이메일 배열로 남긴다. 표시 전용이라 RLS 변경 없음.
-- 이름이 아니라 이메일을 저장하는 이유: 이름은 바뀌고 이메일은 안 바뀐다(author_email과 동일 규칙).
-- not null default '{}' — 기존 row는 빈 배열('없음')이 되어 백필이 필요 없다.

begin;

alter table public.ai_work
  add column if not exists collaborator_emails text[] not null default '{}';

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_name = 'ai_work' and column_name = 'collaborator_emails';
-- 기대: 1건 / ARRAY / NO
```

- [ ] **Step 2: Supabase에 적용 (사람이 수행)**

Supabase 대시보드 → SQL Editor에 위 SQL 전문을 붙여넣고 실행한다. 적용 전에는 다음 단계로 넘어가지 않는다.

- [ ] **Step 3: service_role로 적용 확인**

프로젝트 루트에 임시 스크립트를 만들어 실행한다 (scratchpad에 두면 `@supabase/supabase-js` 해석이 실패한다).

```js
// tmp-verify-collab.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await sb.from("ai_work").select("id, collaborator_emails").limit(3);
console.log(error ? `ERR ${error.message}` : JSON.stringify(data));
```

Run: `node ./tmp-verify-collab.mjs && rm -f ./tmp-verify-collab.mjs`
Expected: 에러 없이 `collaborator_emails`가 `[]`로 출력. `column ... does not exist`가 나오면 Step 2가 안 된 것이다.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260810_ai_work_collaborators.sql
git commit -m "feat: ai_work 공동작업자 컬럼 추가"
```

---

### Task 2: normalizeCollaborators 순수 함수

**Files:**
- Create: `src/features/ai-work/collaborators.ts`
- Test: `src/features/ai-work/__tests__/collaborators.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `normalizeCollaborators(emails: string[] | undefined, authorEmail: string): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from "vitest";
import { normalizeCollaborators } from "../collaborators";

describe("normalizeCollaborators", () => {
  it("중복을 제거한다", () => {
    expect(
      normalizeCollaborators(["a@x.com", "b@x.com", "a@x.com"], "me@x.com"),
    ).toEqual(["a@x.com", "b@x.com"]);
  });

  it("등록자 본인은 제거한다", () => {
    expect(
      normalizeCollaborators(["a@x.com", "me@x.com"], "me@x.com"),
    ).toEqual(["a@x.com"]);
  });

  it("선택한 순서를 유지한다", () => {
    expect(
      normalizeCollaborators(["c@x.com", "a@x.com", "b@x.com"], "me@x.com"),
    ).toEqual(["c@x.com", "a@x.com", "b@x.com"]);
  });

  it("undefined는 빈 배열이 된다", () => {
    expect(normalizeCollaborators(undefined, "me@x.com")).toEqual([]);
  });

  it("빈 배열은 빈 배열이다", () => {
    expect(normalizeCollaborators([], "me@x.com")).toEqual([]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const input = ["a@x.com", "a@x.com"];
    normalizeCollaborators(input, "me@x.com");
    expect(input).toEqual(["a@x.com", "a@x.com"]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ai-work/__tests__/collaborators.test.ts`
Expected: FAIL — `Failed to resolve import "../collaborators"`

- [ ] **Step 3: 최소 구현**

```ts
/**
 * 공동작업자 이메일 정규화 — 중복 제거 + 등록자 본인 제거. 선택한 순서는 유지한다.
 *
 * 폼에서도 중복·본인 선택을 막지만, server action은 폼을 거치지 않고 직접 호출될 수 있다.
 * 경계에서 한 번 더 적용해 저장 값이 항상 정규형이 되게 한다.
 */
export function normalizeCollaborators(
  emails: string[] | undefined,
  authorEmail: string,
): string[] {
  if (!emails) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    if (email === authorEmail) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ai-work/__tests__/collaborators.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/features/ai-work/collaborators.ts src/features/ai-work/__tests__/collaborators.test.ts
git commit -m "feat: 공동작업자 이메일 정규화 함수 추가"
```

---

### Task 3: zod 스키마에 collaborator_emails 추가

**Files:**
- Modify: `src/features/ai-work/schemas.ts`
- Test: `src/features/ai-work/__tests__/schemas.test.ts`
- Modify(픽스처): `src/features/ai-work/__tests__/queries.test.ts:35` 부근 row 픽스처

**Interfaces:**
- Consumes: 없음
- Produces:
  - `collaboratorEmailsSchema` (export) — `z.array(z.string().email())`
  - `aiWorkRowSchema`에 `collaborator_emails: string[]` (필수)
  - `aiWorkCreateSchema`에 `collaborator_emails: string[]` (기본값 `[]`)
  - `aiWorkUpdateSchema`에 `collaborator_emails?: string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/ai-work/__tests__/schemas.test.ts` 끝에 추가한다. `validRow`는 이 파일 68행 부근에 이미 있는 픽스처 이름이다.

```ts
describe("collaborator_emails", () => {
  it("row: 이메일 배열을 통과시킨다", () => {
    const parsed = aiWorkRowSchema.safeParse({
      ...validRow,
      collaborator_emails: ["a@x.com", "b@x.com"],
    });
    expect(parsed.success).toBe(true);
  });

  it("row: 컬럼이 없으면 거부한다 (DB가 not null이라 항상 온다)", () => {
    const { collaborator_emails: _omit, ...withoutColumn } = {
      ...validRow,
      collaborator_emails: [],
    };
    expect(aiWorkRowSchema.safeParse(withoutColumn).success).toBe(false);
  });

  it("이메일 형식이 아니면 거부한다", () => {
    const parsed = aiWorkRowSchema.safeParse({
      ...validRow,
      collaborator_emails: ["not-an-email"],
    });
    expect(parsed.success).toBe(false);
  });

  it("create: 생략하면 빈 배열이 기본값이다", () => {
    const parsed = aiWorkCreateSchema.safeParse({
      title: "제목",
      work_start_date: "2026-08-10",
      work_end_date: "2026-08-10",
      ai_tool: "claude",
      category: "code",
      summary_md: "요약",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.collaborator_emails).toEqual([]);
  });

  it("update: 생략 가능하다", () => {
    const parsed = aiWorkUpdateSchema.safeParse({ title: "수정" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.collaborator_emails).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ai-work/__tests__/schemas.test.ts`
Expected: FAIL — "row: 컬럼이 없으면 거부한다"가 실패한다(아직 필드가 없어 통과해버림). create 기본값 테스트도 `undefined`로 실패.

- [ ] **Step 3: 스키마 구현**

`src/features/ai-work/schemas.ts`에서 `dateRangeRefine` 정의 아래에 추가한다.

```ts
/** 공동작업자 이메일 배열 — operators.email 값을 담는다(이름 아님). */
export const collaboratorEmailsSchema = z.array(z.string().email());
```

그리고 세 스키마의 `tags` 줄 바로 아래에 각각 한 줄씩 넣는다.

```ts
// aiWorkRowSchema — tags: z.array(z.string()), 다음 줄
collaborator_emails: collaboratorEmailsSchema,

// aiWorkCreateSchema — tags: z.array(z.string()).default([]), 다음 줄
collaborator_emails: collaboratorEmailsSchema.default([]),

// aiWorkUpdateSchema — tags: z.array(z.string()).optional(), 다음 줄
collaborator_emails: collaboratorEmailsSchema.optional(),
```

- [ ] **Step 4: 기존 row 픽스처 2곳에 컬럼 추가**

row 스키마가 필수가 됐으므로 `aiWorkRowSchema`로 파싱되는 픽스처에 `collaborator_emails: []`를 넣는다.

- `src/features/ai-work/__tests__/schemas.test.ts` 68행 부근 `validRow`의 `author_email` 줄 아래
- `src/features/ai-work/__tests__/queries.test.ts` 35행 부근 row 픽스처의 `author_email` 줄 아래

둘 다 다음 한 줄을 추가한다.

```ts
  collaborator_emails: [],
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ai-work/__tests__/`
Expected: PASS (schemas / queries / actions / collaborators 전부)

- [ ] **Step 6: 커밋**

```bash
git add src/features/ai-work/schemas.ts src/features/ai-work/__tests__/schemas.test.ts src/features/ai-work/__tests__/queries.test.ts
git commit -m "feat: ai-work 스키마에 공동작업자 필드 추가"
```

---

### Task 4: server action에서 정규화 적용

**Files:**
- Modify: `src/features/ai-work/actions.ts` (create: 48-51행 payload / update: 87-92행 update 호출)
- Test: `src/features/ai-work/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `normalizeCollaborators` (Task 2), `collaborator_emails` 스키마 필드 (Task 3)
- Produces: 저장되는 `collaborator_emails`는 항상 정규형(중복 없음, 등록자 미포함)

핵심: `updateAiWork`는 **대상 row의 `author_email`** 기준으로 제외한다. admin이 남의 기록을 고칠 때 admin 자신을 빼면 엉뚱한 사람이 빠진다. 대상 row는 이미 83행 권한 검사를 위해 조회하고 있다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/ai-work/__tests__/actions.test.ts` 끝에 추가한다. `adminMe`는 이 파일에 이미 있는 픽스처다.

```ts
describe("공동작업자 정규화", () => {
  it("create: 등록자 본인과 중복을 제거하고 저장한다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "member@x.com",
      permission: "member",
    });
    mockInsert.mockResolvedValue({
      data: { author_email: "member@x.com" },
      error: null,
    });

    await createAiWork({
      title: "제목",
      work_start_date: "2026-08-10",
      work_end_date: "2026-08-10",
      ai_tool: "claude",
      category: "code",
      summary_md: "요약",
      collaborator_emails: ["a@x.com", "member@x.com", "a@x.com"],
    });

    expect(insertPayload().collaborator_emails).toEqual(["a@x.com"]);
  });

  it("update: admin이 남의 글을 고쳐도 제외 기준은 등록자다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });

    await updateAiWork("11111111-1111-4111-8111-111111111111", {
      collaborator_emails: ["other@x.com", "admin@x.com"],
    });

    // 등록자(other)는 빠지고 수정자(admin)는 남는다
    expect(updatePayload().collaborator_emails).toEqual(["admin@x.com"]);
  });

  it("update: 필드를 안 보내면 건드리지 않는다", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockTargetSelect.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });
    mockUpdate.mockResolvedValue({
      data: { author_email: "other@x.com" },
      error: null,
    });

    await updateAiWork("11111111-1111-4111-8111-111111111111", {
      title: "수정",
    });

    expect("collaborator_emails" in updatePayload()).toBe(false);
  });
});
```

payload를 읽으려면 supabase 목이 인자를 기억해야 한다. 파일 상단 `vi.mock("@/lib/supabase/server", ...)` 블록을 아래처럼 바꾸고, `vi.hoisted` 목록에 `mockInsertArgs`, `mockUpdateArgs`를 추가한다.

```ts
// vi.hoisted 안에 추가
mockInsertArgs: vi.fn(),
mockUpdateArgs: vi.fn(),

// createClient 목 안에서
insert: (payload: unknown) => {
  mockInsertArgs(payload);
  return { select: () => ({ single: mockInsert }) };
},
update: (payload: unknown) => {
  mockUpdateArgs(payload);
  return { eq: () => ({ select: () => ({ single: mockUpdate }) }) };
},
```

그리고 테스트 파일에 헬퍼 두 개를 둔다.

```ts
const insertPayload = () =>
  mockInsertArgs.mock.calls.at(-1)?.[0] as Record<string, unknown>;
const updatePayload = () =>
  mockUpdateArgs.mock.calls.at(-1)?.[0] as Record<string, unknown>;
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ai-work/__tests__/actions.test.ts`
Expected: FAIL — create는 `["a@x.com","member@x.com","a@x.com"]`이 그대로 저장되고, update는 `["other@x.com","admin@x.com"]`이 그대로 간다.

- [ ] **Step 3: 구현**

`src/features/ai-work/actions.ts` 상단 import에 추가한다.

```ts
import { normalizeCollaborators } from "./collaborators";
```

`createAiWork`의 payload(48-51행)를 바꾼다.

```ts
  const payload = {
    ...parsed.data,
    collaborator_emails: normalizeCollaborators(
      parsed.data.collaborator_emails,
      me!.email,
    ),
    author_email: me!.email,
  };
```

`updateAiWork`의 update 호출(87-92행) 앞에 정규화한 값을 만든다. `parsed.data`를 변형하지 않고 새 객체를 만든다.

```ts
  const patch =
    parsed.data.collaborator_emails === undefined
      ? parsed.data
      : {
          ...parsed.data,
          collaborator_emails: normalizeCollaborators(
            parsed.data.collaborator_emails,
            target.author_email as string,
          ),
        };

  const { data, error } = await supabase
    .from("ai_work")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ai-work/__tests__/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/ai-work/actions.ts src/features/ai-work/__tests__/actions.test.ts
git commit -m "feat: 공동작업자 저장 시 본인·중복 제거"
```

---

### Task 5: ListRow / EditFormProps 타입 확장 + 등록 폼

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` (`ListRow`의 `authorEmail?: string;` 327행 부근 아래)
- Modify: `src/app/dashboard/_components/inspector/list-variants/types.ts` (`EditFormProps`, `servicesOperators` 선언 부근)
- Modify: `src/app/dashboard/_components/inspector/list-variants/ai-work/EditForm.tsx`
- Test: `src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/EditForm.test.tsx`

**Interfaces:**
- Consumes: 없음(타입만)
- Produces:
  - `ListRow.collaboratorEmails?: string[]` — 폼이 편집하는 저장 값
  - `ListRow.collaboratorNames?: string[]` — Table/View 표시용(서버가 해석해 내려줌)
  - `EditFormProps.aiWorkOperators?: { email: string; name: string }[]` — 후보 목록

- [ ] **Step 1: 실패하는 테스트 작성**

`.../ai-work/__tests__/EditForm.test.tsx` 끝에 추가한다. `baseRow`는 이 파일에 이미 있는 픽스처다.

```ts
const operators = [
  { email: "a@x.com", name: "김영희" },
  { email: "b@x.com", name: "박철수" },
];

function renderForm(row: ListRow, setRow = vi.fn()) {
  render(
    <AiWorkForm
      row={row}
      setRow={setRow}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      currentUserEmail="hong@example.com"
      currentUserPermission="member"
      aiWorkOperators={operators}
    />,
  );
  return setRow;
}

describe("AiWorkForm — 공동작업자", () => {
  it("기본값은 '없음'이다", () => {
    renderForm(baseRow);
    const select = screen.getByLabelText("공동작업자") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "없음" })).toBeInTheDocument();
  });

  it("한 명 고르면 setRow에 이메일이 담긴다", () => {
    const setRow = renderForm(baseRow);
    fireEvent.change(screen.getByLabelText("공동작업자"), {
      target: { value: "a@x.com" },
    });
    expect(setRow).toHaveBeenCalledWith({
      ...baseRow,
      collaboratorEmails: ["a@x.com"],
    });
  });

  it("선택된 사람은 칩으로 보이고 옵션에서는 사라진다", () => {
    renderForm({ ...baseRow, collaboratorEmails: ["a@x.com"] });
    expect(screen.getByText("김영희")).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "김영희" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "박철수" })).toBeInTheDocument();
  });

  it("칩의 제거 버튼이 해당 이메일만 뺀다", () => {
    const setRow = renderForm({
      ...baseRow,
      collaboratorEmails: ["a@x.com", "b@x.com"],
    });
    fireEvent.click(screen.getByRole("button", { name: "김영희 제외" }));
    expect(setRow).toHaveBeenCalledWith({
      ...baseRow,
      collaboratorEmails: ["b@x.com"],
    });
  });

  it("후보를 모두 고르면 셀렉트가 비활성된다", () => {
    renderForm({ ...baseRow, collaboratorEmails: ["a@x.com", "b@x.com"] });
    expect(screen.getByLabelText("공동작업자")).toBeDisabled();
  });

  it("후보에 없는 이메일(퇴사자)도 칩으로 유지한다", () => {
    renderForm({ ...baseRow, collaboratorEmails: ["gone@x.com"] });
    expect(screen.getByText("gone")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/EditForm.test.tsx`
Expected: FAIL — `Unable to find a label with the text of: 공동작업자`

- [ ] **Step 3: 타입 2개 추가**

`ListPattern.tsx`의 `authorEmail?: string;` 줄 아래에 넣는다.

```ts
  /** ai-work — 공동작업자 이메일(저장 값). 표시 전용이라 권한에는 영향 없다. */
  collaboratorEmails?: string[];
  /** ai-work — 공동작업자 표시 이름. 서버(RSC)가 해석해 내려준다(Table/View는 후보 목록이 없다). */
  collaboratorNames?: string[];
```

`list-variants/types.ts`의 `servicesOperators` 선언 아래에 넣는다.

```ts
  /** ai-work variant — 공동작업자 후보 (active operators, 본인 제외) */
  aiWorkOperators?: { email: string; name: string }[];
```

- [ ] **Step 4: 폼 구현**

`EditForm.tsx` 시그니처에 prop을 받는다.

```ts
export function AiWorkForm({
  row,
  setRow,
  onSave,
  onCancel,
  currentUserEmail = null,
  currentUserPermission = null,
  aiWorkOperators = [],
}: EditFormProps) {
```

컴포넌트 본문 `const isAdmin = ...` 위에 파생값과 핸들러를 둔다.

```ts
  const selectedEmails = row.collaboratorEmails ?? [];
  // 이미 고른 사람은 후보에서 뺀다 — 중복 선택 자체를 불가능하게 한다.
  const remaining = aiWorkOperators.filter(
    (op) => !selectedEmails.includes(op.email),
  );
  // 후보에 없는 이메일(퇴사·비활성)도 기록이므로 지우지 않고 로컬파트로 보여준다.
  const nameOf = (email: string) =>
    aiWorkOperators.find((op) => op.email === email)?.name ??
    email.split("@")[0] ??
    email;

  const addCollaborator = (email: string) => {
    if (!email) return;
    setRow({ ...row, collaboratorEmails: [...selectedEmails, email] });
  };
  const removeCollaborator = (email: string) => {
    setRow({
      ...row,
      collaboratorEmails: selectedEmails.filter((e) => e !== email),
    });
  };
```

등록자 블록(36-44행 `{row.owner && (...)}`) **바로 아래**에 필드를 넣는다.

```tsx
      <div className="block text-xs">
        <label className="block">
          <span className="mb-1 block text-muted">공동작업자</span>
          <select
            aria-label="공동작업자"
            value=""
            disabled={remaining.length === 0}
            onChange={(e) => addCollaborator(e.target.value)}
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white disabled:text-muted"
          >
            <option value="">없음</option>
            {remaining.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name}
              </option>
            ))}
          </select>
        </label>
        {selectedEmails.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1">
            {selectedEmails.map((email) => (
              <li
                key={email}
                className="inline-flex items-center gap-1 border border-line-soft bg-washi-raised px-2 py-0.5 text-2xs text-ink"
              >
                {nameOf(email)}
                <button
                  type="button"
                  aria-label={`${nameOf(email)} 제외`}
                  onClick={() => removeCollaborator(email)}
                  className="text-muted hover:text-vermilion"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
```

`value=""`로 고정하는 것이 '선택 후 없음으로 복귀'를 만든다 — 선택은 `onChange`에서 칩으로 옮겨가고 셀렉트는 항상 '없음'을 보여준다.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/EditForm.test.tsx`
Expected: PASS (기존 삭제 버튼 테스트 포함 전부)

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/_components/inspector/list-variants/types.ts src/app/dashboard/_components/inspector/list-variants/ai-work/EditForm.tsx src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/EditForm.test.tsx
git commit -m "feat: 내 작업 등록 폼에 공동작업자 선택 추가"
```

---

### Task 6: 목록 테이블 등록자 칸에 함께 표시

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/ai-work/Table.tsx:79`
- Test: `src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/Table.test.tsx` (신규)

**Interfaces:**
- Consumes: `ListRow.collaboratorNames` (Task 5)
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiWorkTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "회의록 자동화",
  status: "active",
  owner: "송영신",
};

describe("AiWorkTable — 등록자 칸", () => {
  it("공동작업자가 있으면 쉼표로 이어 붙인다", () => {
    render(
      <AiWorkTable
        rows={[{ ...baseRow, collaboratorNames: ["홍길동", "김영희"] }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("송영신, 홍길동, 김영희")).toBeInTheDocument();
  });

  it("공동작업자가 없으면 등록자만 보인다", () => {
    render(
      <AiWorkTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
  });

  it("빈 배열도 등록자만 보인다", () => {
    render(
      <AiWorkTable
        rows={[{ ...baseRow, collaboratorNames: [] }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/Table.test.tsx`
Expected: FAIL — "송영신, 홍길동, 김영희" 텍스트를 찾지 못한다

- [ ] **Step 3: 구현**

`AiWorkTable`의 `rows.map((row) => {` 블록 안, `const cat = ...` 아래에 파생값을 만든다.

```ts
            // 등록자 + 공동작업자를 한 칸에 나열한다. 길어지면 CSS로 한 줄 말줄임.
            const people = [row.owner, ...(row.collaboratorNames ?? [])]
              .filter(Boolean)
              .join(", ");
```

79행 셀을 바꾼다.

```tsx
                <td className="max-w-[12rem] truncate px-3 py-2 text-sm text-ink-soft">
                  {people}
                </td>
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/Table.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/ai-work/Table.tsx src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/Table.test.tsx
git commit -m "feat: 내 작업 목록 등록자 칸에 공동작업자 표시"
```

---

### Task 7: 읽기 화면에 공동작업자 항목 추가

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/ai-work/View.tsx:66`
- Test: `src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/View.test.tsx` (신규)

**Interfaces:**
- Consumes: `ListRow.collaboratorNames` (Task 5)
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiWorkView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "회의록 자동화",
  status: "active",
  owner: "송영신",
};

describe("AiWorkView — 공동작업자", () => {
  it("이름을 쉼표로 나열한다", () => {
    render(<AiWorkView row={{ ...baseRow, collaboratorNames: ["홍길동", "김영희"] }} />);
    expect(screen.getByText("공동작업자")).toBeInTheDocument();
    expect(screen.getByText("홍길동, 김영희")).toBeInTheDocument();
  });

  it("없으면 '없음'으로 표시한다", () => {
    render(<AiWorkView row={baseRow} />);
    expect(screen.getByText("공동작업자")).toBeInTheDocument();
    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/View.test.tsx`
Expected: FAIL — "공동작업자" 텍스트 없음

- [ ] **Step 3: 구현**

`View.tsx` 66행 `{ term: "등록자", desc: row.owner },` **바로 아래**에 넣는다. 값이 없는 것이 정상 상태이므로 다른 항목의 `—` 대신 `없음`을 쓴다.

```tsx
              {
                term: "공동작업자",
                desc:
                  row.collaboratorNames && row.collaboratorNames.length > 0
                    ? row.collaboratorNames.join(", ")
                    : "없음",
              },
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/View.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/ai-work/View.tsx src/app/dashboard/_components/inspector/list-variants/ai-work/__tests__/View.test.tsx
git commit -m "feat: 내 작업 읽기 화면에 공동작업자 표시"
```

---

### Task 8: 페이지 배선 + 전체 검증

여기까지는 후보 목록도 표시 이름도 아무도 주입하지 않는다. 이 태스크가 화면을 실제로 동작시킨다.

**Files:**
- Modify: `src/app/dashboard/my-ai-work/page.tsx` (36행 부근 데이터 로드 / 61-96행 `onPersist` / 137행 부근 `aiWorkToListRow` / `<ListPattern>` prop)
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx:655,740,997` (prop 통과)
- Modify: `src/app/dashboard/_components/inspector/InspectorListBody.tsx:46,119,177` (prop 통과)

**Interfaces:**
- Consumes: `listOperators()`, `aiWorkOperators` prop (Task 5), `ListRow.collaborator*` (Task 5)
- Produces: 없음 (최종 배선)

- [ ] **Step 1: 후보 목록 + 이름 맵 만들기**

`page.tsx` 상단 import에 추가한다.

```ts
import { listOperators } from "@/features/operators/queries";
```

`const allWorks = await listAiWorks();` 아래에 넣는다. `backup/page.tsx:56-59`와 같은 패턴이다.

```ts
  const allOperators = await listOperators();
  // 후보는 재직 중 + 본인 제외 (backup 도메인과 동일 규칙).
  const aiWorkOperators = allOperators
    .filter((op) => op.status === "active" && op.email !== me?.email)
    .map((op) => ({ email: op.email, name: op.name }));
  // 표시 이름은 퇴사자도 풀어야 하므로 필터 전 전체 목록으로 만든다.
  const operatorNameByEmail = new Map(
    allOperators.map((op) => [op.email, op.name] as const),
  );
```

- [ ] **Step 2: ListRow 매핑에 두 필드 채우기**

`aiWorkToListRow` 시그니처와 호출을 바꾼다.

```ts
function aiWorkToListRow(
  w: AiWorkRow,
  ownerByEmail: Map<string, string>,
  nameByEmail: Map<string, string>,
): ListRow {
```

반환 객체의 `authorEmail: w.author_email,` 아래에 추가한다.

```ts
    collaboratorEmails: w.collaborator_emails,
    collaboratorNames: w.collaborator_emails.map(
      (email) => nameByEmail.get(email) ?? email.split("@")[0] ?? email,
    ),
```

호출부(44행)를 바꾼다.

```ts
    works.map((w) => aiWorkToListRow(w, ownerByEmail, operatorNameByEmail)),
```

- [ ] **Step 3: 저장 경로에 필드 싣기**

`onPersist`의 `createAiWork({...})`에 `tags` 다음 줄로 추가한다.

```ts
        collaborator_emails: row.collaboratorEmails ?? [],
```

`updateAiWork(row.id, {...})`에도 같은 줄을 추가한다.

```ts
      collaborator_emails: row.collaboratorEmails ?? [],
```

- [ ] **Step 4: 후보를 폼까지 전달 (3단계 배선)**

prop은 `page → ListPattern → InspectorListBody → EditForm`으로 흐른다. `backupOperators`가 지나는 6곳과 똑같은 자리에 한 줄씩 넣는다. 한 군데라도 빠지면 폼에 후보가 `[]`로 도착해 셀렉트가 계속 비활성이다.

`src/app/dashboard/_components/patterns/ListPattern.tsx` — 3곳

```ts
// 655행 backupOperators 선언 아래 (props 타입)
  /** ai-work variant — 공동작업자 후보 (active operators, 본인 제외) */
  aiWorkOperators?: { email: string; name: string }[];

// 740행 backupOperators 아래 (구조분해)
  aiWorkOperators,

// 997행 backupOperators={backupOperators} 아래 (InspectorListBody로 전달)
              aiWorkOperators={aiWorkOperators}
```

`src/app/dashboard/_components/inspector/InspectorListBody.tsx` — 3곳

```ts
// 46행 backupOperators 선언 아래 (props 타입)
  aiWorkOperators?: { email: string; name: string }[];

// 119행 backupOperators 아래 (구조분해)
  aiWorkOperators,

// 177행 backupOperators={backupOperators} 아래 (EditForm으로 전달)
        aiWorkOperators={aiWorkOperators}
```

`src/app/dashboard/my-ai-work/page.tsx` — `<ListPattern>`의 `currentUserPermission` 아래

```tsx
      aiWorkOperators={aiWorkOperators}
```

- [ ] **Step 5: 정적 검증**

Run: `npm run typecheck`
Expected: 에러 0

Run: `npm run lint`
Expected: 경고·에러 0

- [ ] **Step 6: 전체 테스트**

Run: `npm test`
Expected: 전부 통과, 실패 0

- [ ] **Step 7: 빌드**

Run: `npm run build`
Expected: exit 0. `NODE_ENV=development`가 셸에 새어 있으면 `/_global-error` useContext 에러가 나므로 그때는 `unset NODE_ENV` 후 재실행한다.

- [ ] **Step 8: 실화면 확인**

`npm run dev` 후 `/dashboard/my-ai-work`에서 확인한다.

1. 신규 등록 → 공동작업자 셀렉트가 '없음'으로 시작
2. 두 명 선택 → 칩 2개, 셀렉트는 '없음'으로 복귀, 고른 사람은 옵션에서 사라짐
3. 저장 → 목록 '등록자' 칸에 `내이름, 이름, 이름`
4. 항목 클릭 → 읽기 화면 '공동작업자'에 두 명
5. 수정 → 칩 하나 `×` 제거 후 저장 → 목록·읽기에 반영
6. 공동작업자 없이 등록 → 읽기 화면에 '없음'

- [ ] **Step 9: 커밋**

```bash
git add src/app/dashboard/my-ai-work/page.tsx src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/_components/inspector/InspectorListBody.tsx
git commit -m "feat: 내 작업 페이지에 공동작업자 후보·표시 배선"
```

---

## 완료 기준

- [ ] Task 1-8 전부 완료, 각 커밋 존재
- [ ] `npm test` / `npm run typecheck` / `npm run lint` / `npm run build` 전부 통과 (실행 결과로 확인)
- [ ] Task 8 Step 8의 실화면 6항목 확인
- [ ] Supabase에 마이그레이션 적용 완료 (Task 1 Step 3 증거)
- [ ] RLS 정책, `listAiWorks` 필터, 검색·필터 칩은 **변경되지 않았음**을 `git diff main --stat`으로 확인
