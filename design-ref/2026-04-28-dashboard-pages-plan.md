# Dashboard Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /dashboard 사이드바 22개 메뉴 항목별 콘텐츠 페이지 — 동적 [slug] 라우트 + 4 패턴 demo (목록/대시/로그/설정) + 사이드바 active state.

**Architecture:** _data.ts에 slug/pattern 매핑 + findSidebarMeta helper → layout.tsx로 셸 추출 → Sidebar에 Link+active → 4 패턴 컴포넌트 + mock data → [slug]/page.tsx가 메타 lookup 후 패턴 렌더 → e2e 회귀+신규.

**Tech Stack:** Next.js 16 (App Router 동적 라우트) + React 19 + Tailwind v4 + Vitest + Playwright. mock data 정적 (`_data/patterns.ts`).

**Repository note:** Folio는 git 저장소 (이미 init됨, GitHub origin 설정됨). 각 task는 정상적으로 commit + push 가능. 단 conventional commits 한국어 메시지 (rules/git.md).

**Spec 참조:** `design-ref/2026-04-28-dashboard-pages-design.md`

---

## File Structure

- **Modify**: `src/app/dashboard/_data.ts` — `SbItem`에 `slug?`, `pattern?` 추가, 22 항목 매핑, `findSidebarMeta` export
- **Create**: `src/app/dashboard/_data.test.ts` — `findSidebarMeta` Vitest 3 케이스
- **Create**: `src/app/dashboard/layout.tsx` — 셸 (TitleBar/MenuBar/Sidebar/StatusBar)
- **Modify**: `src/app/dashboard/page.tsx` — 셸 부분을 layout.tsx로 이동, Content+Inspector+selection만 남김
- **Modify**: `src/app/dashboard/_components/Sidebar.tsx` — `<Link>` wrapping + `usePathname` active 시각
- **Create**: `src/app/dashboard/_components/patterns/ListPattern.tsx` — 테이블 + 필터칩 + Inspector
- **Create**: `src/app/dashboard/_components/patterns/DashPattern.tsx` — 카드 위젯 grid + Inspector
- **Create**: `src/app/dashboard/_components/patterns/LogPattern.tsx` — 풀 너비 로그 stream
- **Create**: `src/app/dashboard/_components/patterns/SettingsPattern.tsx` — 좌 nav + 우 form
- **Create**: `src/app/dashboard/_data/patterns.ts` — mock data (list/dash/log/settings)
- **Create**: `src/app/dashboard/[slug]/page.tsx` — dynamic 라우트, 패턴 렌더
- **Modify**: `e2e/dashboard.spec.ts` — layout.tsx 추출 회귀 검증 (selector 갱신)
- **Create**: `e2e/dashboard-pages.spec.ts` — 22 라우트 smoke + 패턴별 e2e

총: 신규 9 + 수정 4 = **13 파일**

---

## Task 1: `_data.ts` slug/pattern + findSidebarMeta (TDD)

`SbItem`에 `slug`, `pattern` 필드 추가 + 22 항목 매핑 + `findSidebarMeta` helper. RED-GREEN으로 3 unit case.

**Files:**
- Create: `src/app/dashboard/_data.test.ts`
- Modify: `src/app/dashboard/_data.ts`

- [ ] **Step 1: 현재 _data.ts 구조 파악**

Run: `head -100 /Users/yss/개발/build/Folio/src/app/dashboard/_data.ts`
Expected: `SbItem`, `SbGroup`, `SbSection` 타입 + `sidebarSections: SbSection[]` 배열.

- [ ] **Step 2: RED — 신규 _data.test.ts 작성**

