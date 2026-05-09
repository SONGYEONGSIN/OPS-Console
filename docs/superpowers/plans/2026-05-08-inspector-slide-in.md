# Inspector Slide-in Implementation Plan (Epic 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** List/Dash/Project 패턴에서 항목 클릭 시 우측 슬라이드인 Inspector + 인플레이스 편집 + 클라이언트 mock 갱신.

**Architecture:** 공통 셸 `<InspectorPanel>` (슬라이드 트랜지션 + ESC/외부 클릭 닫기) + `useInspectorState<T>` 훅 (selected + editing 묶음) + 패턴별 Body 3개. 페이지 컴포넌트가 mock state(rows/widgets/projects) 보유, onSave 시 local state 갱신.

**Tech Stack:** Next.js client components, Tailwind v4 transition utilities, vitest + @testing-library/react + fireEvent.keyDown for ESC, playwright clock-free e2e.

**Spec:** `docs/superpowers/specs/2026-05-08-inspector-slide-in-design.md`

**HARD-GATE 등급:** 간략 설계 (12-15 파일)

---

## File Structure

### Create
- `src/app/dashboard/_components/inspector/useInspectorState.ts`
- `src/app/dashboard/_components/inspector/InspectorPanel.tsx`
- `src/app/dashboard/_components/inspector/InspectorListBody.tsx`
- `src/app/dashboard/_components/inspector/InspectorDashBody.tsx`
- `src/app/dashboard/_components/inspector/InspectorProjectBody.tsx`
- `src/app/dashboard/_components/inspector/__tests__/useInspectorState.test.ts`
- `src/app/dashboard/_components/inspector/__tests__/InspectorPanel.test.tsx`
- `src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx`
- `src/app/dashboard/_components/inspector/__tests__/InspectorDashBody.test.tsx`
- `src/app/dashboard/_components/inspector/__tests__/InspectorProjectBody.test.tsx`

### Modify
- `src/app/dashboard/_components/patterns/ListPattern.tsx` — 영구 aside 제거, slide-in 통합
- `src/app/dashboard/_components/patterns/DashPattern.tsx` — 위젯 onClick + InspectorPanel
- `src/app/dashboard/_components/patterns/ProjectPattern.tsx` — 카드 onClick + InspectorPanel
- `e2e/dashboard.spec.ts` — Inspector e2e (services 행 + alerts 위젯)

---

## Task 1: useInspectorState hook

**Files:**
- Create: `src/app/dashboard/_components/inspector/useInspectorState.ts`
- Create: `src/app/dashboard/_components/inspector/__tests__/useInspectorState.test.ts`

**Goal:** selected + editing 상태와 open/close/toggleEdit 함수 묶은 hook. generic T로 패턴별 데이터 타입 안전.

- [ ] **Step 1: 실패 테스트**

`src/app/dashboard/_components/inspector/__tests__/useInspectorState.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInspectorState } from "../useInspectorState";

type Row = { id: string; name: string };

describe("useInspectorState", () => {
  it("초기 selected null + editing false", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    expect(result.current.selected).toBeNull();
    expect(result.current.editing).toBe(false);
  });

  it("open(row) — selected = row, editing = false", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    act(() => result.current.open({ id: "r1", name: "Row 1" }));
    expect(result.current.selected).toEqual({ id: "r1", name: "Row 1" });
    expect(result.current.editing).toBe(false);
  });

  it("close() — selected null, editing false", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    act(() => result.current.open({ id: "r1", name: "Row 1" }));
    act(() => result.current.close());
    expect(result.current.selected).toBeNull();
    expect(result.current.editing).toBe(false);
  });

  it("toggleEdit() — editing 반전", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    act(() => result.current.open({ id: "r1", name: "Row 1" }));
    act(() => result.current.toggleEdit());
    expect(result.current.editing).toBe(true);
    act(() => result.current.toggleEdit());
    expect(result.current.editing).toBe(false);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/useInspectorState.test.ts
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/inspector/useInspectorState.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";

export type InspectorState<T> = {
  selected: T | null;
  editing: boolean;
  open: (item: T) => void;
  close: () => void;
  toggleEdit: () => void;
};

export function useInspectorState<T>(): InspectorState<T> {
  const [selected, setSelected] = useState<T | null>(null);
  const [editing, setEditing] = useState(false);

  const open = useCallback((item: T) => {
    setSelected(item);
    setEditing(false);
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    setEditing(false);
  }, []);

  const toggleEdit = useCallback(() => {
    setEditing((v) => !v);
  }, []);

  return { selected, editing, open, close, toggleEdit };
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/useInspectorState.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/useInspectorState.ts src/app/dashboard/_components/inspector/__tests__/useInspectorState.test.ts
git commit -m "feat: useInspectorState — selected + editing 묶음 훅"
```

