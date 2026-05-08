# Design — Page Header Pattern (Epic 2)

- **Date**: 2026-05-08
- **Owner**: 송영석
- **Topic**: 모든 메뉴 페이지(`dashboard/[slug]/*`) 콘텐츠 상단에 일관된 헤더 패턴(Breadcrumb + Tabs + Meta + Headline + Description) 적용
- **Source**: 사용자 직접 피드백 (mockup 이미지 7번 참조)
- **Status**: Awaiting user review
- **Predecessor**: chrome 영역은 별도 (T1~T12 PIVOT + OPS Console rebrand 완료)

## 1. Goal

mockup `folio-dashboard.html`의 콘텐츠 영역 상단 4단 구조(breadcrumb · tabs · meta · headline+description)를 47 메뉴 페이지에 일관 적용. 사이드바 트리에서 자동 derive되는 navigation 영역(breadcrumb/tabs)과 페이지가 명시하는 정보 영역(meta/headline/description)을 명확히 분리.

## 2. Out of Scope

- `dashboard/page.tsx` 인덱스 페이지의 1면 신문 메타포(Masthead/Lede) — 그대로 유지
- 모바일 헤더 — 데스크탑(≥md)만 적용
- 탭 닫기/추가/사용자 임의 조작 — 사이드바 형제로 정적 derive
- 페이지 우측 인스펙터 슬라이드인 — 별도 epic (Epic 3)
- 콘텐츠 본체(패턴 컴포넌트들의 내부 레이아웃) — 그대로 유지

## 3. Architecture

### 3.1 컴포넌트 트리

```
PageHeader (server, container)
├── Breadcrumb (server)         ← findSidebarBreadcrumb(pathname)
├── PageTabs (server)           ← findSidebarSiblings(pathname)
├── PageMeta (server)           ← items prop from page.tsx
└── PageHeadline (server)       ← title/description prop from page.tsx
```

PageHeader는 server component, props로 페이지가 meta/headline/description 전달. Breadcrumb과 PageTabs는 내부에서 사이드바 트리를 자동 derive.

### 3.2 사이드바 helpers (신규)

`src/app/dashboard/_data/sidebar-helpers.ts`:

```typescript
import { sidebarSections, type SidebarItem } from "./index";

export type BreadcrumbCrumb = { label: string; href?: string };

/**
 * 현재 pathname에 대한 breadcrumb 경로 (root → leaf 순).
 * 예: "/dashboard/all-services" → [{label: "개요"}, {label: "서비스 그룹"}, {label: "전체 서비스"}]
 */
export function findSidebarBreadcrumb(pathname: string): BreadcrumbCrumb[] {
  // sidebarSections 트리를 BFS로 탐색하여 일치 항목까지 경로 수집
}

/**
 * 같은 그룹 안의 형제 메뉴 (현재 항목 포함).
 * 예: 서비스 그룹 진입 시 [전체 서비스, 웹·프론트, API 게이트웨이, 백엔드 서비스]
 */
export function findSidebarSiblings(pathname: string): SidebarItem[] {
  // 부모 그룹 식별 후 children 배열 반환
}
```

기존 `findSidebarMeta`(메타 lookup)와 동일 sidebar 데이터를 source로.

### 3.3 PageHeader 컴포넌트

```tsx
// src/app/dashboard/_components/page-header/PageHeader.tsx
import { headers } from "next/headers";
import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";
import { PageMeta, type MetaItem } from "./PageMeta";
import { PageHeadline } from "./PageHeadline";

type Props = {
  pathname: string;
  meta: MetaItem[];
  headline: { title: string; accent?: string };  // accent = "—" 앞 단어
  description?: string;
};

export function PageHeader({ pathname, meta, headline, description }: Props) {
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

`pathname` props로 받음 — server component에서 next/navigation의 useRouter 못 씀. page.tsx에서 매번 명시 (혹은 layout이 params에서 derive).

### 3.4 Breadcrumb

```tsx
// Breadcrumb.tsx
import Link from "next/link";
import { findSidebarBreadcrumb } from "../../_data/sidebar-helpers";