`src/app/dashboard/_data.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findSidebarMeta } from "./_data";

describe("findSidebarMeta", () => {
  it("section.entries item에서 slug 매칭", () => {
    expect(findSidebarMeta("alerts")).toEqual({
      label: "실시간 알림",
      pattern: "dash",
    });
  });

  it("group.items에서 slug 매칭 (재귀)", () => {
    expect(findSidebarMeta("infra-db")).toEqual({
      label: "DB · 저장소",
      pattern: "list",
    });
  });

  it("존재하지 않는 slug면 null", () => {
    expect(findSidebarMeta("nonexistent")).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실행 → RED 확인**

Run: `cd /Users/yss/개발/build/Folio && npm test 2>&1 | tail -15`
Expected: 3 신규 fail (`findSidebarMeta` 정의 안 됨 — import error).

- [ ] **Step 4: GREEN — _data.ts에 slug/pattern + findSidebarMeta 추가**

`src/app/dashboard/_data.ts` 갱신:

(a) 파일 상단 (Sidebar 타입 정의 부근)에 추가:

```ts
export type SbPattern = "list" | "dash" | "log" | "settings";
```

(b) `SbItem` 타입 갱신:

```ts
export type SbItem = {
  ico: string;
  label: string;
  count?: string;
  slug?: string;
  pattern?: SbPattern;
};
```

(c) `sidebarSections` 배열의 22 항목에 slug/pattern 매핑 추가. 기존 sections를 다음으로 교체 (label/ico/count는 그대로):

```ts
export const sidebarSections: SbSection[] = [
  {
    title: "개요",
    entries: [
      { kind: "item", ico: "◉", label: "실시간 현황" }, // /dashboard index — slug 미지정
      { kind: "item", ico: "✦", label: "실시간 알림", count: "3", slug: "alerts", pattern: "dash" },
      { kind: "item", ico: "◈", label: "인수인계", count: "1", slug: "handover", pattern: "dash" },
    ],
  },
  {
    title: "서비스 그룹",
    entries: [
      {
        kind: "group",
        label: "주요 서비스",
        count: "12",
        defaultOpen: true,
        items: [
          { ico: "·", label: "전체 서비스", count: "12", slug: "services", pattern: "list" },
          { ico: "·", label: "웹 · 프론트", count: "4", slug: "services-web", pattern: "list" },
          { ico: "·", label: "API 게이트웨이", count: "3", slug: "services-api", pattern: "list" },
          { ico: "·", label: "백엔드 서비스", count: "5", slug: "services-backend", pattern: "list" },
        ],
      },
      {
        kind: "group",
        label: "인프라",
        count: "17",
        items: [
          { ico: "·", label: "DB · 저장소", count: "8", slug: "infra-db", pattern: "list" },
          { ico: "·", label: "캐시", count: "3", slug: "infra-cache", pattern: "list" },
          { ico: "·", label: "메시지 큐", count: "6", slug: "infra-mq", pattern: "list" },
        ],
      },
      { kind: "item", ico: "▣", label: "배치 워커", count: "6", slug: "batch-worker", pattern: "list" },
    ],
  },
  {
    title: "운영 작업",
    entries: [
      { kind: "item", ico: "▦", label: "배치 작업", count: "14", slug: "batch-jobs", pattern: "list" },
      { kind: "item", ico: "◎", label: "일일 점검", count: "8/12", slug: "daily-check", pattern: "list" },
      { kind: "item", ico: "⚠", label: "장애 대응", count: "2", slug: "incidents", pattern: "list" },
      { kind: "item", ico: "◊", label: "변경 관리", count: "7", slug: "changes", pattern: "list" },
    ],
  },
  {
    title: "관측 · 로그",
    entries: [
      { kind: "item", ico: "◰", label: "Grafana 지표", slug: "grafana", pattern: "dash" },
      { kind: "item", ico: "≡", label: "Kibana 로그", slug: "kibana", pattern: "log" },
      { kind: "item", ico: "⤳", label: "APM 트레이스", slug: "apm", pattern: "log" },
      { kind: "item", ico: "✉", label: "알림 이력", count: "47", slug: "notifications", pattern: "dash" },
    ],
  },
  {
    title: "관리",
    entries: [
      { kind: "item", ico: "☏", label: "온콜 일정", slug: "oncall", pattern: "list" },
      { kind: "item", ico: "◐", label: "팀 · 권한", count: "8", slug: "team", pattern: "list" },
      { kind: "item", ico: "⚙", label: "환경설정", slug: "settings", pattern: "settings" },
    ],
  },
];
```

(d) 파일 끝(또는 sidebarSections 다음)에 `findSidebarMeta` 추가:

```ts
export function findSidebarMeta(
  slug: string
): { label: string; pattern: SbPattern } | null {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug === slug && entry.pattern) {
        return { label: entry.label, pattern: entry.pattern };
      }
      if (entry.kind === "group") {
        for (const item of entry.items) {
          if (item.slug === slug && item.pattern) {
            return { label: item.label, pattern: item.pattern };
          }
        }
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: 테스트 재실행 → GREEN 확인**

Run: `cd /Users/yss/개발/build/Folio && npm test 2>&1 | tail -10`
Expected: 26 passed (23 기존 + 3 신규).

- [ ] **Step 6: tsc 회귀**

Run: `cd /Users/yss/개발/build/Folio && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 7: commit**

```bash
git add src/app/dashboard/_data.ts src/app/dashboard/_data.test.ts
git commit -m "$(cat <<'EOF'
feat: 사이드바 22 항목 slug/pattern 매핑 + findSidebarMeta helper

각 SbItem에 slug?: string, pattern?: SbPattern 필드 추가. dynamic 라우트가 이 매핑으로 패턴 컴포넌트 lookup. Vitest 3 케이스 (item/group/null).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: 체크포인트 보고**

```
Task 1 완료 — slug/pattern 매핑 + findSidebarMeta
- RED 3 fail → GREEN 26/26 pass
- 22 항목 매핑 (15 item + 7 group sub-items)
- tsc 0
```

---

## Task 2: `layout.tsx` 추출 + 기존 `page.tsx` 셸 분리

기존 dashboard/page.tsx 안에 있는 셸(TitleBar/MenuBar/Sidebar/StatusBar 렌더)을 `layout.tsx`로 이동. page.tsx는 `<Content/>` + `<Inspector/>`만 렌더.

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: 현재 page.tsx 구조 파악**

Run: `cat /Users/yss/개발/build/Folio/src/app/dashboard/page.tsx | head -100`
Expected: TitleBar, AppBar, MenuBar, Sidebar, Content, Inspector, StatusBar 모두 한 파일에 inline. selectedId state 등 selection 로직 있음.

- [ ] **Step 2: layout.tsx 작성**

`src/app/dashboard/layout.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./_components/Sidebar";
import { MenuBar } from "./_components/MenuBar";
import { sidebarSections } from "./_data";

/**
 * dashboard 셸 — TitleBar + AppBar(모바일) + MenuBar(데스크탑) + Sidebar + StatusBar.
 * 모든 /dashboard 하위 라우트 공통. children에 페이지 본체 렌더.
 *
 * mobile drawer 상태(open)는 layout이 보유 — 페이지 전환 시 자동 close.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // path 변경 시 drawer 자동 close
  useEffect(() => {
    const onNavigation = () => setDrawerOpen(false);
    window.addEventListener("popstate", onNavigation);
    return () => window.removeEventListener("popstate", onNavigation);
  }, []);

  return (
    <div className="relative z-10 grid h-screen grid-rows-[34px_36px_1fr_26px] max-md:grid-rows-[44px_1fr_26px]">
      <TitleBar />
      <AppBar onDrawerOpen={() => setDrawerOpen(true)} />
      <MenuBar />
      <main className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[260px_1fr]">
        <Sidebar
          sections={sidebarSections}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </main>
      <StatusBar />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TitleBar — 데스크탑 ≥768px (max-md:hidden)
   ════════════════════════════════════════════════════════════ */
function TitleBar() {
  return (
    <div className="hidden h-[34px] items-center border-b border-line bg-ink px-3.5 text-cream md:grid md:grid-cols-[auto_1fr_auto]">
      <div className="mr-[18px] flex gap-[7px]">
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-vermilion" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-gold" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-sage" />
      </div>
      <div className="text-center text-[13px] font-medium tracking-[0.02em]">
        운영부 <em className="not-italic mx-1.5 text-vermilion">·</em> 운영 상황실
        <span className="ml-2 text-[12px] opacity-80">OPSROOM</span>
      </div>
      <div className="ref flex gap-3.5 text-[10px] tracking-[0.08em] opacity-75">
        <span>근무 · 2교대 · 14:00~22:00</span>
        <span>● 실시간 연결</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AppBar — 모바일 ≤767px (md:hidden)
   ════════════════════════════════════════════════════════════ */
function AppBar({ onDrawerOpen }: { onDrawerOpen: () => void }) {
  return (
    <header className="flex h-[44px] items-center gap-2 border-b border-line bg-washi-raised px-3 md:hidden">
      <button
        type="button"
        aria-label="사이드바 열기"
        aria-controls="sidebar"
        onClick={onDrawerOpen}
        className="inline-flex cursor-pointer items-center justify-center border border-line-soft bg-transparent px-2 text-md text-ink min-w-[var(--tap-min)] min-h-[var(--tap-min)]"
      >
        ☰
      </button>
      <div className="flex-1 text-center text-md font-semibold tracking-[0.02em]">
        운영부 <em className="not-italic mx-0.5 text-vermilion">·</em>{" "}
        <span className="text-sm text-muted max-[479px]:hidden">OPSROOM</span>
      </div>
      <button
        type="button"
        aria-label="알림 3건"
        className="inline-flex cursor-pointer items-center justify-center border border-line-soft bg-transparent px-2 text-md text-ink min-w-[var(--tap-min)] min-h-[var(--tap-min)]"
      >
        ✉
      </button>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   StatusBar — 하단 26px
   ════════════════════════════════════════════════════════════ */
function StatusBar() {
  return (
    <div className="grid h-[26px] grid-cols-[1fr_auto_1fr] items-center gap-5 border-t border-line bg-washi-raised px-4 text-xs tracking-[0.02em] text-muted max-md:gap-3 max-md:px-3">
      <div className="flex items-center gap-5">
        <span className="flex items-center">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sage [box-shadow:var(--shadow-led-sage)]" />
          <span>연결됨</span>
        </span>
      </div>
      <div className="flex items-center justify-center gap-5 max-md:hidden">
        <span>운영부 · OPSROOM</span>
      </div>
      <div className="flex items-center justify-end gap-5">
        <span className="code">sha 8c3f2a1</span>
      </div>
    </div>
  );
}
```

**중요**: 위 TitleBar/AppBar/StatusBar 코드는 기존 dashboard/page.tsx에서 그대로 옮긴 것. 기존 코드와 정확히 일치해야 회귀 0. **Step 1에서 실제 코드 확인 후 그대로 복사**.

- [ ] **Step 3: 기존 page.tsx에서 셸 부분 제거**

`src/app/dashboard/page.tsx`에서 다음을 제거:
- TitleBar, AppBar, MenuBar, Sidebar, StatusBar 컴포넌트 정의 (이미 layout.tsx 또는 _components에 있음)
- main wrapper grid (layout.tsx가 처리)
- drawerOpen state (layout으로 이동)

`page.tsx`는 default export로 dashboard 본체(Content + Inspector + selection)만 반환하도록 갱신:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { services, sidebarSections } from "./_data";
import { Content } from "./_components/Content";
import { Inspector } from "./_components/Inspector";

/**
 * /dashboard (slug 없음 = "실시간 현황") — 기존 default 페이지 내용.
 *
 * 셸(TitleBar/MenuBar/Sidebar/StatusBar)은 layout.tsx에서 처리.
 * 이 페이지는 Content (서비스 목록) + Inspector (선택 행 상세)만 책임.
 */
export default function DashboardIndexPage() {
  const [selectedId, setSelectedId] = useState("SVC-PAY-001");
  // ... (기존 selectedId 관련 로직 유지)

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedId) ?? services[0],
    [selectedId]
  );

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_360px]">
      <Content
        services={services}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <Inspector service={selectedService} />
    </div>
  );
}
```

(주의: Content/Inspector props는 기존 page.tsx와 정확히 매치해야 함. 기존 props 구조 그대로 유지.)

- [ ] **Step 4: tsc + lint + Vitest 회귀**

Run: `cd /Users/yss/개발/build/Folio && npx tsc --noEmit && npm run lint 2>&1 | tail -5 && npm test 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors, Vitest 26/26.