---

## Task 2: InspectorPanel (공통 셸)

**Files:**
- Create: `src/app/dashboard/_components/inspector/InspectorPanel.tsx`
- Create: `src/app/dashboard/_components/inspector/__tests__/InspectorPanel.test.tsx`

**Goal:** 슬라이드인 셸 + ESC/외부 클릭 닫기 + 닫기 버튼.

- [ ] **Step 1: 실패 테스트**

`src/app/dashboard/_components/inspector/__tests__/InspectorPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorPanel } from "../InspectorPanel";

describe("InspectorPanel", () => {
  it("open=true — 패널 visible (translate-x-0)", () => {
    render(
      <InspectorPanel open={true} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>
    );
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("translate-x-0");
  });

  it("open=false — 패널 hidden (translate-x-full)", () => {
    render(
      <InspectorPanel open={false} onClose={vi.fn()}>
        <p>내용</p>
      </InspectorPanel>
    );
    const panel = screen.getByRole("complementary");
    expect(panel.className).toContain("translate-x-full");
  });

  it("ESC 키 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("닫기 버튼 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <InspectorPanel open={true} onClose={onClose}>
        <p>내용</p>
      </InspectorPanel>
    );
    fireEvent.click(screen.getByRole("button", { name: /닫기/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("외부 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(
      <div>
        <button>외부</button>
        <InspectorPanel open={true} onClose={onClose}>
          <p>내용</p>
        </InspectorPanel>
      </div>
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "외부" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorPanel.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/inspector/InspectorPanel.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function InspectorPanel({ open, onClose, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  return (
    <aside
      ref={ref}
      role="complementary"
      aria-hidden={!open}
      className={`fixed right-0 top-0 z-40 h-screen w-full bg-washi-raised border-l border-line transition-transform duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] [box-shadow:var(--shadow-drawer-right)] md:w-[380px] ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-ink hover:text-vermilion"
      >
        ×
      </button>
      <div className="h-full overflow-y-auto p-5 pt-12">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorPanel.test.tsx
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/InspectorPanel.tsx src/app/dashboard/_components/inspector/__tests__/InspectorPanel.test.tsx
git commit -m "feat: InspectorPanel — 슬라이드인 셸 + ESC/외부 클릭/닫기 버튼"
```

---

## Task 3: InspectorListBody (List 행 편집)

**Files:**
- Create: `src/app/dashboard/_components/inspector/InspectorListBody.tsx`
- Create: `src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx`

**Goal:** ListRow 데이터 read 모드 표시 + edit 모드 폼 + 저장/취소.

- [ ] **Step 1: 실패 테스트**

`src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorListBody } from "../InspectorListBody";
import type { ListRow } from "../../patterns/ListPattern";

const fixture: ListRow = {
  id: "svc-pay-001",
  name: "결제 게이트웨이",
  status: "urgent",
  owner: "박현주",
};

