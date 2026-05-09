# ListPattern 부수 UI 복원 Implementation Plan (Epic 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ListPattern에 필터(전체/긴급/활성/점검중/정상) + 동적 카운트 + "Demo · 실제 데이터 미연결" 안내문 복원. Inspector 통합은 그대로.

**Architecture:** 단일 파일(ListPattern.tsx) 인라인 변경. `filter` state + `filteredRows` derived. 카운트는 `filteredRows.length` 동적. 안내문은 정적 footer.

**Tech Stack:** Next.js client component, Tailwind v4, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-09-listpattern-restore-design.md`

**HARD-GATE 등급:** 인라인 설계 (1 파일 + 테스트)

---

## File Structure

### Modify
- `src/app/dashboard/_components/patterns/ListPattern.tsx` — filter state + filteredRows + heading count + 안내문
- `src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx` — 어설션 추가

---

## Task 1: ListPattern 필터/카운트/안내문 복원 (RED → GREEN)

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx`
- Modify: `src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx`

**Goal:** filter UI + 동적 카운트 + 안내문 복원 + 회귀 가드 테스트.

- [ ] **Step 1: 실패 테스트 추가**

`src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx` 끝에 다음 describe 추가 (기존 8개 테스트는 그대로 유지):

```typescript
describe("ListPattern 부수 UI (Epic 4 복원)", () => {
  const fixture = {
    rows: [
      { id: "r1", name: "Row 1", status: "urgent" as const, owner: "A" },
      { id: "r2", name: "Row 2", status: "active" as const, owner: "B" },
      { id: "r3", name: "Row 3", status: "active" as const, owner: "C" },
      { id: "r4", name: "Row 4", status: "approved" as const, owner: "D" },
    ],
  };

  it("초기 카운트 — 전체 rows 표시 (title · {N}건)", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    expect(screen.getByText(/서비스/)).toBeInTheDocument();
    expect(screen.getByText(/4건/)).toBeInTheDocument();
  });

  it("필터 5개 버튼 노출 (전체/긴급/활성/점검중/정상)", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "긴급" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "활성" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "점검중" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정상" })).toBeInTheDocument();
  });

  it("필터 클릭 — 해당 status rows만 표시 + 카운트 갱신", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "활성" }));
    expect(screen.getByText("Row 2")).toBeInTheDocument();
    expect(screen.getByText("Row 3")).toBeInTheDocument();
    expect(screen.queryByText("Row 1")).toBeNull();
    expect(screen.queryByText("Row 4")).toBeNull();
    expect(screen.getByText(/2건/)).toBeInTheDocument();
  });

  it("'전체' 클릭 시 모든 rows 복귀", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "긴급" }));
    expect(screen.getByText(/1건/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(screen.getByText(/4건/)).toBeInTheDocument();
  });

  it("Demo 안내문 노출", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    expect(screen.getByText(/Demo.*실제 데이터 미연결/)).toBeInTheDocument();
  });
});
```

(기존 import에 `fireEvent`가 빠져있으면 추가: `import { render, screen, fireEvent } from "@testing-library/react";`)

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx
```

Expected: 5 fail (기존 8 pass) — 필터/카운트/안내문 미존재.

- [ ] **Step 3: ListPattern.tsx 변경**

`src/app/dashboard/_components/patterns/ListPattern.tsx`를 다음으로 교체 (기존 STATUS_LABEL/STATUS_COLOR/InspectorPanel 통합 유지):

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
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
};

type Filter = ListRow["status"] | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "active", label: "활성" },
  { value: "review", label: "점검중" },
  { value: "approved", label: "정상" },
];

type Props = { title: string; data: { rows: ListRow[] } };

export function ListPattern({ title, data }: Props) {
  const [rows, setRows] = useState<ListRow[]>(data.rows);
  const [filter, setFilter] = useState<Filter>("all");
  const inspector = useInspectorState<ListRow>();

  const filteredRows =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <>
      <section className="p-7">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">
            {title} <span className="text-muted">·</span>{" "}
            <span className="text-vermilion">{filteredRows.length}건</span>
          </h2>
          <div role="tablist" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.value)}
                  className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
                    active
                      ? "font-bold text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {f.label}
                  {active && (
                    <span
                      aria-hidden
                      className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </header>

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
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    데이터 없음
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
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

        <p className="mt-3 text-xs text-muted">
          Demo · 실제 데이터 미연결
        </p>
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
                className="mt-2 cursor-pointer text-xs text-vermilion underline hover:text-vermilion-deep border-none bg-transparent p-0"
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

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx
```

Expected: 13 passed (기존 8 + 신규 5).

- [ ] **Step 5: 전체 vitest 회귀**

```bash
npm test
```

Expected: 모든 테스트 통과 (298 → 303).

- [ ] **Step 6: typecheck/lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors (pre-existing 2 warnings 무시).

- [ ] **Step 7: dev 서버 시각 확인**

dev 서버 살아있다면 http://localhost:3000 에서 `/dashboard/services` 진입:
- 헤딩 옆 카운트 "전체 서비스 · N건" 노출
- 필터 5개 버튼 가로 배치, "전체" 활성 vermilion underline
- "긴급" 클릭 → urgent 행만 표시 + 카운트 갱신
- footer "Demo · 실제 데이터 미연결" 노출
- 행 클릭 → Inspector 슬라이드인 회귀 X
- 편집 → 저장 → rows 갱신 + 필터 결과 자동 갱신

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx
git commit -m "feat: ListPattern 필터/카운트/안내문 복원 (Epic 4)"
```

- [ ] **Step 9: Push**

```bash
git push
```

---

## Self-Review

**1. Spec 커버리지**:

| Spec 섹션 | 구현 |
|---|---|
| 3.1 ListPattern 구조 (변경 후) | Step 3 |
| 3.2 FilterBar (인라인) + 5개 버튼 | Step 3 (FILTERS const) |
| 3.3 State (filter + filteredRows) | Step 3 |
| 3.4 카운트 (filteredRows.length) | Step 3 |
| 3.5 안내문 footer | Step 3 |
| 7. 단위 테스트 5개 | Step 1 |
| 9. DoD | Step 5-7 |

**누락 없음.**

**2. Placeholder scan**: 모든 step 코드/명령 명시. "TBD/추후" 없음.

**3. Type 일관성**:
- `Filter` 타입 = `ListRow["status"] | "all"` 일관
- FILTERS const = 5개 배열 (테스트 어설션과 정확 일치: 전체/긴급/활성/점검중/정상)
- 기존 export `ListRow` 그대로

**완료.**