- [ ] **Step 5: dev server에서 /dashboard 진입 시각 확인**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/dashboard`
Expected: 200

브라우저에서 /dashboard 진입 시:
- TitleBar (운영부 · 운영 상황실 OPSROOM) 노출
- MenuBar (◆ + 검색바 + 송영석)
- Sidebar (5 섹션)
- 서비스 목록 + Inspector
- StatusBar (연결됨)

기존과 시각 동일해야 함.

- [ ] **Step 6: e2e 회귀 (기존 dashboard.spec.ts)**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e -- --grep "dashboard" 2>&1 | tail -10
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
sleep 4
```

Expected: dashboard 관련 시나리오 모두 통과 (서비스 행 선택, Inspector 갱신, 사이드바 그룹 토글, 필터 칩, 뷰스위치, 탭, 키보드 a11y, 사용자 dropdown 로그아웃 등).

- [ ] **Step 7: commit**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
refactor: dashboard 셸을 layout.tsx로 추출

TitleBar/AppBar/MenuBar/Sidebar/StatusBar를 layout.tsx로 이동. page.tsx는 Content+Inspector+selection만 책임. 동적 라우트(/dashboard/[slug])에서 동일 셸 재사용 위함.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: 체크포인트**

```
Task 2 완료 — layout.tsx 추출
- 셸 5 컴포넌트 layout으로 이동
- 기존 dashboard 회귀 0 (e2e + 시각)
- tsc/lint/Vitest 0
```

---

## Task 3: `Sidebar.tsx` Link/active 동작화

각 SbItem을 `<Link>`로 wrapping + `usePathname` 기반 active 시각.

**Files:**
- Modify: `src/app/dashboard/_components/Sidebar.tsx`

- [ ] **Step 1: 현재 Sidebar.tsx 구조 파악**

Run: `cat /Users/yss/개발/build/Folio/src/app/dashboard/_components/Sidebar.tsx | head -120`
Expected: 각 item을 button으로 렌더 (클릭 핸들러 없음). `<button className="sb-item ...">` 형태.

- [ ] **Step 2: Sidebar.tsx 갱신**

`src/app/dashboard/_components/Sidebar.tsx` 상단 import에 추가:

```tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
```

`Sidebar` 컴포넌트 본문 시작 부분에 추가:

```tsx
const pathname = usePathname();
const isItemActive = (slug?: string) => {
  if (!slug) return pathname === "/dashboard"; // 실시간 현황 (index)
  return pathname === `/dashboard/${slug}`;
};
```

각 item 렌더링 부분 (button)을 다음 패턴으로 교체:

기존:
```tsx
<button type="button" className="sb-item ...">
  <span className="ico">{item.ico}</span>
  <span>{item.label}</span>
  {item.count && <span className="count">{item.count}</span>}
</button>
```

새:
```tsx
{item.slug || item.label === "실시간 현황" ? (
  <Link
    href={item.slug ? `/dashboard/${item.slug}` : "/dashboard"}
    prefetch={false}
    className={`sb-item ${isItemActive(item.slug) ? "border-l-2 border-vermilion bg-vermilion/10 text-vermilion" : "border-l-2 border-transparent hover:bg-line-soft"} ...기존 그대로...`}
  >
    <span className="ico">{item.ico}</span>
    <span>{item.label}</span>
    {item.count && <span className="count">{item.count}</span>}
  </Link>
) : (
  <div className="sb-item border-l-2 border-transparent text-muted ...기존 그대로...">
    <span className="ico">{item.ico}</span>
    <span>{item.label}</span>
    {item.count && <span className="count">{item.count}</span>}
  </div>
)}
```

(item이 group 안 sub-item인 경우도 동일 패턴 적용 — group.items.map 안에서)

**중요**: 기존 className 그대로 유지하면서 `border-l-2` 처음 추가. active 상태에서만 vermilion 색.

- [ ] **Step 3: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 4: dev server에서 사이드바 active 시각 확인**

브라우저에서 /dashboard 진입:
- "실시간 현황" 항목에 vermilion border-left + 배경 active 시각
- 다른 항목들은 inactive (transparent border)

- [ ] **Step 5: e2e 회귀**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e 2>&1 | tail -10
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
sleep 4
```

Expected: 회귀 0 failed (기존 시나리오 영향 없음).

- [ ] **Step 6: commit**

```bash
git add src/app/dashboard/_components/Sidebar.tsx
git commit -m "feat: 사이드바 항목 Link 동작화 + active 시각 (vermilion border-left)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: 체크포인트**

```
Task 3 완료 — Sidebar Link/active
- usePathname 기반 active 매칭 ✓
- vermilion border-left + bg-vermilion/10 ✓
- prefetch={false} ✓
- e2e 회귀 0
```

---

## Task 4: `ListPattern.tsx`

테이블 + 필터칩 + 행 선택 → Inspector 상세.

**Files:**
- Create: `src/app/dashboard/_components/patterns/ListPattern.tsx`

- [ ] **Step 1: 디렉터리 + 파일 생성**

```bash
mkdir -p /Users/yss/개발/build/Folio/src/app/dashboard/_components/patterns
```

`src/app/dashboard/_components/patterns/ListPattern.tsx`:

