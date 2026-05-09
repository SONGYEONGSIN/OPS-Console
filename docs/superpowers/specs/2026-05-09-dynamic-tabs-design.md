# Design — 동적 다중 탭 시스템 (Epic 6)

- **Date**: 2026-05-09
- **Owner**: 송영석
- **Topic**: PageTabs를 group children 자동 derive → 사용자 클릭 누적 다중 탭으로 변경
- **Source**: 사용자 직접 피드백 (mockup folio-dashboard.html 다중 탭 패턴)
- **Status**: Awaiting user review
- **Predecessor**: Epic 2 PageHeader Pattern (PageTabs는 group children 자동 노출이었음)

## 1. Goal

mockup의 다중 탭 패턴 — 사용자가 group children 메뉴를 클릭할 때마다 탭에 push되어 누적, × 클릭으로 닫기, 새로고침 후에도 보존되는 동적 탭 시스템. 브라우저 탭 같은 UX. 기존 자동 형제 derive 패턴 폐기.

## 2. Out of Scope

- 탭 드래그 재정렬 — 추후 (push 순서 고정)
- + 버튼 (메뉴 picker) — 사용자 결정으로 미노출
- 탭 최대 개수 제한 — 무제한 + 가로 스크롤
- section 직속 페이지 (개요/관리 etc) 탭 — 미노출 (이전 결정 유지)
- URL params로 탭 영속화 — localStorage 채택
- 다른 브라우저 탭/창 간 동기화 — 별도

## 3. Architecture

### 3.1 데이터 구조

```typescript
type OpenTab = {
  slug: string;     // dashboard slug ("services", "contracts", ...)
  href: string;     // "/dashboard/{slug}"
  label: string;    // sidebar label ("전체 서비스")
};

type OpenTabsState = {
  tabs: OpenTab[];
  add: (tab: OpenTab) => void;
  close: (slug: string) => void;
  isGroupChild: (pathname: string) => boolean;  // 탭 영역 노출 여부
};
```

localStorage 키: `folio.openTabs` (배열로 직렬화).

### 3.2 OpenTabsProvider (신규)

`src/app/dashboard/_components/page-header/open-tabs-context.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { findSidebarParentGroup } from "../../_data/sidebar-helpers";

const STORAGE_KEY = "folio.openTabs";

const Ctx = createContext<OpenTabsState | null>(null);

export function OpenTabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<OpenTab[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const router = useRouter();
  const pathname = usePathname();

  // localStorage 동기화
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  const add = useCallback((tab: OpenTab) => {
    setTabs((prev) => {
      if (prev.some((t) => t.slug === tab.slug)) return prev;  // 중복 방지
      return [...prev, tab];
    });
  }, []);

  const close = useCallback(
    (slug: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.slug === slug);
        if (idx < 0) return prev;
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];

        // 활성 탭을 닫으면 직전 탭(또는 다음 탭, 또는 dashboard)으로
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

  const isGroupChild = useCallback((path: string): boolean => {
    return findSidebarParentGroup(path) !== null;
  }, []);

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

### 3.3 자동 push 훅 (useAutoAddTab)

```tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import { findSidebarParentGroup } from "../../_data/sidebar-helpers";
import { useOpenTabs } from "./open-tabs-context";

/**
 * 현재 pathname이 group child면 탭에 자동 push.
 * PageTabs 컴포넌트 또는 별도 wrapper에서 호출.
 */
export function useAutoAddTab() {
  const pathname = usePathname();
  const { add, isGroupChild } = useOpenTabs();

  useEffect(() => {
    if (!isGroupChild(pathname)) return;
    const slug = pathname.replace("/dashboard/", "");
    const sidebarMeta = findSidebarMeta(slug);
    if (!sidebarMeta) return;
    const group = findSidebarParentGroup(pathname);
    if (!group) return;
    add({ slug, href: pathname, label: sidebarMeta.label });
  }, [pathname, add, isGroupChild]);
}
```

### 3.4 sidebar-helpers — findSidebarParentGroup (신규)

`sidebar-helpers.ts`에 추가:

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

### 3.5 PageTabs 변경

`PageTabs.tsx` 전체 교체:

```tsx
"use client";

import Link from "next/link";
import { useOpenTabs } from "./open-tabs-context";
import { useAutoAddTab } from "./use-auto-add-tab";