describe("InspectorListBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorListBody row={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("svc-pay-001")).toBeInTheDocument();
    expect(screen.getByText("결제 게이트웨이")).toBeInTheDocument();
    expect(screen.getByText("박현주")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edit 모드 — input 노출", () => {
    render(
      <InspectorListBody row={fixture} editing={true} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByLabelText("이름")).toHaveValue("결제 게이트웨이");
    expect(screen.getByLabelText("담당")).toHaveValue("박현주");
  });

  it("저장 — onSave(next) 호출, next에 변경 반영", () => {
    const onSave = vi.fn();
    render(
      <InspectorListBody row={fixture} editing={true} onSave={onSave} onCancel={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "결제 GW v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, name: "결제 GW v2" });
  });

  it("취소 — onCancel 호출, onSave 호출 X", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <InspectorListBody row={fixture} editing={true} onSave={onSave} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/inspector/InspectorListBody.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

export function InspectorListBody({ row, editing, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return (
      <dl className="space-y-3 text-sm">
        <Row term="ID" desc={<span className="font-mono">{row.id}</span>} />
        <Row term="이름" desc={<span className="font-semibold">{row.name}</span>} />
        <Row term="상태" desc={<span>{row.status}</span>} />
        <Row term="담당" desc={<span>{row.owner}</span>} />
      </dl>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당</span>
        <input
          aria-label="담당"
          value={draft.owner}
          onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep"
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
    </form>
  );
}

function Row({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      <dt className="text-xs text-muted">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/InspectorListBody.tsx src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx
git commit -m "feat: InspectorListBody — ListRow read/edit + 저장·취소"
```

---

## Task 4: InspectorDashBody (Dash 위젯 편집)

**Files:**
- Create: `src/app/dashboard/_components/inspector/InspectorDashBody.tsx`
- Create: `src/app/dashboard/_components/inspector/__tests__/InspectorDashBody.test.tsx`

**Goal:** DashWidget 데이터 read/edit + 저장/취소.

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorDashBody } from "../InspectorDashBody";
import type { DashWidget } from "../../patterns/DashPattern";

const fixture: DashWidget = {
  id: "alert-1",
  label: "긴급 알림",
  value: "1건",
  time: "14:30",
  tone: "urgent",
};

describe("InspectorDashBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorDashBody widget={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("긴급 알림")).toBeInTheDocument();
    expect(screen.getByText("1건")).toBeInTheDocument();
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edit + 저장 — onSave(next) 호출", () => {
    const onSave = vi.fn();
    render(
      <InspectorDashBody widget={fixture} editing={true} onSave={onSave} onCancel={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("라벨"), { target: { value: "검토 알림" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, label: "검토 알림" });
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <InspectorDashBody widget={fixture} editing={true} onSave={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorDashBody.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/inspector/InspectorDashBody.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { DashWidget } from "../patterns/DashPattern";

type Props = {
  widget: DashWidget;
  editing: boolean;
  onSave: (next: DashWidget) => void;
  onCancel: () => void;
};

export function InspectorDashBody({ widget, editing, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<DashWidget>(widget);

  if (!editing) {
    return (
      <dl className="space-y-3 text-sm">
        <Row term="라벨" desc={<span className="font-semibold">{widget.label}</span>} />
        <Row term="값" desc={<span>{widget.value}</span>} />
        <Row term="시각" desc={<span className="font-mono">{widget.time}</span>} />
        <Row term="톤" desc={<span>{widget.tone}</span>} />
      </dl>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">라벨</span>
        <input
          aria-label="라벨"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">값</span>
        <input
          aria-label="값"
          value={draft.value}
          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep"
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
    </form>
  );
}

function Row({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      <dt className="text-xs text-muted">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorDashBody.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/inspector/InspectorDashBody.tsx src/app/dashboard/_components/inspector/__tests__/InspectorDashBody.test.tsx
git commit -m "feat: InspectorDashBody — DashWidget read/edit + 저장·취소"
```

---

## Task 5: InspectorProjectBody (Project 카드 편집)

**Files:**
- Create: `src/app/dashboard/_components/inspector/InspectorProjectBody.tsx`
- Create: `src/app/dashboard/_components/inspector/__tests__/InspectorProjectBody.test.tsx`

**Goal:** ProjectCard 데이터 read/edit + 저장/취소. ProjectCard 타입은 `_data/patterns.ts`의 ProjectMockData 안 cards 배열 element.

- [ ] **Step 1: 기존 ProjectCard 타입 확인**

먼저 `src/app/dashboard/_data/patterns.ts`와 `src/app/dashboard/_components/patterns/ProjectPattern.tsx`를 읽어 ProjectCard 타입의 정확한 필드 확인. 타입 export 없으면 ProjectPattern.tsx에서 추출하여 export 필요.

다음 가정으로 진행 (실제 필드는 코드 확인 후 일치 시킬 것):

```typescript
type ProjectCard = {
  id: string;
  name: string;
  status: string;
  owner: string;
};
```

- [ ] **Step 2: 실패 테스트**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorProjectBody } from "../InspectorProjectBody";
import type { ProjectCard } from "../../patterns/ProjectPattern";

const fixture: ProjectCard = {
  id: "proj-1",
  name: "결제 시스템 v2",
  status: "진행 중",
  owner: "박현주",
};

describe("InspectorProjectBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorProjectBody project={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("결제 시스템 v2")).toBeInTheDocument();
    expect(screen.getByText("박현주")).toBeInTheDocument();
  });

  it("edit + 저장 — onSave(next) 호출", () => {
    const onSave = vi.fn();
    render(
      <InspectorProjectBody project={fixture} editing={true} onSave={onSave} onCancel={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "결제 v3" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, name: "결제 v3" });
  });
});
```

- [ ] **Step 3: RED 확인 + ProjectCard 타입 export**

기존 ProjectPattern.tsx 또는 patterns.ts에서 `ProjectCard` 타입 export 확인. 없으면 다음 추가:

`src/app/dashboard/_components/patterns/ProjectPattern.tsx` 상단에 ProjectCard 타입 export (실제 필드는 패턴의 카드 데이터 구조에 맞춤).

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorProjectBody.test.tsx
```

Expected: FAIL — Cannot find module 또는 타입 import 에러.

- [ ] **Step 4: 구현**

`src/app/dashboard/_components/inspector/InspectorProjectBody.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ProjectCard } from "../patterns/ProjectPattern";

type Props = {
  project: ProjectCard;
  editing: boolean;
  onSave: (next: ProjectCard) => void;
  onCancel: () => void;
};

export function InspectorProjectBody({ project, editing, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ProjectCard>(project);

  if (!editing) {
    return (
      <dl className="space-y-3 text-sm">
        <Row term="ID" desc={<span className="font-mono">{project.id}</span>} />
        <Row term="이름" desc={<span className="font-semibold">{project.name}</span>} />
        <Row term="상태" desc={<span>{project.status}</span>} />
        <Row term="담당" desc={<span>{project.owner}</span>} />
      </dl>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당</span>
        <input
          aria-label="담당"
          value={draft.owner}
          onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep"
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
    </form>
  );
}

function Row({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      <dt className="text-xs text-muted">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}
```

- [ ] **Step 5: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/inspector/__tests__/InspectorProjectBody.test.tsx
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/_components/inspector/InspectorProjectBody.tsx src/app/dashboard/_components/inspector/__tests__/InspectorProjectBody.test.tsx src/app/dashboard/_components/patterns/ProjectPattern.tsx
git commit -m "feat: InspectorProjectBody — ProjectCard read/edit + 저장·취소"
```

---

## Task 6: ListPattern Inspector 통합 (영구 aside 제거)

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx`

**Goal:** 기존 lg+ 영구 `<aside>` 제거 + InspectorPanel 슬라이드인 통합 + mock state 보유 + onSave 갱신.

- [ ] **Step 1: ListPattern.tsx 변경**

기존 ListPattern은 `<section>` + `<aside>` 2단 grid. aside를 제거하고 InspectorPanel을 본체 외부에 배치 + useInspectorState 훅 + onSave에서 rows state 갱신.

```tsx
"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { useInspectorState } from "../inspector/useInspectorState";

export type ListRow = {
  id: string;
  name: string;
  status: "urgent" | "active" | "review" | "approved";
  owner: string;
  meta?: string;
};

const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "긴급",
  active: "활성",
  review: "점검중",
  approved: "정상",
};

const STATUS_COLOR: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage text-cream",
  review: "bg-gold text-cream",
  approved: "bg-line-soft text-ink",
};

type Props = { title: string; data: { rows: ListRow[] } };

export function ListPattern({ title, data }: Props) {
  const [rows, setRows] = useState<ListRow[]>(data.rows);
  const inspector = useInspectorState<ListRow>();

  return (
    <>
      <section className="p-7">
        <h2 className="mb-5 text-xl font-bold text-ink">{title}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">담당</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => inspector.open(row)}
                    className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                      inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted">{row.id}</td>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={inspector.close}
      >
        {inspector.selected && (
          <>
            <header className="mb-4 border-b border-line-soft pb-3">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                인스펙터 · 항목 상세
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">{inspector.selected.name}</h3>
              <button
                type="button"
                onClick={inspector.toggleEdit}
                className="mt-2 text-xs text-vermilion underline hover:text-vermilion-deep"
              >
                {inspector.editing ? "읽기 모드" : "편집"}
              </button>
            </header>
            <InspectorListBody
              row={inspector.selected}
              editing={inspector.editing}
              onSave={(next) => {
                setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
                inspector.close();
              }}
              onCancel={inspector.toggleEdit}
            />
          </>
        )}
      </InspectorPanel>
    </>
  );
}
```

- [ ] **Step 2: 기존 ListPattern.test.tsx 회귀 확인**

```bash
npm test -- src/app/dashboard/_components/patterns
```

Expected: 기존 어설션 일부 영향. aside 관련 어설션은 갱신/삭제. 기본 행 렌더 + 클릭 → 패널 표시 어설션은 신규 추가 또는 기존 갱신.

(기존 테스트 파일이 있다면 read하고 영향 받는 어설션 갱신. 없으면 통과.)

- [ ] **Step 3: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx
# 만약 ListPattern.test.tsx도 변경됐다면 같이 add
git commit -m "feat: ListPattern Inspector 슬라이드인 통합 — 영구 aside 제거"
```

---

## Task 7: DashPattern Inspector 통합

**Files:**
- Modify: `src/app/dashboard/_components/patterns/DashPattern.tsx`

**Goal:** 위젯 onClick → InspectorPanel + InspectorDashBody.

- [ ] **Step 1: DashPattern.tsx 수정**

기존 DashPattern.tsx 읽고, 위젯 카드에 `onClick={() => inspector.open(widget)}` 추가 + InspectorPanel을 본체 끝에 배치. mock state 추가:

```tsx
"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorDashBody } from "../inspector/InspectorDashBody";
import { useInspectorState } from "../inspector/useInspectorState";

export type DashWidget = {
  id: string;
  label: string;
  value: string;
  time: string;
  tone: "urgent" | "review" | "ok";
};

type Props = { title: string; data: { widgets: DashWidget[] } };

export function DashPattern({ title, data }: Props) {
  const [widgets, setWidgets] = useState<DashWidget[]>(data.widgets);
  const inspector = useInspectorState<DashWidget>();

  return (
    <>
      <section className="p-7">
        <h2 className="mb-5 text-xl font-bold text-ink">{title}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((widget) => (
            <button
              key={widget.id}
              type="button"
              onClick={() => inspector.open(widget)}
              className={`flex cursor-pointer flex-col border border-line bg-washi-raised p-4 text-left hover:bg-cream ${
                inspector.selected?.id === widget.id ? "bg-cream" : ""
              }`}
            >
              <span className="text-xs uppercase tracking-[0.06em] text-muted">
                {widget.label}
              </span>
              <span
                className={`mt-2 text-2xl font-bold ${
                  widget.tone === "urgent"
                    ? "text-vermilion"
                    : widget.tone === "review"
                    ? "text-gold"
                    : "text-ink"
                }`}
              >
                {widget.value}
              </span>
              <span className="mt-1 font-mono text-xs text-muted">{widget.time}</span>
            </button>
          ))}
        </div>
      </section>

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={inspector.close}
      >
        {inspector.selected && (
          <>
            <header className="mb-4 border-b border-line-soft pb-3">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                인스펙터 · 위젯 상세
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                {inspector.selected.label}
              </h3>
              <button
                type="button"
                onClick={inspector.toggleEdit}
                className="mt-2 text-xs text-vermilion underline hover:text-vermilion-deep"
              >
                {inspector.editing ? "읽기 모드" : "편집"}
              </button>
            </header>
            <InspectorDashBody
              widget={inspector.selected}
              editing={inspector.editing}
              onSave={(next) => {
                setWidgets((prev) => prev.map((w) => (w.id === next.id ? next : w)));
                inspector.close();
              }}
              onCancel={inspector.toggleEdit}
            />
          </>
        )}
      </InspectorPanel>
    </>
  );
}
```

(주의: 기존 DashPattern 시각/구조와 차이가 클 경우 implementer가 기존 파일을 read해서 hover/active 클래스 등 시각 톤 보존하며 변경.)

- [ ] **Step 2: typecheck/test**

```bash
npx tsc --noEmit && npm test -- src/app/dashboard/_components/patterns
```

Expected: 0 errors, 회귀 통과.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_components/patterns/DashPattern.tsx
git commit -m "feat: DashPattern Inspector 슬라이드인 통합 — 위젯 클릭 핸들러"
```

---

## Task 8: ProjectPattern Inspector 통합

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ProjectPattern.tsx`

**Goal:** 카드 onClick → InspectorPanel + InspectorProjectBody. ProjectCard 타입 export.

- [ ] **Step 1: ProjectPattern.tsx 수정**

기존 ProjectPattern을 read해서 카드 구조 파악. 카드에 onClick 추가, InspectorPanel 통합, ProjectCard 타입 export. (Task 5에서 이미 export됐으면 재사용.)

```tsx
"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorProjectBody } from "../inspector/InspectorProjectBody";
import { useInspectorState } from "../inspector/useInspectorState";

export type ProjectCard = {
  id: string;
  name: string;
  status: string;
  owner: string;
};

type Props = { title: string; data: { cards: ProjectCard[] } };

export function ProjectPattern({ title, data }: Props) {
  const [cards, setCards] = useState<ProjectCard[]>(data.cards);
  const inspector = useInspectorState<ProjectCard>();

  return (
    <>
      <section className="p-7">
        <h2 className="mb-5 text-xl font-bold text-ink">{title}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => inspector.open(card)}
              className={`flex cursor-pointer flex-col border border-line bg-washi-raised p-4 text-left hover:bg-cream ${
                inspector.selected?.id === card.id ? "bg-cream" : ""
              }`}
            >
              <span className="text-xs uppercase tracking-[0.06em] text-muted">{card.id}</span>
              <span className="mt-2 text-md font-bold text-ink">{card.name}</span>
              <span className="mt-1 text-xs text-muted">{card.owner}</span>
              <span className="mt-2 inline-block self-start border border-line-soft px-2 py-0.5 text-xs">
                {card.status}
              </span>
            </button>
          ))}
        </div>
      </section>

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={inspector.close}
      >
        {inspector.selected && (
          <>
            <header className="mb-4 border-b border-line-soft pb-3">
              <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                인스펙터 · 프로젝트 상세
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">{inspector.selected.name}</h3>
              <button
                type="button"
                onClick={inspector.toggleEdit}
                className="mt-2 text-xs text-vermilion underline hover:text-vermilion-deep"
              >
                {inspector.editing ? "읽기 모드" : "편집"}
              </button>
            </header>
            <InspectorProjectBody
              project={inspector.selected}
              editing={inspector.editing}
              onSave={(next) => {
                setCards((prev) => prev.map((c) => (c.id === next.id ? next : c)));
                inspector.close();
              }}
              onCancel={inspector.toggleEdit}
            />
          </>
        )}
      </InspectorPanel>
    </>
  );
}
```

(기존 ProjectPattern 구조와 카드 필드가 다를 경우 implementer가 read 후 데이터 구조에 맞게 조정. ProjectCard 타입 필드 일치 필수.)

- [ ] **Step 2: typecheck/test**

```bash
npx tsc --noEmit && npm test -- src/app/dashboard/_components/patterns
```

Expected: 0 errors, 회귀 통과.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_components/patterns/ProjectPattern.tsx
git commit -m "feat: ProjectPattern Inspector 슬라이드인 통합 — 카드 클릭 핸들러"
```