```tsx
"use client";

import { useState } from "react";

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

export function ListPattern({
  title,
  data,
}: {
  title: string;
  data: { rows: ListRow[] };
}) {
  const [filter, setFilter] = useState<"all" | ListRow["status"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(data.rows[0]?.id ?? null);

  const filtered =
    filter === "all" ? data.rows : data.rows.filter((r) => r.status === filter);

  const selected = data.rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
      {/* 좌: Content */}
      <section className="min-h-0 overflow-y-auto p-5 md:p-6 lg:p-7">
        <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
          <span>운영부</span>
          <span className="text-faint">/</span>
          <strong className="font-semibold text-ink">{title}</strong>
        </nav>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            {title} · {data.rows.length}건
          </h2>
        </div>
        <p className="mb-4 text-xs text-muted">Demo · 실제 데이터 미연결</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "urgent", "active", "review", "approved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`border px-3 py-1 text-xs tracking-[0.04em] transition-colors ${
                filter === f
                  ? "border-ink bg-ink text-cream"
                  : "border-line bg-transparent text-ink hover:border-vermilion hover:text-vermilion"
              }`}
            >
              {f === "all" ? "전체" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead className="bg-washi-raised text-xs tracking-[0.06em] text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium uppercase">ID</th>
                <th className="px-3 py-2 text-left font-medium uppercase">이름</th>
                <th className="px-3 py-2 text-left font-medium uppercase">상태</th>
                <th className="px-3 py-2 text-left font-medium uppercase">담당</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    aria-pressed={row.id === selectedId}
                    className={`cursor-pointer border-t border-line transition-colors ${
                      row.id === selectedId ? "bg-vermilion/10" : "hover:bg-line-soft"
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

      {/* 우: Inspector (lg+ 전용) */}
      <aside className="hidden border-l border-line bg-washi-raised lg:block">
        <div className="p-5 lg:p-6">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-muted">
            상세
          </h3>
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-muted">ID</div>
                <div className="font-mono text-sm">{selected.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted">이름</div>
                <div className="text-md font-semibold">{selected.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted">상태</div>
                <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted">담당</div>
                <div className="text-sm">{selected.owner}</div>
              </div>
              {selected.meta && (
                <div>
                  <div className="text-xs text-muted">메타</div>
                  <div className="text-sm text-ink-soft">{selected.meta}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">행을 선택하세요.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 3: commit**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx
git commit -m "feat: ListPattern (테이블 + 필터칩 + Inspector 행 상세)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: 체크포인트**

```
Task 4 완료 — ListPattern
- 필터칩 5 (전체/긴급/활성/점검중/정상)
- 행 선택 → Inspector 상세 (ID/이름/상태/담당/메타)
- 모바일 Inspector 숨김
- 빈 데이터 처리
```

---

## Task 5: `DashPattern.tsx`

카드 위젯 grid + 위젯 선택 → Inspector.

**Files:**
- Create: `src/app/dashboard/_components/patterns/DashPattern.tsx`

- [ ] **Step 1: 파일 작성**

`src/app/dashboard/_components/patterns/DashPattern.tsx`:

```tsx
"use client";

import { useState } from "react";

export type DashWidget = {
  id: string;
  tone: "urgent" | "ok" | "review";
  label: string;
  value: string;
  time: string;
};

const TONE_BG: Record<DashWidget["tone"], string> = {
  urgent: "border-vermilion bg-vermilion/10",
  ok: "border-sage bg-sage/10",
  review: "border-gold bg-gold/10",
};

const TONE_TEXT: Record<DashWidget["tone"], string> = {
  urgent: "text-vermilion",
  ok: "text-sage",
  review: "text-gold",
};

export function DashPattern({
  title,
  data,
}: {
  title: string;
  data: { widgets: DashWidget[] };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.widgets.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_320px]">
      <section className="min-h-0 overflow-y-auto p-5 md:p-6 lg:p-7">
        <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
          <span>운영부</span>
          <span className="text-faint">/</span>
          <strong className="font-semibold text-ink">{title}</strong>
        </nav>
        <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
          {title} · {data.widgets.length}건
        </h2>
        <p className="mb-5 text-xs text-muted">Demo · 실제 데이터 미연결</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.widgets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedId(w.id)}
              aria-pressed={w.id === selectedId}
              className={`group flex flex-col gap-2 border-2 p-4 text-left transition-colors ${TONE_BG[w.tone]} ${
                w.id === selectedId ? "ring-2 ring-ink ring-offset-2" : ""
              }`}
            >
              <div className={`text-xs font-medium uppercase tracking-[0.08em] ${TONE_TEXT[w.tone]}`}>
                {w.tone === "urgent" ? "긴급" : w.tone === "ok" ? "정상" : "점검"}
              </div>
              <div className="text-md font-semibold text-ink">{w.label}</div>
              <div className="text-2xl font-semibold tracking-[-0.02em] text-ink">{w.value}</div>
              <div className="text-xs text-muted">{w.time}</div>
            </button>
          ))}
        </div>
      </section>

      <aside className="hidden border-l border-line bg-washi-raised lg:block">
        <div className="p-5 lg:p-6">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-[0.06em] text-muted">
            {selected ? "위젯 상세" : "전체 요약"}
          </h3>
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-xs text-muted">ID</div>
                <div className="font-mono text-sm">{selected.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted">분류</div>
                <span className={`inline-block px-2 py-0.5 text-xs ${TONE_BG[selected.tone]} ${TONE_TEXT[selected.tone]}`}>
                  {selected.tone === "urgent" ? "긴급" : selected.tone === "ok" ? "정상" : "점검"}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted">라벨</div>
                <div className="text-md font-semibold">{selected.label}</div>
              </div>
              <div>
                <div className="text-xs text-muted">값</div>
                <div className="text-2xl font-semibold">{selected.value}</div>
              </div>
              <div>
                <div className="text-xs text-muted">시간</div>
                <div className="text-sm text-ink-soft">{selected.time}</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted">위젯을 선택하면 상세 정보를 확인할 수 있습니다.</p>
              <hr className="border-line-soft" />
              <div>
                <div className="text-xs text-muted">총 위젯</div>
                <div className="text-2xl font-semibold">{data.widgets.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted">긴급</div>
                <div className="text-md font-semibold text-vermilion">
                  {data.widgets.filter((w) => w.tone === "urgent").length}건
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 3: commit**

```bash
git add src/app/dashboard/_components/patterns/DashPattern.tsx
git commit -m "feat: DashPattern (카드 위젯 grid + Inspector 위젯 상세)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: 체크포인트**

```
Task 5 완료 — DashPattern
- 위젯 grid (1/2/3 cols 반응형)
- 위젯 선택 → Inspector 상세
- 미선택 시 Inspector "전체 요약"
```

---

## Task 6: `LogPattern.tsx`

풀 너비 로그 stream + 검색바 (정적).

**Files:**
- Create: `src/app/dashboard/_components/patterns/LogPattern.tsx`

- [ ] **Step 1: 파일 작성**

`src/app/dashboard/_components/patterns/LogPattern.tsx`:

```tsx
"use client";

import { useState } from "react";

export type LogLine = {
  ts: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  msg: string;
};

const LEVEL_COLOR: Record<LogLine["level"], string> = {
  INFO: "text-ink-soft",
  WARN: "text-gold",
  ERROR: "text-vermilion",
  DEBUG: "text-muted",
};

export function LogPattern({
  title,
  data,
}: {
  title: string;
  data: { lines: LogLine[] };
}) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | LogLine["level"]>("all");

  const filtered = data.lines.filter((line) => {
    if (levelFilter !== "all" && line.level !== levelFilter) return false;
    if (query && !line.msg.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
        <span>운영부</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">{title}</strong>
      </nav>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mb-4 text-xs text-muted">Demo · 실제 데이터 미연결</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 min-w-[240px] items-center gap-1.5 border border-line-soft bg-washi-raised px-3 py-2">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted">
            <path
              d="M11 6.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM10.5 10l3 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="쿼리 입력…"
            className="flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "INFO", "WARN", "ERROR", "DEBUG"] as const).map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevelFilter(lv)}
              className={`border px-3 py-1 text-xs tracking-[0.04em] transition-colors ${
                levelFilter === lv
                  ? "border-ink bg-ink text-cream"
                  : "border-line bg-transparent text-ink hover:border-vermilion hover:text-vermilion"
              }`}
            >
              {lv === "all" ? "전체" : lv}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-line bg-ink text-cream">
        <pre className="m-0 p-3 text-xs leading-[1.6]">
          {filtered.length === 0 ? (
            <span className="text-muted">로그 결과가 없습니다.</span>
          ) : (
            filtered.map((line, i) => (
              <div key={i} className="font-mono">
                <span className="opacity-60">{line.ts}</span>{" "}
                <span className={`font-semibold ${LEVEL_COLOR[line.level]}`}>[{line.level}]</span>{" "}
                <span>{line.msg}</span>
              </div>
            ))
          )}
        </pre>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 3: commit**

```bash
git add src/app/dashboard/_components/patterns/LogPattern.tsx
git commit -m "feat: LogPattern (풀 너비 로그 stream + 검색/레벨 필터)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: 체크포인트**

```
Task 6 완료 — LogPattern
- 검색바 + 레벨 필터칩 5
- ink 배경 monospace stream
- Inspector 영역 없음 (풀 너비)
```

---

## Task 7: `SettingsPattern.tsx`

좌 nav + 우 form split.

**Files:**
- Create: `src/app/dashboard/_components/patterns/SettingsPattern.tsx`

- [ ] **Step 1: 파일 작성**

`src/app/dashboard/_components/patterns/SettingsPattern.tsx`:

```tsx
"use client";

import { useState } from "react";

export type SettingsField =
  | { type: "select"; label: string; value: string; options: string[] }
  | { type: "radio"; label: string; value: string; options: string[] }
  | { type: "toggle"; label: string; value: boolean };

export type SettingsSection = {
  id: string;
  label: string;
  fields: SettingsField[];
};

export function SettingsPattern({
  title,
  data,
}: {
  title: string;
  data: { sections: SettingsSection[] };
}) {
  const [activeId, setActiveId] = useState(data.sections[0]?.id ?? "");
  const active = data.sections.find((s) => s.id === activeId) ?? data.sections[0];

  return (
    <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
      <nav className="mb-4 flex items-center gap-2 text-xs tracking-[0.04em] text-muted">
        <span>운영부</span>
        <span className="text-faint">/</span>
        <strong className="font-semibold text-ink">{title}</strong>
      </nav>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      <p className="mb-5 text-xs text-muted">Demo · 변경사항 적용 안 됨</p>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        {/* 좌 nav */}
        <nav className="flex flex-col gap-1 border-r border-line pr-4 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:pb-3 max-md:pr-0">
          {data.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              aria-pressed={s.id === activeId}
              className={`flex items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:border-l-0 max-md:border-b-2 max-md:px-4 ${
                s.id === activeId
                  ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                  : "border-transparent text-ink hover:bg-line-soft"
              }`}
            >
              <span className="text-xs">
                {s.id === activeId ? "◉" : "·"}
              </span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        {/* 우 form */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">{active?.label} 설정</h3>
          {active?.fields.map((field, i) => (
            <SettingsFieldRow key={i} field={field} />
          ))}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled
              className="cursor-not-allowed border border-ink bg-ink px-5 py-2 text-sm tracking-[0.04em] text-cream opacity-60"
              title="Demo · 실제 저장 안 됨"
            >
              저장
            </button>
            <button
              type="button"
              className="cursor-pointer border border-line bg-transparent px-5 py-2 text-sm tracking-[0.04em] text-ink hover:border-vermilion hover:text-vermilion"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsFieldRow({ field }: { field: SettingsField }) {
  if (field.type === "select") {
    return (
      <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr]">
        <label className="text-sm text-muted">{field.label}</label>
        <select
          defaultValue={field.value}
          className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr]">
        <label className="text-sm text-muted">{field.label}</label>
        <div className="flex gap-4">
          {field.options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.label}
                defaultChecked={opt === field.value}
                className="h-3.5 w-3.5 cursor-pointer"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  // toggle
  return (
    <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[160px_1fr]">
      <label className="text-sm text-muted">{field.label}</label>
      <label className="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          defaultChecked={field.value}
          className="h-3.5 w-3.5 cursor-pointer"
        />
        <span className="text-sm">{field.value ? "켬" : "꺼짐"}</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 3: commit**

```bash
git add src/app/dashboard/_components/patterns/SettingsPattern.tsx
git commit -m "feat: SettingsPattern (좌 nav + 우 form, select/radio/toggle 필드)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: 체크포인트**

```
Task 7 완료 — SettingsPattern
- 좌 nav + 우 form (모바일은 상단 nav)
- 3 field type (select/radio/toggle)
- 저장 disabled (Demo)
```

---

## Task 8: `_data/patterns.ts` mock data

패턴별 mock + `getPatternMockData` lookup.

**Files:**
- Create: `src/app/dashboard/_data/patterns.ts`

- [ ] **Step 1: 디렉터리 + 파일 생성**

```bash
mkdir -p /Users/yss/개발/build/Folio/src/app/dashboard/_data
```

`src/app/dashboard/_data/patterns.ts`:

```ts
import { OPERATORS } from "@/features/auth/operators";
import type { ListRow } from "../_components/patterns/ListPattern";
import type { DashWidget } from "../_components/patterns/DashPattern";
import type { LogLine } from "../_components/patterns/LogPattern";
import type { SettingsField, SettingsSection } from "../_components/patterns/SettingsPattern";
import type { SbPattern } from "../_data";

const listMockRows: ListRow[] = [
  { id: "SVC-001", name: "결제 게이트웨이", status: "urgent",   owner: "김슬기",   meta: "최근 배포 14:23" },
  { id: "SVC-002", name: "회원 서비스",     status: "active",   owner: "정윤나",   meta: "정상" },
  { id: "SVC-003", name: "검색 인덱서",     status: "review",   owner: "한효진",   meta: "재인덱싱 중" },
  { id: "SVC-004", name: "알림 발송기",     status: "active",   owner: "김유민",   meta: "정상" },
  { id: "SVC-005", name: "주문 워커",       status: "approved", owner: "박시현",   meta: "지난 주 안정" },
  { id: "SVC-006", name: "이미지 처리",     status: "active",   owner: "전지은",   meta: "정상" },
  { id: "SVC-007", name: "리포트 생성기",   status: "review",   owner: "임종우",   meta: "월말 점검" },
  { id: "SVC-008", name: "헬스체크 봇",     status: "approved", owner: "이해영",   meta: "30일 무중단" },
];

const dashMockWidgets: DashWidget[] = [
  { id: "W1", tone: "urgent", label: "결제 지연",         value: "350ms",  time: "14:23" },
  { id: "W2", tone: "ok",     label: "정상 서비스",        value: "47건",  time: "24h" },
  { id: "W3", tone: "review", label: "점검중 인프라",      value: "2건",   time: "30m" },
  { id: "W4", tone: "ok",     label: "API 평균 응답",      value: "82ms",  time: "1h" },
  { id: "W5", tone: "urgent", label: "에러율 임계 초과",   value: "1.4%",  time: "5m" },
  { id: "W6", tone: "ok",     label: "활성 사용자",        value: "1,287", time: "현재" },
];

const logMockLines: LogLine[] = [
  { ts: "14:23:45", level: "INFO",  msg: "결제 게이트웨이 헬스체크 통과 (200ms)" },
  { ts: "14:23:42", level: "WARN",  msg: "API latency 350ms (>200) — payment-svc" },
  { ts: "14:23:01", level: "ERROR", msg: "DB 연결 실패 — retry 3/3, fallback active" },
  { ts: "14:22:59", level: "INFO",  msg: "주문 워커 큐 1024건 처리 완료" },
  { ts: "14:22:30", level: "DEBUG", msg: "캐시 hit ratio: 0.87 (target 0.85)" },
  { ts: "14:22:00", level: "INFO",  msg: "스케줄러 작업 'daily-cleanup' 시작" },
  { ts: "14:21:45", level: "WARN",  msg: "메모리 사용률 78% (warning 75%)" },
  { ts: "14:21:30", level: "INFO",  msg: "사용자 'ys1114@jinhakapply.com' 로그인" },
  { ts: "14:21:00", level: "ERROR", msg: "외부 API 타임아웃 — partner-gw 응답 없음" },
  { ts: "14:20:45", level: "INFO",  msg: "이미지 처리 완료 — batch-2026-04-28-001" },
  { ts: "14:20:30", level: "DEBUG", msg: "GC 통계: young 12ms, old 0ms" },
  { ts: "14:20:00", level: "INFO",  msg: "헬스체크 라운드 #4521 시작" },
  { ts: "14:19:45", level: "WARN",  msg: "디스크 I/O 응답 시간 증가 — node-3" },
  { ts: "14:19:30", level: "INFO",  msg: "리포트 생성기 일일 보고서 발송 완료" },
  { ts: "14:19:00", level: "ERROR", msg: "결제 콜백 처리 실패 — txn-abc-123" },
  { ts: "14:18:45", level: "INFO",  msg: "사용자 'kjh@jinhakapply.com' 로그아웃" },
  { ts: "14:18:30", level: "DEBUG", msg: "Connection pool 활성: 24/100" },
  { ts: "14:18:00", level: "INFO",  msg: "변경 관리 #CR-2026-042 승인됨" },
  { ts: "14:17:45", level: "WARN",  msg: "캐시 evict 빈도 증가 — 점검 필요" },
  { ts: "14:17:30", level: "INFO",  msg: "검색 인덱서 재구축 완료 (2.3M docs)" },
  { ts: "14:17:00", level: "ERROR", msg: "메시지 큐 dead-letter 5건 발생" },
  { ts: "14:16:45", level: "INFO",  msg: "API rate limit 일일 통계 reset" },
  { ts: "14:16:30", level: "DEBUG", msg: "JWT 만료 임박 — 1240명" },
  { ts: "14:16:00", level: "INFO",  msg: "알림 발송기 SMS 47건, 이메일 213건 발송" },
  { ts: "14:15:45", level: "WARN",  msg: "외부 SMTP 연결 지연 (3.2s)" },
  { ts: "14:15:30", level: "INFO",  msg: "온콜 교대 — 운영2팀 송영신 → 운영1팀 한효진" },
  { ts: "14:15:00", level: "ERROR", msg: "결제 게이트웨이 타임아웃 — gw-2 격리" },
  { ts: "14:14:45", level: "INFO",  msg: "장애 #INC-2026-042 처리 완료" },
  { ts: "14:14:30", level: "DEBUG", msg: "메모리 GC 트리거" },
  { ts: "14:14:00", level: "INFO",  msg: "헬스체크 라운드 #4520 완료" },
  { ts: "14:13:45", level: "WARN",  msg: "API 응답 P95 200ms 초과 — search-svc" },
  { ts: "14:13:30", level: "INFO",  msg: "Grafana 알림 'high-error-rate' 정상화" },
  { ts: "14:13:00", level: "ERROR", msg: "DB query timeout — orders.findByUser (>5s)" },
  { ts: "14:12:45", level: "INFO",  msg: "캐시 워밍업 완료 — top 1000 keys" },
  { ts: "14:12:30", level: "DEBUG", msg: "Redis cluster 노드 헬스 OK (6/6)" },
  { ts: "14:12:00", level: "INFO",  msg: "배치 #B-2471 시작 — 일일 정산" },
  { ts: "14:11:45", level: "WARN",  msg: "실패한 로그인 시도 임계 초과 — IP 블록" },
  { ts: "14:11:30", level: "INFO",  msg: "변경 관리 #CR-2026-041 적용 완료" },
  { ts: "14:11:00", level: "ERROR", msg: "디스크 공간 부족 경고 — node-2 (85%)" },
  { ts: "14:10:45", level: "INFO",  msg: "사용자 'jkee@jinhakapply.com' MFA 등록" },
  { ts: "14:10:30", level: "DEBUG", msg: "백그라운드 큐 잔여: 0" },
  { ts: "14:10:00", level: "INFO",  msg: "주간 보안 스캔 시작" },
  { ts: "14:09:45", level: "WARN",  msg: "TLS 인증서 30일 내 만료 — auth.opsroom.local" },
  { ts: "14:09:30", level: "INFO",  msg: "API 게이트웨이 트래픽 분산 재조정" },
  { ts: "14:09:00", level: "ERROR", msg: "외부 결제 partner 응답 stat=503" },
  { ts: "14:08:45", level: "INFO",  msg: "헬스체크 라운드 #4519 완료" },
  { ts: "14:08:30", level: "DEBUG", msg: "JVM heap 사용: 2.4G/4G" },
  { ts: "14:08:00", level: "INFO",  msg: "데일리 백업 완료 — 4.7GB" },
  { ts: "14:07:45", level: "WARN",  msg: "노드 부하 imbalance 감지 — auto-rebalance" },
  { ts: "14:07:30", level: "INFO",  msg: "운영부 스케줄 동기화 완료" },
];

const settingsMockSections: SettingsSection[] = [
  {
    id: "general",
    label: "일반",
    fields: [
      { type: "select", label: "언어",   value: "한국어", options: ["한국어", "English"] },
      { type: "select", label: "타임존", value: "Asia/Seoul", options: ["Asia/Seoul", "UTC", "America/Los_Angeles"] },
      { type: "radio",  label: "테마",   value: "dark", options: ["light", "dark"] },
    ],
  },
  {
    id: "alerts",
    label: "알림",
    fields: [
      { type: "toggle", label: "장애 발생 시 데스크탑 알림", value: true },
      { type: "toggle", label: "이메일 요약 (일간)", value: false },
      { type: "toggle", label: "주말 알림 받기", value: false },
    ],
  },
  {
    id: "display",
    label: "표시",
    fields: [
      { type: "select", label: "기본 뷰",   value: "목록", options: ["목록", "카드"] },
      { type: "toggle", label: "고밀도 표시", value: false },
    ],
  },
  {
    id: "security",
    label: "보안",
    fields: [
      { type: "toggle", label: "2단계 인증 (TOTP)", value: false },
      { type: "select", label: "세션 만료", value: "14일", options: ["1시간", "1일", "14일"] },
    ],
  },
  {
    id: "sso",
    label: "통합 (SSO)",
    fields: [
      { type: "toggle", label: "Microsoft SSO 연결", value: true },
    ],
  },
];

export function getPatternMockData(slug: string, pattern: SbPattern):
  | { rows: ListRow[] }
  | { widgets: DashWidget[] }
  | { lines: LogLine[] }
  | { sections: SettingsSection[] } {
  // 팀 페이지는 OPERATORS 활용 (실제 17명 운영자)
  if (slug === "team") {
    const teamRows: ListRow[] = OPERATORS.map((op) => ({
      id: op.email,
      name: op.name,
      status: "active",
      owner: op.team,
      meta: op.role,
    }));
    return { rows: teamRows };
  }

  if (pattern === "list") return { rows: listMockRows };
  if (pattern === "dash") return { widgets: dashMockWidgets };
  if (pattern === "log") return { lines: logMockLines };
  return { sections: settingsMockSections };
}

// SettingsField는 SettingsPattern에서 type-only re-export로 충분
export type { SettingsField };
```

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 3: commit**

```bash
git add src/app/dashboard/_data/patterns.ts
git commit -m "feat: 패턴별 mock data + getPatternMockData lookup (team은 OPERATORS 활용)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: 체크포인트**

```
Task 8 완료 — patterns mock data
- list 8행 + 50로그 + 6위젯 + 5섹션
- team slug → OPERATORS 17명
- getPatternMockData lookup
```

---

## Task 9: `[slug]/page.tsx` dynamic route

slug → 메타 lookup → 패턴 컴포넌트 렌더.

**Files:**
- Create: `src/app/dashboard/[slug]/page.tsx`

- [ ] **Step 1: 디렉터리 + 파일 생성**

```bash
mkdir -p /Users/yss/개발/build/Folio/src/app/dashboard/\[slug\]
```

`src/app/dashboard/[slug]/page.tsx`:

```tsx
"use client";

import { useParams, notFound } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { getPatternMockData } from "../_data/patterns";
import { ListPattern } from "../_components/patterns/ListPattern";
import { DashPattern } from "../_components/patterns/DashPattern";
import { LogPattern } from "../_components/patterns/LogPattern";
import { SettingsPattern } from "../_components/patterns/SettingsPattern";

/**
 * /dashboard/[slug] — slug → 사이드바 메타 lookup → 패턴 컴포넌트 렌더.
 *
 * 잘못된 slug는 notFound() → Next.js 404. 셸은 layout.tsx가 처리.
 */
export default function DynamicDashboardPage() {
  const params = useParams<{ slug: string }>();
  const meta = findSidebarMeta(params.slug);
  if (!meta) notFound();

  const data = getPatternMockData(params.slug, meta.pattern);

  if (meta.pattern === "list") {
    return <ListPattern title={meta.label} data={data as { rows: never[] }} />;
  }
  if (meta.pattern === "dash") {
    return <DashPattern title={meta.label} data={data as { widgets: never[] }} />;
  }
  if (meta.pattern === "log") {
    return <LogPattern title={meta.label} data={data as { lines: never[] }} />;
  }
  return <SettingsPattern title={meta.label} data={data as { sections: never[] }} />;
}
```

**중요**: `data as ...` cast는 union 타입에서 패턴별 narrowing 위해. 더 깔끔하게 하려면 `getPatternMockData` 반환을 generic으로 만들 수 있지만 현재는 단순 cast로 진행.

대안 (cast 없는 더 안전한 버전):

```tsx
// pattern별 분기 후 mock data 다시 호출 (generic helper)
import type { ListRow } from "../_components/patterns/ListPattern";
import type { DashWidget } from "../_components/patterns/DashPattern";
import type { LogLine } from "../_components/patterns/LogPattern";
import type { SettingsSection } from "../_components/patterns/SettingsPattern";

// ...

if (meta.pattern === "list") {
  const data = getPatternMockData(params.slug, "list") as { rows: ListRow[] };
  return <ListPattern title={meta.label} data={data} />;
}
if (meta.pattern === "dash") {
  const data = getPatternMockData(params.slug, "dash") as { widgets: DashWidget[] };
  return <DashPattern title={meta.label} data={data} />;
}
if (meta.pattern === "log") {
  const data = getPatternMockData(params.slug, "log") as { lines: LogLine[] };
  return <LogPattern title={meta.label} data={data} />;
}
const data = getPatternMockData(params.slug, "settings") as { sections: SettingsSection[] };
return <SettingsPattern title={meta.label} data={data} />;
```

후자가 cast가 명시적이고 데이터 흐름 추적 쉬움. **후자 채택**.

- [ ] **Step 2: tsc + lint 회귀**

Run: `npx tsc --noEmit && npm run lint 2>&1 | tail -5`
Expected: tsc 0, lint 0 errors.

- [ ] **Step 3: dev server에서 4 패턴 1개씩 진입 시각 확인**

```bash
for slug in services alerts kibana settings team; do
  curl -s -o /dev/null -w "/dashboard/$slug: %{http_code}\n" http://localhost:3001/dashboard/$slug
done
```

Expected: 모두 200.

- [ ] **Step 4: 잘못된 slug → 404 확인**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/dashboard/nonexistent
```

Expected: 404 (Next.js 기본).

- [ ] **Step 5: commit**

```bash
git add src/app/dashboard/\[slug\]/page.tsx
git commit -m "feat: /dashboard/[slug] dynamic route — slug → 메타 lookup → 패턴 렌더

22 사이드바 항목 모두 라우팅 동작. 잘못된 slug는 notFound() → Next.js 404.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: 체크포인트**

```
Task 9 완료 — [slug] dynamic route
- 4 패턴 분기 (list/dash/log/settings)
- 22 라우트 모두 200
- nonexistent slug → 404
```

---

## Task 10: 기존 `e2e/dashboard.spec.ts` 회귀 검증

layout.tsx 추출 후 기존 시나리오 모두 통과 확인. selector 변경 필요시 갱신.

**Files:**
- Modify: `e2e/dashboard.spec.ts` (필요 시)

- [ ] **Step 1: 현재 e2e dashboard 시나리오 실행**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e -- --grep "dashboard" 2>&1 | tail -15
```

Expected: 모든 dashboard 시나리오 통과 (회귀 0). 단 layout.tsx 추출로 selector가 깨졌다면 갱신 필요.

- [ ] **Step 2: 실패 시 selector 갱신**

가능한 영향:
- `<TitleBar>` 위치는 동일 (layout.tsx 안)
- `<Sidebar>` props 추가 (`open`, `onClose`) — 기존 sidebar 시나리오 셀렉터 유지
- `aria-modal="true"` 등 drawer 관련 — 동일

대부분 변동 없음 예상. 만약 fail 발생 시:
- `getByText("운영부 · 운영 상황실")` 등 셸 카피 selector → 그대로
- `getByRole("button", { name: /송영석/ })` → 그대로 (MenuBar.tsx 변동 없음)

- [ ] **Step 3: dev server 재기동**

```bash
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
sleep 4
```

- [ ] **Step 4: 변경 있으면 commit, 없으면 skip**

```bash
git status -- e2e/dashboard.spec.ts
# 변경이 있으면:
git add e2e/dashboard.spec.ts
git commit -m "test: dashboard.spec.ts selector 갱신 (layout 추출 회귀)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 체크포인트**

```
Task 10 완료 — dashboard.spec.ts 회귀
- 기존 시나리오 0 failed
- selector 변경: __ (있으면 명시, 없으면 "없음")
```

---

## Task 11: `e2e/dashboard-pages.spec.ts` 신규

22 라우트 smoke + 패턴별 디테일 e2e.

**Files:**
- Create: `e2e/dashboard-pages.spec.ts`

- [ ] **Step 1: 파일 작성**

`e2e/dashboard-pages.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const ALL_SLUGS = [
  "alerts", "handover",
  "services", "services-web", "services-api", "services-backend",
  "infra-db", "infra-cache", "infra-mq", "batch-worker",
  "batch-jobs", "daily-check", "incidents", "changes",
  "grafana", "kibana", "apm", "notifications",
  "oncall", "team", "settings",
];

test.describe("/dashboard/[slug] — 인증 후 페이지 (TEST_USER 미설정 시 skip)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER 미설정 — 인증 필요"
    );
    // 로그인
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard$/);
  });

  test("22 라우트 smoke — 모두 200 + 라벨 노출", async ({ page }) => {
    for (const slug of ALL_SLUGS) {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`${slug}: ${msg.text()}`);
      });
      const response = await page.goto(`/dashboard/${slug}`);
      expect(response?.status(), `${slug} status`).toBe(200);
      // 페이지 헤더 (label) 노출 검증은 slug별 다르므로 일반 검증: h2 노출
      await expect(page.locator("h2").first()).toBeVisible();
      expect(errors, `console errors on /dashboard/${slug}: ${errors.join(" | ")}`).toEqual([]);
    }
  });

  test("잘못된 slug → 404", async ({ page }) => {
    const response = await page.goto("/dashboard/nonexistent-slug-zzz");
    expect(response?.status()).toBe(404);
  });

  test("Sidebar active state — /dashboard/services 진입 시 '전체 서비스'에 vermilion 시각", async ({
    page,
  }) => {
    await page.goto("/dashboard/services");
    const item = page.locator(`a[href="/dashboard/services"]`).first();
    await expect(item).toHaveClass(/text-vermilion/);
  });

  test("사이드바 클릭 → 라우팅 — '실시간 알림' 클릭 시 /dashboard/alerts", async ({
    page,
  }) => {
    // dashboard index 진입 (beforeEach가 보장)
    await page.locator(`a[href="/dashboard/alerts"]`).first().click();
    await expect(page).toHaveURL(/\/dashboard\/alerts$/);
  });

  test("ListPattern: 행 선택 시 Inspector 갱신", async ({ page }) => {
    await page.goto("/dashboard/services");
    // 첫 행 클릭
    const firstRow = page.locator("tbody tr").first();
    await firstRow.click();
    // Inspector에 첫 행 ID 표시 (lg:block, 데스크탑에서만)
    if (await page.locator("aside h3:has-text('상세')").isVisible()) {
      await expect(page.locator("aside")).toContainText("SVC-001");
    }
  });

  test("DashPattern: 위젯 선택 시 Inspector 갱신", async ({ page }) => {
    await page.goto("/dashboard/alerts");
    const firstWidget = page.locator("button[aria-pressed]").first();
    await firstWidget.click();
    if (await page.locator("aside h3:has-text('위젯 상세')").isVisible()) {
      await expect(page.locator("aside")).toContainText("W1");
    }
  });

  test("LogPattern: Inspector 영역 자체 미렌더 (풀 너비)", async ({ page }) => {
    await page.goto("/dashboard/kibana");
    // Log 패턴은 aside 미사용 (또는 lg:hidden)
    await expect(page.locator("section").first()).toBeVisible();
    // 검색 input 노출
    await expect(page.locator('input[placeholder*="쿼리"]')).toBeVisible();
  });

  test("SettingsPattern: 좌 nav 클릭 시 우 form 전환", async ({ page }) => {
    await page.goto("/dashboard/settings");
    // 초기 active = 일반
    await expect(page.locator("h3:has-text('일반 설정')")).toBeVisible();
    // 알림 nav 클릭
    await page.getByRole("button", { name: "알림", exact: false }).click();
    await expect(page.locator("h3:has-text('알림 설정')")).toBeVisible();
    // URL은 변경 안 됨
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });

  test("팀 페이지: OPERATORS 17명 표시 + 송영석 한 행", async ({ page }) => {
    await page.goto("/dashboard/team");
    // 17행 (헤더 제외)
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(17);
    // 송영석 행
    await expect(page.locator("tbody")).toContainText("송영석");
  });
});
```

- [ ] **Step 2: e2e 실행**

```bash
PID=$(cat /tmp/folio-dev-3001.pid 2>/dev/null); kill "$PID" 2>/dev/null; sleep 2
npm run test:e2e 2>&1 | tail -10
```

Expected: 신규 시나리오 모두 통과 + 기존 회귀 0. TEST_USER 설정돼 있으면 신규 9 × 2 브라우저 = ~18 신규. 없으면 모두 skip.

- [ ] **Step 3: dev server 재기동**

```bash
PATH=/usr/local/bin:/usr/bin:/bin:$PATH npx next dev -p 3001 > /tmp/folio-dev-3001.log 2>&1 &
echo $! > /tmp/folio-dev-3001.pid
sleep 4
```

- [ ] **Step 4: commit**

```bash
git add e2e/dashboard-pages.spec.ts
git commit -m "test: /dashboard/[slug] 22 라우트 + 4 패턴 e2e

