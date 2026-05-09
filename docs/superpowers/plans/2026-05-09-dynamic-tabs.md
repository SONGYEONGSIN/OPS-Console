# 동적 다중 탭 시스템 Implementation Plan (Epic 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** group children 메뉴 클릭 시 탭에 누적되는 동적 다중 탭 시스템 (localStorage 영속, × 닫기, section 직속 페이지는 미노출).

**Architecture:** OpenTabsProvider Context로 탭 상태 관리 + localStorage 영속 + useAutoAddTab 훅이 pathname 변화를 감지해 자동 push. PageTabs는 context의 tabs 배열 렌더 + × 닫기 버튼.

**Tech Stack:** React Context, Next.js useRouter/usePathname, localStorage, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-09-dynamic-tabs-design.md`

**HARD-GATE 등급:** 간략 설계 (6-8 파일)

---

## File Structure

### Create
- `src/app/dashboard/_components/page-header/open-tabs-context.tsx`
- `src/app/dashboard/_components/page-header/use-auto-add-tab.ts`
- `src/app/dashboard/_components/page-header/__tests__/open-tabs-context.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/use-auto-add-tab.test.tsx`

### Modify
- `src/app/dashboard/_data/sidebar-helpers.ts` — `findSidebarParentGroup` 추가
- `src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts` — 신규 helper 테스트
- `src/app/dashboard/_components/page-header/PageTabs.tsx` — context 사용으로 전체 교체
- `src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx` — Provider 래핑 + 새 어설션
- `src/app/dashboard/_components/DashboardShell.tsx` — OpenTabsProvider 마운트

---

## Task 1: findSidebarParentGroup helper

**Files:**
- Modify: `src/app/dashboard/_data/sidebar-helpers.ts`
- Modify: `src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts`

**Goal:** pathname의 부모 group label 반환. section 직속 또는 매칭 실패 시 null.

- [ ] **Step 1: 실패 테스트 추가**

`src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts` 끝에 추가:

```typescript
describe("findSidebarParentGroup", () => {
  it("group 안 item — group label 반환", () => {
    expect(findSidebarParentGroup("/dashboard/services")).toBe("서비스사이클");
    expect(findSidebarParentGroup("/dashboard/contacts")).toBe("고객 응대");
  });

  it("section 직속 item — null 반환", () => {
    expect(findSidebarParentGroup("/dashboard/alerts")).toBeNull();
    expect(findSidebarParentGroup("/dashboard/handover")).toBeNull();
  });

  it("매칭 안 되는 pathname — null", () => {
    expect(findSidebarParentGroup("/dashboard/zzz-nonexistent")).toBeNull();
  });
});
```

import에 `findSidebarParentGroup` 추가.

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts
```

Expected: FAIL — `findSidebarParentGroup is not a function`.

- [ ] **Step 3: 구현**

`src/app/dashboard/_data/sidebar-helpers.ts` 끝에 추가:

```typescript
/**
 * pathname의 부모 group label 반환 (group 안 item만).
 * section 직속 item이거나 매칭 실패 시 null.
 */
export function findSidebarParentGroup(pathname: string): string | null {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "group") {
        const hit = entry.items.some(
          (c) => c.slug && slugToHref(c.slug) === pathname,
        );
        if (hit) return entry.label;
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts
```

Expected: 모든 테스트 통과.