export function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = findSidebarBreadcrumb(pathname);
  return (
    <nav aria-label="경로" className="flex items-center gap-2 text-xs text-muted">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-ink">{crumb.label}</Link>
          ) : (
            <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""}>
              {crumb.label}
            </span>
          )}
          {i < crumbs.length - 1 && <span className="text-line-soft">/</span>}
        </span>
      ))}
    </nav>
  );
}
```

### 3.5 PageTabs

```tsx
// PageTabs.tsx
import Link from "next/link";
import { findSidebarSiblings } from "../../_data/sidebar-helpers";

export function PageTabs({ pathname }: { pathname: string }) {
  const siblings = findSidebarSiblings(pathname);
  if (siblings.length <= 1) return null;  // 단독 메뉴는 탭 X

  return (
    <nav role="tablist" aria-label="형제 메뉴" className="flex items-center gap-1 border-b-0">
      {siblings.map((item) => {
        const active = item.href === pathname;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={`relative px-3 py-1.5 text-sm transition-colors ${
              active
                ? "font-bold text-ink"
                : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
            {active && (
              <span aria-hidden className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

### 3.6 PageMeta

```tsx
// PageMeta.tsx
export type MetaItem = { label: string; value?: string; tone?: "default" | "accent" };

export function PageMeta({ items }: { items: MetaItem[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {item.tone === "accent" ? (
            <strong className="text-vermilion">{item.label}</strong>
          ) : (
            <span>
              {item.value !== undefined ? <strong className="text-ink">{item.label}</strong> : item.label}
              {item.value !== undefined && ` ${item.value}`}
            </span>
          )}
          {i < items.length - 1 && <span aria-hidden className="text-line-soft">·</span>}
        </span>
      ))}
    </div>
  );
}
```

예시 사용 (page.tsx):
```tsx
<PageHeader
  pathname="/dashboard/all-services"
  meta={[
    { label: "근무 II", tone: "accent" },
    { label: "2026-04-24" },
    { label: "서비스", value: "12개" },
    { label: "자동 새로고침", value: "10초" },
  ]}
  headline={{ accent: "실시간", title: "서비스 운영" }}
  description="현재 운영 중인 서비스 목록입니다. 각 서비스의 상태·담당 팀·최근 이벤트를 확인하고, 선택 시 인스펙터에서 실시간 지표를 볼 수 있습니다. 주의 상태는 주홍색 낙관으로 표시됩니다."
/>
```

### 3.7 PageHeadline

```tsx
// PageHeadline.tsx
export function PageHeadline({
  title, accent, description,
}: { title: string; accent?: string; description?: string }) {
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

vermilion `—` 대시는 mockup 핵심 시각 요소.

## 4. 데이터 흐름

```
사이드바 sections (단일 source)
        │
        ├── findSidebarMeta(pathname)        ← 기존
        ├── findSidebarBreadcrumb(pathname)  ← 신규
        └── findSidebarSiblings(pathname)    ← 신규
                │
                ▼
        Breadcrumb / PageTabs (자동 derive)
                +
        page.tsx 명시 (meta, headline, description)
                ▼
            <PageHeader>
                ▼
            <패턴 컴포넌트>
                ▼
            본문
```

## 5. 적용 범위 (47 메뉴 페이지)

- `src/app/dashboard/[slug]/page.tsx` — PageHeader 호출 + 메타/헤드라인 props
- 패턴 컴포넌트들(`DashPattern`, `ListPattern`, `ProjectPattern`, `LogPattern`, `SettingsPattern`) — 자체적으로 헤더 영역이 있으면 PageHeader로 통일/위임

**중요 제약**: `dashboard/page.tsx` 인덱스(1면 신문)는 미적용. PageHeader 호출 안 함.

## 6. 에러 처리

- `findSidebarBreadcrumb` 매칭 실패 → 빈 배열 반환 → Breadcrumb 미렌더 (404 페이지에서 자연스러운 fallback)
- `findSidebarSiblings` 1개 이하 → null 반환 → 탭 영역 미노출
- meta/headline 누락 → page.tsx에서 명시 안 하면 컴파일 에러 (props required)

## 7. 테스트 전략 (TDD)

### 단위 (vitest)
- `sidebar-helpers.test.ts`:
  - `findSidebarBreadcrumb` — sample 라우트 5개로 경로 정확성
  - `findSidebarSiblings` — 그룹 내 형제 정확성
  - 매칭 실패 케이스 (404 라우트 등)
- `Breadcrumb.test.tsx` — crumb 렌더 + 마지막 항목 굵게 + Link href 정확
- `PageTabs.test.tsx` — 활성 탭 aria-selected + vermilion underline + 단독 시 null
- `PageMeta.test.tsx` — items 렌더 + accent tone + dot separator
- `PageHeadline.test.tsx` — accent + title + dash + description

### e2e (playwright)
- 47 라우트 중 sample 5개 (각 그룹 1개씩) 대상:
  - PageHeader 렌더 확인
  - 활성 탭 표시
  - 메타 정보 표시
  - breadcrumb 클릭 시 부모 라우트 이동

## 8. 영향 파일 (예상 8-12개)

### 신규
- `src/app/dashboard/_components/page-header/PageHeader.tsx`
- `src/app/dashboard/_components/page-header/Breadcrumb.tsx`
- `src/app/dashboard/_components/page-header/PageTabs.tsx`
- `src/app/dashboard/_components/page-header/PageMeta.tsx`
- `src/app/dashboard/_components/page-header/PageHeadline.tsx`
- `src/app/dashboard/_components/page-header/__tests__/Breadcrumb.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/PageTabs.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/PageMeta.test.tsx`
- `src/app/dashboard/_components/page-header/__tests__/PageHeadline.test.tsx`
- `src/app/dashboard/_data/sidebar-helpers.ts`
- `src/app/dashboard/_data/__tests__/sidebar-helpers.test.ts`

### 변경
- `src/app/dashboard/[slug]/page.tsx` — PageHeader 호출 + 메타/헤드라인 props (slug별 lookup 필요)
- 패턴 컴포넌트들 — 기존 자체 헤더 부분이 있다면 PageHeader로 위임 (현재 단순 패턴이라 큰 변경은 없을 수도)
- `e2e/dashboard.spec.ts` — sample 라우트들의 PageHeader 어설션

**HARD-GATE 등급**: 간략 설계 (8-12 파일).

## 9. 리스크

- **47 페이지 메타 채우기 부담**: 모든 slug가 의미 있는 메타/헤드라인을 갖고 있어야 함. mockup엔 한 페이지만 정의되어 있어 나머지는 제너릭하게 (예: meta=[date], headline={title: sidebar 이름})로 채울 가능성. T-shirt size: 페이지마다 30초 → 47×30s = 약 25분.
- **사이드바 트리 변경 시 helpers 재테스트**: helpers가 sidebar 데이터를 source로 하므로 sidebar 변경 시 자동 따라가지만 helpers 테스트는 fixture 갱신 필요.
- **첫 페이지 진입 메타 미정의 케이스**: page.tsx가 PageHeader 호출 누락 시 — TS required props로 컴파일 차단.
- **dashboard/[slug] 라우트의 page.tsx 단일 파일이 대규모 case**: 47 slug 전부의 메타/헤드라인을 한 파일에서 관리. 가독성 위해 별도 `page-meta-config.ts`로 분리할지 plan 단계에서 결정.

## 10. 검증 (DoD)

1. `npm run lint` 0 errors
2. `npx tsc --noEmit` 0 errors
3. `npm test` — sidebar-helpers 신규 + 4 컴포넌트 신규 단위 테스트 통과 + 245+ 회귀
4. `npm run e2e` sample 5 라우트 PageHeader 어설션 통과
5. dev 서버 — 47 라우트 진입 시 헤더 표시 + 활성 탭 정확
6. design-audit hook 0 위반