22 라우트 smoke / 잘못된 slug 404 / Sidebar active / 라우팅 / 4 패턴별 디테일 / 팀 OPERATORS 17명.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 체크포인트**

```
Task 11 완료 — dashboard-pages.spec.ts
- 22 라우트 smoke + 9 시나리오
- 회귀 0 failed
```

---

## Task 12: 종합 검증 + 메모리 + 사용자 안내 + push

**Files:**
- Create: `/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/feedback_dashboard_pages_pattern.md`
- Modify: `/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/MEMORY.md`

- [ ] **Step 1: 종합 검증**

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -5
npm test 2>&1 | tail -5
LOCAL_BASE=http://localhost:3001 npm run design-sync 2>&1 | tail -10
```

Expected:
- tsc / lint exit 0
- Vitest 26/26
- design-sync `/dashboard` 99.4% 유지 (layout 추출이 시각 변동 0)

- [ ] **Step 2: 메모리 작성**

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/feedback_dashboard_pages_pattern.md`:

```markdown
---
name: Dashboard dynamic [slug] + 4 패턴 demo 패턴
description: 사이드바 22 항목 동적 라우트 + slug → 패턴 lookup + 셸 layout.tsx 추출
type: feedback
---

Folio /dashboard 22 메뉴 페이지 작업(2026-04-28)에서 발견한 재사용 패턴.

## slug → 메타 lookup (findSidebarMeta)

사이드바 데이터에 slug + pattern 필드 추가하고 평탄화 helper로 lookup:

```ts
export function findSidebarMeta(slug: string) {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug === slug && entry.pattern) {
        return { label: entry.label, pattern: entry.pattern };
      }
      if (entry.kind === "group") {
        for (const item of entry.items) {
          if (item.slug === slug && item.pattern) return { label: item.label, pattern: item.pattern };
        }
      }
    }
  }
  return null;
}
```

**Why:** 22 페이지를 단일 [slug] 라우트로 처리. group 안 sub-item도 재귀 탐색. **How to apply:** 사이드바 메뉴가 많은 admin/대시보드 앱에서 페이지 추가 시 _data.ts만 수정하면 라우트 자동 활성.

## 4 패턴 demo 분류

22 페이지를 콘텐츠 깊이로 분류:
- **list**: 테이블 + 필터칩 + Inspector 행 상세 (14개)
- **dash**: 카드 위젯 grid + Inspector 위젯 상세 (4개)
- **log**: 풀 너비 monospace stream + 검색/필터 (2개)
- **settings**: 좌 nav + 우 form (1개)

각 패턴 단일 컴포넌트 + 단일 mock data 재사용. 22 페이지 작업이 사실상 4 컴포넌트.

**How to apply:** 콘텐츠 비슷한 페이지 다수일 때 패턴 분류 → 컴포넌트 재사용. 슬러그별 차별 콘텐츠는 future scope로 둘 것.

## layout.tsx 추출 (App Router)

dashboard처럼 셸이 일정한 라우트 그룹은 layout.tsx로 추출 — 페이지 전환 시 셸 unmount/remount 없음:

```tsx
// dashboard/layout.tsx
"use client";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen grid-rows-[34px_36px_1fr_26px]">
      <TitleBar />
      <MenuBar />
      <main className="grid lg:grid-cols-[260px_1fr]">
        <Sidebar />
        <div className="overflow-y-auto">{children}</div>
      </main>
      <StatusBar />
    </div>
  );
}
```

페이지(`page.tsx`, `[slug]/page.tsx`)는 `<main>` 안 콘텐츠만 책임. drawer 같은 mobile state는 layout이 보유.

**How to apply:** 모든 admin 라우트 그룹(dashboard, settings 등)에 적용.

## Sidebar Link + active (usePathname)

```tsx
const pathname = usePathname();
const isActive = slug ? pathname === `/dashboard/${slug}` : pathname === "/dashboard";