- [ ] **Step 5: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/_data/sidebar-helpers.ts src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts
git commit -m "feat: findSidebarParentGroup — group child의 부모 label 반환"
```

---

## Task 2: OpenTabsProvider Context

**Files:**
- Create: `src/app/dashboard/_components/page-header/open-tabs-context.tsx`
- Create: `src/app/dashboard/_components/page-header/__tests__/open-tabs-context.test.tsx`

**Goal:** 탭 상태 (tabs/add/close/isGroupChild) Context Provider + localStorage 영속.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_components/page-header/__tests__/open-tabs-context.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { OpenTabsProvider, useOpenTabs } from "../open-tabs-context";

const pushMock = vi.fn();
let mockPathname = "/dashboard/services";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarParentGroup: (pathname: string) =>
    pathname === "/dashboard/services" || pathname === "/dashboard/contracts"
      ? "서비스사이클"
      : null,
}));

beforeEach(() => {
  localStorage.clear();
  pushMock.mockReset();
  mockPathname = "/dashboard/services";
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OpenTabsProvider>{children}</OpenTabsProvider>
);

describe("OpenTabsProvider", () => {
  it("초기 tabs 빈 배열", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    expect(result.current.tabs).toEqual([]);
  });

  it("add — tabs 배열에 push, 중복 무시", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    expect(result.current.tabs).toHaveLength(1);
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    expect(result.current.tabs).toHaveLength(1);
  });

  it("close — 비활성 탭 제거, navigate 호출 X", () => {
    mockPathname = "/dashboard/services";
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => {
      result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" });
      result.current.add({ slug: "contracts", href: "/dashboard/contracts", label: "계약" });
    });
    act(() => result.current.close("contracts"));
    expect(result.current.tabs.map((t) => t.slug)).toEqual(["services"]);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("close — active 탭 닫으면 직전 탭으로 navigate", () => {
    mockPathname = "/dashboard/contracts";
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => {
      result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" });
      result.current.add({ slug: "contracts", href: "/dashboard/contracts", label: "계약" });
    });
    act(() => result.current.close("contracts"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/services");
  });

  it("close — 마지막 탭 닫으면 /dashboard 로 navigate", () => {
    mockPathname = "/dashboard/services";
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    act(() => result.current.close("services"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });

  it("localStorage — add 시 동기화", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    act(() => result.current.add({ slug: "services", href: "/dashboard/services", label: "전체 서비스" }));
    expect(JSON.parse(localStorage.getItem("folio.openTabs") ?? "[]")).toEqual([
      { slug: "services", href: "/dashboard/services", label: "전체 서비스" },
    ]);
  });

  it("localStorage — 초기화 시 복원", () => {
    localStorage.setItem(
      "folio.openTabs",
      JSON.stringify([{ slug: "services", href: "/dashboard/services", label: "전체 서비스" }]),
    );
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    expect(result.current.tabs).toHaveLength(1);
  });

  it("isGroupChild — group child true, section item false", () => {
    const { result } = renderHook(() => useOpenTabs(), { wrapper });
    expect(result.current.isGroupChild("/dashboard/services")).toBe(true);
    expect(result.current.isGroupChild("/dashboard/alerts")).toBe(false);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/open-tabs-context.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/page-header/open-tabs-context.tsx`:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { findSidebarParentGroup } from "../../_data/sidebar-helpers";

const STORAGE_KEY = "folio.openTabs";

export type OpenTab = {
  slug: string;
  href: string;
  label: string;
};

export type OpenTabsState = {
  tabs: OpenTab[];
  add: (tab: OpenTab) => void;
  close: (slug: string) => void;
  isGroupChild: (pathname: string) => boolean;
};

const Ctx = createContext<OpenTabsState | null>(null);

function loadInitial(): OpenTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OpenTab[]) : [];
  } catch {
    return [];
  }
}

export function OpenTabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<OpenTab[]>(loadInitial);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  const add = useCallback((tab: OpenTab) => {
    setTabs((prev) => {
      if (prev.some((t) => t.slug === tab.slug)) return prev;
      return [...prev, tab];
    });
  }, []);

  const close = useCallback(
    (slug: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.slug === slug);
        if (idx < 0) return prev;
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];

        const closingActive = `/dashboard/${slug}` === pathname;
        if (closingActive) {
          const target = next[idx - 1] ?? next[idx] ?? null;
          router.push(target?.href ?? "/dashboard");
        }
        return next;
      });
    },
    [pathname, router],
  );

  const isGroupChild = useCallback(
    (path: string): boolean => findSidebarParentGroup(path) !== null,
    [],
  );

  return (
    <Ctx.Provider value={{ tabs, add, close, isGroupChild }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOpenTabs(): OpenTabsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOpenTabs must be inside OpenTabsProvider");
  return v;
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/open-tabs-context.test.tsx
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/open-tabs-context.tsx src/app/dashboard/_components/page-header/__tests__/open-tabs-context.test.tsx
git commit -m "feat: OpenTabsProvider — 탭 상태 Context + localStorage 영속"
```

---

## Task 3: useAutoAddTab 훅

**Files:**
- Create: `src/app/dashboard/_components/page-header/use-auto-add-tab.ts`
- Create: `src/app/dashboard/_components/page-header/__tests__/use-auto-add-tab.test.tsx`

**Goal:** pathname 변경 감지 → group child면 자동 add.

- [ ] **Step 1: 실패 테스트**

`src/app/dashboard/_components/page-header/__tests__/use-auto-add-tab.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { OpenTabsProvider, useOpenTabs } from "../open-tabs-context";
import { useAutoAddTab } from "../use-auto-add-tab";

let mockPathname = "/dashboard/services";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
}));

