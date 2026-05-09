# Page Header Pattern Implementation Plan (Epic 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dashboard/[slug]/*` 47 메뉴 페이지에 통합 PageHeader (Breadcrumb + Tabs + Meta + Headline + Description) 적용.

**Architecture:** sidebar-helpers가 `findSidebarBreadcrumb` / `findSidebarSiblings`를 제공해 Breadcrumb·Tabs를 자동 derive. PageMeta·PageHeadline은 page.tsx에서 props로 명시. 47 slug 메타는 `page-meta-config.ts`에서 일괄 관리하고 미정의 slug는 sidebar label로 자동 fallback.

**Tech Stack:** Next.js App Router server components, Tailwind v4, vitest + @testing-library/react, playwright.

**Spec:** `docs/superpowers/specs/2026-05-08-page-header-pattern-design.md`

**HARD-GATE 등급:** 간략 설계 (8-12 파일)

---

## File Structure

### Create
- `src/app/dashboard/_data/sidebar-helpers.ts` — breadcrumb/siblings derive
- `src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts`
- `src/app/dashboard/_data/page-meta-config.ts` — 47 slug 메타/헤드라인/description
- `src/app/dashboard/_components/page-header/PageHeader.tsx`
- `src/app/dashboard/_components/page-header/Breadcrumb.tsx`
- `src/app/dashboard/_components/page-header/PageTabs.tsx`
- `src/app/dashboard/_components/page-header/PageMeta.tsx`
- `src/app/dashboard/_components/page-header/PageHeadline.tsx`
- `src/app/dashboard/_components/page-header/__tests__/Breadcrumb.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/PageMeta.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/PageHeadline.test.tsx`

### Modify
- `src/app/dashboard/[slug]/page.tsx` — PageHeader 호출 추가
- `e2e/dashboard.spec.ts` — sample 라우트 PageHeader 어설션

---

## Task 1: sidebar-helpers (Breadcrumb + Siblings)

**Files:**
- Create: `src/app/dashboard/_data/sidebar-helpers.ts`
- Create: `src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts`

**Goal:** pathname → breadcrumb 경로 + 같은 그룹 형제 메뉴 derive 함수.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  findSidebarBreadcrumb,
  findSidebarSiblings,
} from "../sidebar-helpers";

describe("findSidebarBreadcrumb", () => {
  it("그룹 안 메뉴 — section + group + item 3단", () => {
    const crumbs = findSidebarBreadcrumb("/dashboard/services");
    expect(crumbs).toHaveLength(3);
    expect(crumbs[0].label).toBe("서비스 그룹");
    expect(crumbs[1].label).toBe("서비스사이클");
    expect(crumbs[2].label).toBe("전체 서비스");
  });

  it("section 직속 item — section + item 2단", () => {
    const crumbs = findSidebarBreadcrumb("/dashboard/alerts");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].label).toBe("개요");
    expect(crumbs[1].label).toBe("새 알림");
  });

  it("매칭 안 되는 pathname — 빈 배열", () => {
    expect(findSidebarBreadcrumb("/dashboard/zzz-nonexistent")).toEqual([]);
  });
});