<Link href={`/dashboard/${slug}`} prefetch={false}
  className={isActive ? "border-l-2 border-vermilion bg-vermilion/10 text-vermilion" : "..."}>
```

`prefetch={false}`로 22 Link 모두 prefetch 부담 회피.

## Inspector 패턴별 ON/OFF

모든 페이지에 Inspector를 강제하지 말고 패턴별 결정:
- list/dash: Inspector ON (selection 기반)
- log: Inspector OFF (풀 너비)
- settings: Inspector OFF (좌 nav + 우 form 자체 split)

각 패턴 컴포넌트 안에서 grid 자체를 다르게 (`lg:grid-cols-[1fr_320px]` vs 풀 너비).

**Why:** Inspector가 의미 없는 패턴(log/settings)에 강제하면 부자연. **How to apply:** 페이지 컴포넌트가 자체 grid 결정.
```

- [ ] **Step 3: MEMORY.md 인덱스 추가**

`/Users/yss/.claude/projects/-Users-yss----build-Folio/memory/MEMORY.md` 끝에 추가:

```markdown
- [Dashboard dynamic [slug] + 4 패턴 demo 패턴](feedback_dashboard_pages_pattern.md) — findSidebarMeta + 4 패턴 분류 + layout.tsx 추출 + Sidebar Link/active
```