vi.mock("../../../_data", () => ({
  findSidebarMeta: (slug: string) => {
    if (slug === "services") return { label: "전체 서비스", pattern: "list" };
    if (slug === "contracts") return { label: "계약", pattern: "list" };
    if (slug === "alerts") return { label: "새 알림", pattern: "dash" };
    return null;
  },
}));

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarParentGroup: (pathname: string) =>
    pathname === "/dashboard/services" || pathname === "/dashboard/contracts"
      ? "서비스사이클"
      : null,
}));

beforeEach(() => {
  localStorage.clear();
  mockPathname = "/dashboard/services";
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <OpenTabsProvider>{children}</OpenTabsProvider>
);

describe("useAutoAddTab", () => {
  it("group child pathname — 탭 자동 push", () => {
    mockPathname = "/dashboard/services";
    const { result } = renderHook(
      () => {
        useAutoAddTab();
        return useOpenTabs();
      },
      { wrapper: Wrapper },
    );
    expect(result.current.tabs.map((t) => t.slug)).toEqual(["services"]);
  });

  it("section 직속 pathname — push 안 함", () => {
    mockPathname = "/dashboard/alerts";
    const { result } = renderHook(
      () => {
        useAutoAddTab();
        return useOpenTabs();
      },
      { wrapper: Wrapper },
    );
    expect(result.current.tabs).toEqual([]);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/use-auto-add-tab.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/page-header/use-auto-add-tab.ts`:

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { useOpenTabs } from "./open-tabs-context";

/**
 * 현재 pathname이 group child면 탭에 자동 push.
 */
export function useAutoAddTab() {
  const pathname = usePathname();
  const { add, isGroupChild } = useOpenTabs();

  useEffect(() => {
    if (!isGroupChild(pathname)) return;
    const slug = pathname.replace("/dashboard/", "");
    const meta = findSidebarMeta(slug);
    if (!meta) return;
    add({ slug, href: pathname, label: meta.label });
  }, [pathname, add, isGroupChild]);
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/use-auto-add-tab.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/use-auto-add-tab.ts src/app/dashboard/_components/page-header/__tests__/use-auto-add-tab.test.tsx
git commit -m "feat: useAutoAddTab — pathname 변경 시 group child 자동 push"
```

---

## Task 4: PageTabs context 기반으로 교체

**Files:**
- Modify: `src/app/dashboard/_components/page-header/PageTabs.tsx`
- Modify: `src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx`

**Goal:** PageTabs를 context의 tabs 사용으로 변경 + × 닫기 버튼 인터랙션.

- [ ] **Step 1: 기존 PageTabs 테스트 갱신**

`src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx` 전체 교체:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenTabsProvider } from "../open-tabs-context";
import { PageTabs } from "../PageTabs";

const pushMock = vi.fn();
let mockPathname = "/dashboard/services";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

vi.mock("../../../_data", () => ({
  findSidebarMeta: (slug: string) => {
    if (slug === "services") return { label: "전체 서비스", pattern: "list" };
    if (slug === "contracts") return { label: "계약", pattern: "list" };
    return null;
  },
}));

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarParentGroup: (pathname: string) =>
    pathname === "/dashboard/services" || pathname === "/dashboard/contracts"
      ? "서비스사이클"
      : null,
}));

beforeEach(() => {
  localStorage.clear();
  pushMock.mockReset();
  mockPathname = "/dashboard/services";
});

const renderWithProvider = (pathname: string) =>
  render(
    <OpenTabsProvider>
      <PageTabs pathname={pathname} />
    </OpenTabsProvider>,
  );

describe("PageTabs (Epic 6)", () => {
  it("group child + tabs 있음 — 탭 렌더 (active aria-selected=true)", () => {
    mockPathname = "/dashboard/services";
    localStorage.setItem(
      "folio.openTabs",
      JSON.stringify([
        { slug: "services", href: "/dashboard/services", label: "전체 서비스" },
        { slug: "contracts", href: "/dashboard/contracts", label: "계약" },
      ]),
    );
    renderWithProvider("/dashboard/services");
    expect(screen.getByRole("tab", { name: "전체 서비스" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "계약" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("section 직속 페이지 — null 반환 (탭 영역 미노출)", () => {
    mockPathname = "/dashboard/alerts";
    const { container } = renderWithProvider("/dashboard/alerts");
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it("× 클릭 — 탭 닫기 (close 호출)", () => {
    mockPathname = "/dashboard/services";
    localStorage.setItem(
      "folio.openTabs",
      JSON.stringify([
        { slug: "services", href: "/dashboard/services", label: "전체 서비스" },
        { slug: "contracts", href: "/dashboard/contracts", label: "계약" },
      ]),
    );
    renderWithProvider("/dashboard/services");
    fireEvent.click(screen.getByRole("button", { name: "계약 닫기" }));
    // 계약 탭 사라짐
    expect(screen.queryByRole("tab", { name: "계약" })).toBeNull();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx
```

Expected: FAIL — 기존 PageTabs가 context 사용 안 함.

- [ ] **Step 3: PageTabs.tsx 전체 교체**

`src/app/dashboard/_components/page-header/PageTabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useOpenTabs } from "./open-tabs-context";
import { useAutoAddTab } from "./use-auto-add-tab";

export function PageTabs({ pathname }: { pathname: string }) {
  useAutoAddTab();
  const { tabs, close, isGroupChild } = useOpenTabs();

  if (!isGroupChild(pathname)) return null;
  if (tabs.length === 0) return null;

  return (
    <nav
      role="tablist"
      aria-label="열린 메뉴"
      className="flex items-center overflow-x-auto"
    >
      {tabs.map((tab) => {
        const active = tab.href === pathname;
        return (
          <div
            key={tab.slug}
            className={`relative flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
              active
                ? "border-t-2 border-vermilion bg-cream font-bold text-ink"
                : "border-t-2 border-transparent text-muted hover:text-ink"
            }`}
          >
            <Link
              href={tab.href}
              role="tab"
              aria-selected={active}
              className="block"
            >
              {tab.label}
            </Link>
            <button
              type="button"
              aria-label={`${tab.label} 닫기`}
              onClick={(e) => {
                e.preventDefault();
                close(tab.slug);
              }}
              className="cursor-pointer border-none bg-transparent text-xs text-faint hover:text-vermilion"
            >
              ×
            </button>
          </div>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/PageTabs.tsx src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx
git commit -m "feat: PageTabs context 기반 동적 탭 + × 닫기 버튼"
```

---

## Task 5: DashboardShell에 OpenTabsProvider 마운트

**Files:**
- Modify: `src/app/dashboard/_components/DashboardShell.tsx`

**Goal:** PageTabs가 context를 찾을 수 있도록 Provider를 shell에 마운트.

- [ ] **Step 1: DashboardShell.tsx 수정**

import 추가:
```tsx
import { OpenTabsProvider } from "./page-header/open-tabs-context";
```

Wrap return JSX:
```tsx
return (
  <OpenTabsProvider>
    <div className="dashboard-shell ...">
      {/* 기존 그리드 그대로 */}
    </div>
  </OpenTabsProvider>
);
```

(기존 outermost `<div>` 위에 OpenTabsProvider 한 줄 추가.)

- [ ] **Step 2: 전체 vitest 회귀**

```bash
npm test
```

Expected: 모든 테스트 통과.

- [ ] **Step 3: typecheck/lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: dev 서버 시각 확인 (선택)**

dev 서버 살아있다면:
- `/dashboard/services` 진입 → 탭 1개 (`전체 서비스`, active)
- 사이드바 `계약` 클릭 → 탭 2개 (`전체 서비스`, `계약` active)
- 새로고침 → 탭 2개 유지
- `전체 서비스` 탭 클릭 → URL 변경 + active 이동
- × 클릭 → 탭 닫기
- `/dashboard/alerts` (section 직속) → 탭 영역 미노출

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/DashboardShell.tsx
git commit -m "feat: DashboardShell에 OpenTabsProvider 마운트"
```

- [ ] **Step 6: Push**

```bash
git push
```

---

## Self-Review

**1. Spec 커버리지**:

| Spec 섹션 | 구현 task |
|---|---|
| 3.1 데이터 구조 (OpenTab, OpenTabsState) | T2 |
| 3.2 OpenTabsProvider | T2 |
| 3.3 useAutoAddTab | T3 |
| 3.4 findSidebarParentGroup | T1 |
| 3.5 PageTabs 변경 | T4 |
| 3.6 DashboardShell 변경 | T5 |
| 4. 데이터 흐름 | T2-T5 |
| 5. 에러 처리 | T2 (try/catch loadInitial), T2 (close idx<0) |
| 6.1 단위 테스트 | T1-T4 |
| 7. 영향 파일 | 모든 task |
| 9. DoD | T5 |

**누락 없음.**

**2. Placeholder scan**: 모든 step 코드/명령 명시. "TBD/적절히/추후" 없음.

**3. Type 일관성**:
- `OpenTab` (T2) → useAutoAddTab (T3), PageTabs (T4) 동일 import
- `OpenTabsState` (T2) — useOpenTabs 반환 타입
- `findSidebarParentGroup` (T1) → open-tabs-context (T2) 동일 시그니처
- `add(tab: OpenTab)` / `close(slug: string)` / `isGroupChild(pathname: string)` 일관

**완료.**