describe("findSidebarSiblings", () => {
  it("그룹 안 메뉴 — 같은 그룹의 형제들 반환", () => {
    const sibs = findSidebarSiblings("/dashboard/services");
    expect(sibs.map((s) => s.label)).toEqual([
      "전체 서비스",
      "계약",
      "개발 · 테스트",
      "배포 · 운영",
      "서비스 마감",
      "전형료 정산",
      "계산서 발행",
      "미수 채권",
    ]);
  });

  it("section 직속 item — 같은 section의 형제들 반환", () => {
    const sibs = findSidebarSiblings("/dashboard/alerts");
    const labels = sibs.map((s) => s.label);
    expect(labels).toContain("새 알림");
    expect(labels).toContain("오늘 할 일");
    expect(labels).toContain("전체 일정");
  });

  it("매칭 안 되는 pathname — 빈 배열", () => {
    expect(findSidebarSiblings("/dashboard/zzz-nonexistent")).toEqual([]);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts
```

Expected: FAIL — Cannot find module './sidebar-helpers'.

- [ ] **Step 3: 구현**

`src/app/dashboard/_data/sidebar-helpers.ts`:

```typescript
import { sidebarSections, type SbItem } from "../_data";

export type BreadcrumbCrumb = { label: string };

type SiblingItem = SbItem & { href: string };

function slugToHref(slug: string): string {
  return `/dashboard/${slug}`;
}

/**
 * pathname에 매칭되는 메뉴까지의 경로(section → group? → item)를 root → leaf 순으로.
 * 매칭 실패 시 빈 배열.
 */
export function findSidebarBreadcrumb(pathname: string): BreadcrumbCrumb[] {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug && slugToHref(entry.slug) === pathname) {
        return [{ label: section.title }, { label: entry.label }];
      }
      if (entry.kind === "group") {
        for (const child of entry.items) {
          if (child.slug && slugToHref(child.slug) === pathname) {
            return [
              { label: section.title },
              { label: entry.label },
              { label: child.label },
            ];
          }
        }
      }
    }
  }
  return [];
}

/**
 * pathname의 부모 컨테이너(group 또는 section)의 형제 메뉴들 (slug 있는 항목만, current 포함).
 * 매칭 실패 시 빈 배열.
 */
export function findSidebarSiblings(pathname: string): SiblingItem[] {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug && slugToHref(entry.slug) === pathname) {
        return section.entries
          .filter((e): e is Extract<typeof e, { kind: "item" }> => e.kind === "item")
          .filter((e) => e.slug)
          .map((e) => ({ ...e, href: slugToHref(e.slug!) }));
      }
      if (entry.kind === "group") {
        const hit = entry.items.some(
          (c) => c.slug && slugToHref(c.slug) === pathname,
        );
        if (hit) {
          return entry.items
            .filter((c) => c.slug)
            .map((c) => ({ ...c, href: slugToHref(c.slug!) }));
        }
      }
    }
  }
  return [];
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_data/sidebar-helpers.ts src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts
git commit -m "feat: sidebar-helpers — findSidebarBreadcrumb + findSidebarSiblings"
```

---

## Task 2: PageMeta

**Files:**
- Create: `src/app/dashboard/_components/page-header/PageMeta.tsx`
- Create: `src/app/dashboard/_components/page-header/__tests__/PageMeta.test.tsx`

**Goal:** 메타 항목 list 렌더 — 옵션 accent tone (vermilion) + dot separator.

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageMeta } from "../PageMeta";

describe("PageMeta", () => {
  it("items 배열을 dot separator로 렌더", () => {
    render(
      <PageMeta
        items={[
          { label: "근무 II", tone: "accent" },
          { label: "2026-04-24" },
          { label: "서비스", value: "12개" },
        ]}
      />
    );
    expect(screen.getByText("근무 II")).toBeInTheDocument();
    expect(screen.getByText("2026-04-24")).toBeInTheDocument();
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText(/12개/)).toBeInTheDocument();
  });

  it("빈 items — 아무것도 렌더 안 함", () => {
    const { container } = render(<PageMeta items={[]} />);
    expect(container.querySelectorAll("span").length).toBe(0);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageMeta.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/page-header/PageMeta.tsx`:

```tsx
export type MetaItem = {
  label: string;
  value?: string;
  tone?: "default" | "accent";
};

export function PageMeta({ items }: { items: MetaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {item.tone === "accent" ? (
            <strong className="text-vermilion">{item.label}</strong>
          ) : item.value !== undefined ? (
            <span>
              <strong className="text-ink">{item.label}</strong> {item.value}
            </span>
          ) : (
            <span>{item.label}</span>
          )}
          {i < items.length - 1 && (
            <span aria-hidden className="text-line-soft">·</span>
          )}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageMeta.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/PageMeta.tsx src/app/dashboard/_components/page-header/__tests__/PageMeta.test.tsx
git commit -m "feat: PageMeta — items list + accent tone + dot separator"
```