---

## Task 9: e2e + 통합 검증

**Files:**
- Modify: `e2e/dashboard.spec.ts`

**Goal:** Inspector e2e flows + lint/typecheck/test 모두 통과.

- [ ] **Step 1: e2e 어설션 추가**

`e2e/dashboard.spec.ts`에 새 describe 추가:

```typescript
test.describe("/dashboard — Inspector 슬라이드인 (Epic 3)", () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    "TEST_USER_EMAIL/TEST_USER_PASSWORD 미설정",
  );

  test.beforeEach(async ({ page }) => {
    await signInAndGotoDashboard(page);
  });

  test("services 행 클릭 → 패널 열림 → ESC 닫힘", async ({ page }) => {
    await page.goto("/dashboard/services");
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();
    const panel = page.getByRole("complementary");
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  test("alerts 위젯 클릭 → 패널 열림 → 닫기 버튼 닫힘", async ({ page }) => {
    await page.goto("/dashboard/alerts");
    const firstWidget = page.locator("button").filter({ hasText: /\d+/ }).first();
    await firstWidget.click();
    const panel = page.getByRole("complementary");
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await page.getByRole("button", { name: /닫기/ }).click();
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: 통합 검증**

```bash
npm run lint
npx tsc --noEmit
npm test
```

Expected: 0 errors / 0 errors / 263 + 신규 (≈ 280+) 모두 통과.

- [ ] **Step 3: e2e 시도**

```bash
npm run e2e -- dashboard
```

Expected: 새 어설션 PASS. 환경 의존 실패 시 BLOCKED 보고.

- [ ] **Step 4: dev 서버 시각 확인**

dev 서버 띄워서 확인:
- `/dashboard/services` 행 클릭 → 슬라이드인 패널 → ESC/외부 클릭/닫기 버튼 모두 닫힘
- 편집 토글 → 폼 → 저장 → 데이터 갱신 + 패널 닫힘
- `/dashboard/alerts` 위젯 클릭 → DashBody → 동일 흐름
- `/dashboard/projects` (project pattern slug) 카드 → ProjectBody → 동일

- [ ] **Step 5: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test: e2e Inspector 슬라이드인 — services/alerts 어설션 (Epic 3)"
```