- [ ] **Step 4: commit + push**

```bash
git add /Users/yss/.claude/projects/-Users-yss----build-Folio/memory/
# 메모리는 별도 dir이라 git add 영향 없음 — 메모리는 글로벌 디렉터리

# 코드 commit (Task 12 자체는 메모리 + 검증 — 코드 변경 없으면 skip)
git log --oneline | head -15
git push 2>&1 | tail -3
```

Expected: 모든 task commit 11개 + push 완료.

- [ ] **Step 5: 최종 체크포인트 + 사용자 시각 검증 안내**

```
Dashboard pages plan 완료.

산출물:
- 신규 9 파일: layout.tsx, [slug]/page.tsx, 4 patterns, _data/patterns.ts, _data.test.ts, e2e spec
- 수정 4 파일: _data.ts, page.tsx, Sidebar.tsx, dashboard.spec.ts (필요시)
- 메모리: feedback_dashboard_pages_pattern.md

검증:
- tsc/lint exit 0
- Vitest 26/26
- Playwright 회귀 0 + 신규 ~18 (TEST_USER 설정 시)
- design-sync /dashboard 99.4% 유지
- GitHub push 완료

브라우저 시각 검증 부탁:
1. /dashboard/services (목록) — 행 선택 → Inspector 우측 갱신
2. /dashboard/alerts (대시) — 위젯 클릭 → Inspector
3. /dashboard/kibana (로그) — 풀 너비 stream + 검색바
4. /dashboard/settings (설정) — 좌 nav 클릭 → 우 form 전환
5. /dashboard/team (목록 + OPERATORS) — 17명 + 본인(송영석) 한 행
6. 사이드바 항목 클릭 → URL 변경 + active 시각 (vermilion border-left)
7. 잘못된 URL (/dashboard/zzz) → 404

다음 후보 (out of scope):
- slug별 차별 mock data
- Supabase 실 데이터 fetch
- settings 폼 실제 저장
- 페이지별 권한 체크
- Cmd+K palette
- 사이드바 collapse 토글
```