export function PageTabs({ pathname }: { pathname: string }) {
  useAutoAddTab();
  const { tabs, close, isGroupChild } = useOpenTabs();

  // section 직속 페이지(group child 아님)는 탭 영역 미노출
  if (!isGroupChild(pathname)) return null;
  if (tabs.length === 0) return null;

  return (
    <nav role="tablist" aria-label="열린 메뉴" className="flex items-center overflow-x-auto">
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

### 3.6 DashboardShell 변경

```tsx
import { OpenTabsProvider } from "./page-header/open-tabs-context";

// ... 기존 ...
return (
  <OpenTabsProvider>
    <div className="dashboard-shell ...">
      {/* 기존 그리드 */}
    </div>
  </OpenTabsProvider>
);
```

## 4. 데이터 흐름

```
사용자 sidebar 클릭 → /dashboard/services 진입
        │
        ▼
PageTabs render
        │
        ├── useAutoAddTab → group child? 예 → tabs.push({slug, href, label})
        │       └── localStorage 동기화
        │
        └── tabs[] 렌더 (× 닫기 button 포함)
                │
                ▼
사용자 × 클릭 → close(slug)
        ├── tabs.splice
        └── active 탭이면 router.push(직전 탭 || /dashboard)
```

## 5. 에러 처리

- localStorage 파싱 실패 → 빈 배열로 fallback (try/catch)
- localStorage 없음 (SSR) → 빈 배열
- group child 아닌 페이지 → useAutoAddTab은 push 안 함, PageTabs는 null 반환
- close하는 slug 없음 → no-op
- 마지막 탭 닫기 → router.push("/dashboard")

## 6. 테스트 전략 (TDD)

### 단위 (vitest)
1. `findSidebarParentGroup` — group child slug → group label, section item → null
2. `OpenTabsProvider`:
   - 초기 tabs 빈 배열
   - localStorage에서 복원
   - add 시 push, 중복 무시
   - close 시 splice + active면 router.push
   - localStorage 동기화
3. `useAutoAddTab` — pathname 변경 시 group child면 push
4. `PageTabs` 통합:
   - group child 페이지 + tabs 있음 → 렌더
   - section 직속 → null
   - 탭 클릭 → href navigate
   - × 클릭 → close 호출

### e2e (playwright)
- `/dashboard/services` 진입 → 탭 1개
- 사이드바에서 `계약` 클릭 → 탭 2개 (계약 active)
- `전체 서비스` 탭 클릭 → 페이지 이동, 활성 변경
- × 클릭 → 탭 닫기 + 직전 탭 active

## 7. 영향 파일 (예상 6-8개)

### 신규
- `src/app/dashboard/_components/page-header/open-tabs-context.tsx`
- `src/app/dashboard/_components/page-header/use-auto-add-tab.ts`
- 위 둘 단위 테스트

### 변경
- `src/app/dashboard/_components/page-header/PageTabs.tsx` — context 사용으로 전체 교체
- `src/app/dashboard/_components/DashboardShell.tsx` — OpenTabsProvider 마운트
- `src/app/dashboard/_data/sidebar-helpers.ts` — `findSidebarParentGroup` 추가
- `src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts` — 신규 helper 테스트
- `src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx` — context provider 래핑 + tabs 어설션
- `e2e/dashboard.spec.ts` — 다중 탭 e2e

### 폐기 (선택)
- `findSidebarSiblings` — 더 이상 사용 안 됨. 단계적 제거 가능.

**HARD-GATE 등급**: 간략 설계 (6-8 파일).

## 8. 리스크

- **localStorage 무한 누적**: 사용자가 47 메뉴 모두 클릭하면 47 탭. UI overflow 가로 스크롤로 처리. 후속 epic에서 LRU 또는 최대 개수 제한 필요할 수 있음.
- **SSR/CSR 동기화**: localStorage는 client only. 초기 SSR render는 빈 tabs로 시작 → CSR mount 후 hydrate. flicker 가능. `useEffect`로 hydration 후 set.
- **Provider 위치**: DashboardShell이 client 컴포넌트라 Provider 마운트 OK. Server children도 통과 (Provider는 wrapper).
- **기존 `findSidebarSiblings` 미사용**: dead code. 정리는 후속 PR로.
- **탭 닫을 때 router.push와 setState 충돌**: useEffect로 분리 또는 setState 콜백에서 호출. 위 구현은 `close` 함수 안에서 직접 호출 — pathname 변경 후 useAutoAddTab이 또 push할 수도 있어 무한 루프 위험. 중복 방지 (slug 동일 시 push 무시)로 차단 + 직전 탭이 이미 tabs에 있으니 OK.

## 9. 검증 (DoD)

1. `npm run lint` 0 errors
2. `npx tsc --noEmit` 0 errors
3. `npm test` — 신규 단위 테스트 + 회귀 통과
4. `npm run e2e` — 다중 탭 e2e 통과
5. dev 서버:
   - `/dashboard/services` 진입 → 탭 1개 (`전체 서비스`, active)
   - 사이드바 `계약` 클릭 → 탭 2개 (`전체 서비스`, `계약`, 계약 active)
   - 새로고침 → 탭 2개 유지
   - `전체 서비스` 탭 클릭 → URL 변경 + active 이동
   - active 탭 × → 직전 탭 active
   - 마지막 탭 × → `/dashboard` 인덱스 이동, 탭 0개
   - `/dashboard/alerts` (section 직속) → 탭 영역 미노출
6. design-audit hook 0 위반