- [ ] **Step 6: Push**

```bash
git push
```

---

## Self-Review

**1. Spec 커버리지** — spec 모든 섹션 → task 매핑:

| Spec 섹션 | 구현 task |
|---|---|
| 3.1 컴포넌트 트리 | T1-T8 |
| 3.2 InspectorPanel | T2 |
| 3.3 useInspectorState | T1 |
| 3.4 패턴별 Body (List/Dash/Project) | T3, T4, T5 |
| 3.5 클릭 핸들러 통합 | T6, T7, T8 |
| 3.6 시각 (380px width, washi-raised) | T2 |
| 3.7 Header (kicker + 편집 토글 + 닫기) | T6, T7, T8 (각 패턴 안 header) |
| 4. 데이터 흐름 (페이지 local state 갱신) | T6, T7, T8 onSave |
| 5. 에러 처리 (ESC, 외부 클릭) | T2 |
| 6.1 단위 테스트 | T1-T5 |
| 6.2 e2e | T9 |
| 7. 영향 파일 (12-15) | 모든 task |
| 8. 리스크 (기존 ListPattern aside 제거) | T6 |
| 9. DoD | T9 |

**누락 없음.**

**2. Placeholder scan**: 모든 step 코드/명령 명시. T5 Step 1과 T8 Step 1에서 "기존 파일 read 후 구조 일치"는 모호 — implementer가 직접 확인 필요. plan 룰상 acceptable (existing code 의존 명시).

**3. Type 일관성**:
- `ListRow`, `DashWidget`, `ProjectCard` 모두 패턴 컴포넌트에서 export
- `useInspectorState<T>` generic
- `InspectorState<T>` 타입 일관 export
- `InspectorPanel` props (open, onClose, children) 모든 호출자 동일

**완료.**