---

## Task 3: PageHeadline

**Files:**
- Create: `src/app/dashboard/_components/page-header/PageHeadline.tsx`
- Create: `src/app/dashboard/_components/page-header/__tests__/PageHeadline.test.tsx`

**Goal:** 큰 헤드라인 (accent + vermilion `—` + title) + description.

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeadline } from "../PageHeadline";

describe("PageHeadline", () => {
  it("accent + title + dash + description 모두 렌더", () => {
    render(
      <PageHeadline
        accent="실시간"
        title="서비스 운영"
        description="현재 운영 중인 서비스 목록입니다."
      />
    );
    expect(screen.getByText("실시간")).toBeInTheDocument();
    expect(screen.getByText("서비스 운영")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("현재 운영 중인 서비스 목록입니다.")).toBeInTheDocument();
  });

  it("accent 없으면 title만 렌더 (대시 X)", () => {
    render(<PageHeadline title="자료 보관" />);
    expect(screen.getByText("자료 보관")).toBeInTheDocument();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("description 없으면 p 태그 미렌더", () => {
    const { container } = render(<PageHeadline title="자료 보관" />);
    expect(container.querySelector("p")).toBeNull();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageHeadline.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/page-header/PageHeadline.tsx`:

```tsx
type Props = {
  title: string;
  accent?: string;
  description?: string;
};

export function PageHeadline({ title, accent, description }: Props) {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold leading-tight text-ink lg:text-[40px]">
        {accent && (
          <>
            <span>{accent}</span>
            <span aria-hidden className="mx-3 text-vermilion">—</span>
          </>
        )}
        <span>{title}</span>
      </h1>
      {description && (
        <p className="max-w-[720px] text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageHeadline.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/PageHeadline.tsx src/app/dashboard/_components/page-header/__tests__/PageHeadline.test.tsx
git commit -m "feat: PageHeadline — accent + vermilion dash + title + description"
```

---

## Task 4: Breadcrumb

**Files:**
- Create: `src/app/dashboard/_components/page-header/Breadcrumb.tsx`
- Create: `src/app/dashboard/_components/page-header/__tests__/Breadcrumb.test.tsx`

**Goal:** breadcrumb crumbs 렌더, 마지막 항목 굵게 + slash separator.

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "../Breadcrumb";

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarBreadcrumb: () => [
    { label: "개요" },
    { label: "서비스 그룹" },
    { label: "전체 서비스" },
  ],
}));

describe("Breadcrumb", () => {
  it("crumbs 3개 + slash separator 2개 렌더", () => {
    render(<Breadcrumb pathname="/dashboard/services" />);
    expect(screen.getByText("개요")).toBeInTheDocument();
    expect(screen.getByText("서비스 그룹")).toBeInTheDocument();
    expect(screen.getByText("전체 서비스")).toBeInTheDocument();
    expect(screen.getAllByText("/")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/Breadcrumb.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/page-header/Breadcrumb.tsx`:

```tsx
import { findSidebarBreadcrumb } from "../../_data/sidebar-helpers";

export function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = findSidebarBreadcrumb(pathname);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="경로" className="flex items-center gap-2 text-xs text-muted">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""}>
            {crumb.label}
          </span>
          {i < crumbs.length - 1 && (
            <span aria-hidden className="text-line-soft">/</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/Breadcrumb.test.tsx
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/Breadcrumb.tsx src/app/dashboard/_components/page-header/__tests__/Breadcrumb.test.tsx
git commit -m "feat: Breadcrumb — sidebar 트리에서 자동 derive + slash separator"
```

---

## Task 5: PageTabs

**Files:**
- Create: `src/app/dashboard/_components/page-header/PageTabs.tsx`
- Create: `src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx`

**Goal:** 같은 그룹 형제 메뉴를 탭으로, 활성 탭은 vermilion underline.

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTabs } from "../PageTabs";

vi.mock("../../../_data/sidebar-helpers", () => ({
  findSidebarSiblings: (pathname: string) => {
    if (pathname === "/dashboard/services") {
      return [
        { ico: "·", label: "전체 서비스", slug: "services", href: "/dashboard/services" },
        { ico: "·", label: "계약", slug: "contracts", href: "/dashboard/contracts" },
      ];
    }
    if (pathname === "/dashboard/alone") {
      return [
        { ico: "·", label: "외톨이", slug: "alone", href: "/dashboard/alone" },
      ];
    }
    return [];
  },
}));

describe("PageTabs", () => {
  it("형제 2개 이상 — 모두 탭으로 렌더, 활성 탭은 aria-selected=true", () => {
    render(<PageTabs pathname="/dashboard/services" />);
    const activeTab = screen.getByRole("tab", { name: "전체 서비스" });
    const inactiveTab = screen.getByRole("tab", { name: "계약" });
    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(inactiveTab).toHaveAttribute("aria-selected", "false");
  });

  it("형제 1개 이하 — null 반환 (탭 미노출)", () => {
    const { container } = render(<PageTabs pathname="/dashboard/alone" />);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/page-header/PageTabs.tsx`:

```tsx
import Link from "next/link";
import { findSidebarSiblings } from "../../_data/sidebar-helpers";

export function PageTabs({ pathname }: { pathname: string }) {
  const siblings = findSidebarSiblings(pathname);
  if (siblings.length <= 1) return null;

  return (
    <nav role="tablist" aria-label="형제 메뉴" className="flex items-center gap-1">
      {siblings.map((item) => {
        const active = item.href === pathname;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={`relative px-3 py-1.5 text-sm transition-colors ${
              active ? "font-bold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
            {active && (
              <span
                aria-hidden
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
              />
            )}
          </Link>
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

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/page-header/PageTabs.tsx src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx
git commit -m "feat: PageTabs — 형제 메뉴 자동 탭 + 활성 vermilion underline"
```

---

## Task 6: PageHeader (통합 컨테이너)

**Files:**
- Create: `src/app/dashboard/_components/page-header/PageHeader.tsx`

**Goal:** 5개 자식(Breadcrumb + PageTabs + PageMeta + PageHeadline)을 조립. 단순 wrapper, 단위 테스트는 자식 단위 테스트로 충분 (TDD 예외).

- [ ] **Step 1: 구현**

`src/app/dashboard/_components/page-header/PageHeader.tsx`:

```tsx
import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";
import { PageMeta, type MetaItem } from "./PageMeta";
import { PageHeadline } from "./PageHeadline";

type Props = {
  pathname: string;
  meta?: MetaItem[];
  headline: { title: string; accent?: string };
  description?: string;
};

export function PageHeader({ pathname, meta = [], headline, description }: Props) {
  return (
    <header className="border-b border-line-soft px-7 py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <Breadcrumb pathname={pathname} />
        <PageTabs pathname={pathname} />
      </div>
      <PageMeta items={meta} />
      <PageHeadline {...headline} description={description} />
    </header>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_components/page-header/PageHeader.tsx
git commit -m "feat: PageHeader — Breadcrumb+Tabs+Meta+Headline 통합 컨테이너"
```

---

## Task 7: page-meta-config + dashboard/[slug] 적용

**Files:**
- Create: `src/app/dashboard/_data/page-meta-config.ts`
- Modify: `src/app/dashboard/[slug]/page.tsx`

**Goal:** 47 slug별 헤드라인/메타/설명 정의. 미정의 slug는 sidebar label fallback. dashboard/[slug]/page.tsx에서 PageHeader 호출 추가.

- [ ] **Step 1: page-meta-config.ts 생성**

`src/app/dashboard/_data/page-meta-config.ts`:

```typescript
import type { MetaItem } from "../_components/page-header/PageMeta";

export type PageMetaConfig = {
  headline: { title: string; accent?: string };
  meta?: MetaItem[];
  description?: string;
};

/**
 * slug별 명시 메타. 미정의 slug는 dashboard/[slug]/page.tsx에서 sidebar label로 fallback.
 * 시작은 mockup 매칭 services + 자주 보는 페이지 한정. 나머지는 fallback.
 */
export const PAGE_META: Record<string, PageMetaConfig> = {
  services: {
    headline: { accent: "실시간", title: "서비스 운영" },
    meta: [
      { label: "근무 II", tone: "accent" },
      { label: "서비스", value: "12개" },
      { label: "자동 새로고침", value: "10초" },
    ],
    description:
      "현재 운영 중인 서비스 목록입니다. 각 서비스의 상태·담당 팀·최근 이벤트를 확인하고, 선택 시 인스펙터에서 실시간 지표를 볼 수 있습니다. 주의 상태는 주홍색 낙관으로 표시됩니다.",
  },
  alerts: {
    headline: { accent: "지금", title: "주의해야 할 알림" },
    description:
      "운영 중 발생한 긴급·검토·정상 알림을 시간순으로 확인합니다. 항목 선택 시 인스펙터에서 상세 컨텍스트와 대응 액션을 볼 수 있습니다.",
  },
  "my-todo": {
    headline: { accent: "오늘", title: "내가 처리할 일" },
    description: "마감 임박 순으로 정렬된 개인 작업 목록.",
  },
  schedule: {
    headline: { accent: "이번 주", title: "전체 일정" },
  },
  handover: {
    headline: { accent: "교대", title: "인수인계" },
  },
};
```

- [ ] **Step 2: dashboard/[slug]/page.tsx 수정 — PageHeader 호출**

기존 page.tsx 구조에 PageHeader 호출 추가. 구체 변경 코드:

먼저 기존 파일 일부 확인 (`src/app/dashboard/[slug]/page.tsx`)이 다음 구조를 가짐:
```tsx
const meta = findSidebarMeta(slug);
if (!meta) notFound();
// pattern render
```

이 후 PageHeader를 패턴 컴포넌트 위에 호출하도록 수정:

```tsx
import { PageHeader } from "../_components/page-header/PageHeader";
import { PAGE_META } from "../_data/page-meta-config";

// ... 기존 import ...

export default async function DashboardSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const meta = findSidebarMeta(slug);
  if (!meta) notFound();

  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? {
    headline: { title: meta.label },  // fallback: sidebar label
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      {/* 기존 패턴 렌더 영역 */}
      <RenderPattern slug={slug} pattern={meta.pattern} />
    </div>
  );
}
```

(실제 구조는 기존 page.tsx 참조 후 패턴 호출 방식 그대로 유지하면서 PageHeader 위에 추가.)

- [ ] **Step 3: typecheck/test**

```bash
npx tsc --noEmit && npm test
```

Expected: 0 errors, 모든 테스트 통과.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/_data/page-meta-config.ts src/app/dashboard/[slug]/page.tsx
git commit -m "feat: dashboard/[slug] PageHeader 적용 + 47 slug 메타 config"
```

---

## Task 8: e2e 갱신

**Files:**
- Modify: `e2e/dashboard.spec.ts`

**Goal:** sample 라우트(`/dashboard/services`, `/dashboard/alerts`)에서 PageHeader 어설션.

- [ ] **Step 1: e2e 어설션 추가**

`e2e/dashboard.spec.ts`에 새 test 추가 (기존 테스트 보존):

```typescript
test("PageHeader — services에서 headline + breadcrumb + tabs 노출", async ({
  page,
}) => {
  await page.goto("/dashboard/services");
  // headline accent + title
  await expect(page.getByText("실시간", { exact: true })).toBeVisible();
  await expect(page.getByText("서비스 운영", { exact: true })).toBeVisible();
  // vermilion 대시
  await expect(page.getByText("—").first()).toBeVisible();
  // breadcrumb 마지막 (현재 페이지)
  const crumbs = page.getByRole("navigation", { name: "경로" });
  await expect(crumbs).toContainText("서비스 그룹");
  await expect(crumbs).toContainText("전체 서비스");
  // tabs — 활성 tab "전체 서비스"
  const activeTab = page.getByRole("tab", { name: "전체 서비스" });
  await expect(activeTab).toHaveAttribute("aria-selected", "true");
});

test("PageHeader — fallback (alerts에 description만 정의)", async ({ page }) => {
  await page.goto("/dashboard/alerts");
  await expect(page.getByText("지금", { exact: true })).toBeVisible();
  await expect(page.getByText("주의해야 할 알림", { exact: true })).toBeVisible();
});
```

- [ ] **Step 2: e2e 실행 (가능하면)**

```bash
npm run e2e -- dashboard
```

Expected: 갱신된 어설션 PASS. 환경 의존 실패 시 BLOCKED 보고하되 코드 commit.

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test: e2e PageHeader — services + alerts 어설션 (Epic 2)"
```

---

## Task 9: 통합 검증 (DoD)

**Files:** 없음 (검증만)

**Goal:** 모든 검증 통과 + dev 서버 시각 확인.

- [ ] **Step 1: lint**

```bash
npm run lint
```

Expected: 0 errors (pre-existing 2 warnings 무시).

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: 단위 테스트 전체**

```bash
npm test
```

Expected: 모든 통과 (245 + 신규 ≈ 257+).

- [ ] **Step 4: design-audit**

```bash
bash .claude/hooks/design-lint.sh src/app/dashboard/_components/page-header/PageHeader.tsx
```

Expected: 0 위반.

- [ ] **Step 5: dev 서버 시각 확인**

dev 서버가 떠있다면 다음 sample 라우트 진입:
- `/dashboard/services` — 헤드라인 "실시간 — 서비스 운영" + 메타 + breadcrumb + 탭 (8개) 활성 "전체 서비스"
- `/dashboard/alerts` — 헤드라인 "지금 — 주의해야 할 알림" + breadcrumb + 형제 탭 ("새 알림" 활성)
- `/dashboard/handover` — fallback "인수인계" 단독 (accent 없음)

dev 서버 종료된 상태면 사용자에게 직접 실행 요청 + 검증 후 보고.

- [ ] **Step 6: 최종 push**

```bash
git push
```

Expected: 모든 commit이 origin에 동기화.

---

## Self-Review

**1. Spec 커버리지** — spec 모든 섹션 → task 매핑:

| Spec 섹션 | 구현 task |
|---|---|
| 3.1 컴포넌트 트리 | T1-T6 |
| 3.2 sidebar-helpers | T1 |
| 3.3 PageHeader | T6 |
| 3.4 Breadcrumb | T4 |
| 3.5 PageTabs | T5 |
| 3.6 PageMeta | T2 |
| 3.7 PageHeadline | T3 |
| 4. 데이터 흐름 | T1, T7 |
| 5. 적용 범위 (47 페이지) | T7 |
| 6. 에러 처리 (빈 배열, 매칭 실패) | T1 (helpers null), T4/T5 (null render) |
| 7.1 단위 테스트 | T1-T5 |
| 7.2 e2e | T8 |
| 8. 영향 파일 | 모든 task |
| 9. 리스크 (47 페이지 메타) | T7 (PAGE_META + fallback) |
| 10. DoD | T9 |

**누락 없음.**

**2. Placeholder scan**: 모든 step에 실제 코드/명령. "TBD/적절히/추후" 없음. 단 T7 Step 2에서 "기존 page.tsx 참조 후 패턴 호출 방식 그대로 유지"는 모호 — implementer가 기존 파일 구조를 read하고 적용해야 함. plan으로는 충분 (기존 파일 구조가 implementer가 직접 확인하기 더 정확).

**3. Type 일관성**:
- `MetaItem` (T2) → PageHeader (T6) → page-meta-config (T7) 동일 import
- `BreadcrumbCrumb` (T1) → Breadcrumb (T4) 동일
- `findSidebarBreadcrumb` / `findSidebarSiblings` (T1) → Breadcrumb/PageTabs/PageHeader 동일 import
- `PageMetaConfig` (T7) — local type only

**완료.**
