# 47 페이지 PageHeader 메타 자동 derive Implementation Plan (Epic 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PAGE_META에 명시되지 않은 ~42 slug에 대해 sidebar 데이터 + 패턴별 기본값으로 PageHeader 메타 자동 derive.

**Architecture:** 신규 `page-meta-derive.ts`에 `derivePageMeta(slug, sidebarMeta)` 함수. `[slug]/page.tsx`의 fallback 한 줄을 derive 호출로 교체. sidebar-helpers의 findSidebarBreadcrumb 재사용.

**Tech Stack:** TypeScript, vitest, Next.js client component.

**Spec:** `docs/superpowers/specs/2026-05-09-page-meta-derive-design.md`

**HARD-GATE 등급:** 인라인 설계 (3 파일)

---

## File Structure

### Create
- `src/app/dashboard/_data/page-meta-derive.ts`
- `src/app/dashboard/_data/__tests__/page-meta-derive.test.ts`

### Modify
- `src/app/dashboard/[slug]/page.tsx` — fallback을 derive 호출로 교체

---

## Task 1: derivePageMeta 함수 (RED → GREEN)

**Files:**
- Create: `src/app/dashboard/_data/page-meta-derive.ts`
- Create: `src/app/dashboard/_data/__tests__/page-meta-derive.test.ts`

**Goal:** sidebar 데이터 + 패턴별 기본값으로 PageMetaConfig 생성.

- [ ] **Step 1: 실패 테스트**

`src/app/dashboard/_data/__tests__/page-meta-derive.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { derivePageMeta } from "../page-meta-derive";
import type { SbItem } from "../_data";

describe("derivePageMeta", () => {
  it("list 패턴 + count → 전체 N건 메타 + 목록 description", () => {
    const sidebarMeta: SbItem = {
      ico: "·",
      label: "대학 연락처",
      count: "87",
      slug: "contacts",
      pattern: "list",
    };
    const result = derivePageMeta("contacts", sidebarMeta);
    expect(result.headline.title).toBe("대학 연락처");
    expect(result.headline.accent).toBe("고객 응대");
    expect(result.meta).toEqual([{ label: "전체", value: "87건" }]);
    expect(result.description).toContain("대학 연락처 목록");
    expect(result.description).toContain("인스펙터");
  });

  it("dash 패턴 — 위젯 N개 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "✦",
      label: "새 알림",
      count: "3",
      slug: "alerts",
      pattern: "dash",
    };
    const result = derivePageMeta("alerts", sidebarMeta);
    expect(result.meta).toEqual([{ label: "위젯", value: "3개" }]);
    expect(result.description).toContain("위젯");
  });

  it("project 패턴 — 운영 accent meta", () => {
    const sidebarMeta: SbItem = {
      ico: "◇",
      label: "결제 시스템",
      slug: "payment",
      pattern: "project",
    };
    const result = derivePageMeta("payment", sidebarMeta);
    expect(result.meta).toEqual([{ label: "운영", tone: "accent" }]);
    expect(result.description).toContain("프로젝트");
  });

  it("log 패턴 — stream 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "≡",
      label: "Kibana 로그",
      slug: "kibana",
      pattern: "log",
    };
    const result = derivePageMeta("kibana", sidebarMeta);
    expect(result.meta).toEqual([{ label: "로그", value: "stream" }]);
    expect(result.description).toContain("로그 스트림");
  });

  it("settings 패턴 — 빈 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "📊",
      label: "Grafana 지표",
      slug: "grafana",
      pattern: "settings",
    };
    const result = derivePageMeta("grafana", sidebarMeta);
    expect(result.meta).toEqual([]);
    expect(result.description).toContain("설정");
  });

  it("section 직속 item — accent = section title", () => {
    // "/dashboard/handover"는 section "요청·자료" 직속 item (group 안 X)
    const sidebarMeta: SbItem = {
      ico: "◈",
      label: "인수인계",
      count: "2",
      slug: "handover",
      pattern: "list",
    };
    const result = derivePageMeta("handover", sidebarMeta);
    expect(result.headline.accent).toBe("요청 · 자료");
  });

  it("count 없음 — 빈 메타", () => {
    const sidebarMeta: SbItem = {
      ico: "▣",
      label: "자료 보관",
      slug: "vault",
      pattern: "list",
    };
    const result = derivePageMeta("vault", sidebarMeta);
    expect(result.meta).toEqual([]);
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_data/__tests__/page-meta-derive.test.ts
```

Expected: FAIL — Cannot find module './page-meta-derive'.

- [ ] **Step 3: 구현**

`src/app/dashboard/_data/page-meta-derive.ts`:

```typescript
import type { PageMetaConfig } from "./page-meta-config";
import type { MetaItem } from "../_components/page-header/PageMeta";
import type { SbItem, SbPattern } from "./_data";
import { findSidebarBreadcrumb } from "./sidebar-helpers";

/**
 * PAGE_META에 명시되지 않은 slug에 대해 sidebar 데이터 + 패턴별 기본값으로
 * PageMetaConfig 자동 생성.
 *
 * - accent: breadcrumb의 부모 컨테이너 (group label 또는 section title)
 * - title: sidebar label
 * - meta: 패턴별 기본 (list=N건, dash=N개, project=운영 accent, log=stream, settings=빈)
 * - description: 패턴별 generic 1줄
 */
export function derivePageMeta(slug: string, sidebarMeta: SbItem): PageMetaConfig {
  const breadcrumb = findSidebarBreadcrumb(`/dashboard/${slug}`);
  const accent =
    breadcrumb.length >= 2
      ? breadcrumb[breadcrumb.length - 2].label
      : undefined;
  const title = sidebarMeta.label;
  const meta = derivePatternMeta(sidebarMeta.pattern, sidebarMeta.count);
  const description = derivePatternDescription(sidebarMeta.pattern, title);
  return { headline: { accent, title }, meta, description };
}

function derivePatternMeta(
  pattern: SbPattern | undefined,
  count: string | undefined,
): MetaItem[] {
  switch (pattern) {
    case "list":
      return count ? [{ label: "전체", value: `${count}건` }] : [];
    case "dash":
      return count ? [{ label: "위젯", value: `${count}개` }] : [];
    case "project":
      return [{ label: "운영", tone: "accent" }];
    case "log":
      return [{ label: "로그", value: "stream" }];
    case "settings":
      return [];
    default:
      return [];
  }
}

function derivePatternDescription(
  pattern: SbPattern | undefined,
  title: string,
): string {
  switch (pattern) {
    case "list":
      return `${title} 목록입니다. 항목 선택 시 인스펙터에서 상세를 확인하고 편집할 수 있습니다.`;
    case "dash":
      return `${title} 위젯을 시간순으로 표시합니다.`;
    case "project":
      return `${title} 프로젝트 진행 정보.`;
    case "log":
      return `${title} 로그 스트림.`;
    case "settings":
      return `${title} 설정 패널.`;
    default:
      return `${title}.`;
  }
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_data/__tests__/page-meta-derive.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_data/page-meta-derive.ts src/app/dashboard/_data/__tests__/page-meta-derive.test.ts
git commit -m "feat: derivePageMeta — sidebar + 패턴별 기본 PageMeta 자동 생성"
```

---

## Task 2: [slug]/page.tsx에 derive 통합

**Files:**
- Modify: `src/app/dashboard/[slug]/page.tsx`

**Goal:** PAGE_META 매칭 안 되는 slug fallback을 `derivePageMeta` 호출로 교체.

- [ ] **Step 1: page.tsx의 fallback 라인 변경**

기존 `[slug]/page.tsx`의 다음 부분:

```tsx
const config = PAGE_META[params.slug] ?? {
  headline: { title: meta.label },
};
```

다음으로 교체:

```tsx
const config = PAGE_META[params.slug] ?? derivePageMeta(params.slug, meta);
```

import 추가 (파일 상단):

```tsx
import { derivePageMeta } from "../_data/page-meta-derive";
```

- [ ] **Step 2: 전체 vitest 회귀**

```bash
npm test
```

Expected: 모든 테스트 통과 (303 + 신규 7 ≈ 310).

- [ ] **Step 3: typecheck/lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: dev 서버 시각 확인 (선택)**

dev 서버 살아있다면 sample 메뉴 진입:
- `/dashboard/contacts` (list, count=87) → "고객 응대 — 대학 연락처" + "전체 87건" + 목록 description
- `/dashboard/contracts` (list, count=14) → "서비스사이클 — 계약" + "전체 14건"
- `/dashboard/grafana` (settings) → "관측 · 로그 — Grafana 지표" + 빈 메타 + 설정 description
- `/dashboard/services` (list, PAGE_META 명시) → "실시간 — 서비스 운영" (그대로)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/[slug]/page.tsx
git commit -m "feat: [slug] fallback을 derivePageMeta로 교체 — 47 페이지 자동 메타"
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
| 3.1 derive 로직 | T1 |
| 3.2 [slug] 통합 | T2 |
| 3.3 SbPattern 재노출 | T1 (이미 export됨, 재노출 불필요) |
| 4. 영향 파일 (3) | T1, T2 |
| 5. 데이터 흐름 | T1, T2 |
| 6. 에러 처리 (breadcrumb 빈, count 없음) | T1 (테스트 7번) |
| 7. 단위 테스트 (7개) | T1 |
| 8. DoD (lint/tsc/test/dev) | T2 |
| 9. 리스크 | doc only |

**누락 없음.**

**2. Placeholder scan**: 모든 step 코드/명령 명시. "TBD/추후" 없음.

**3. Type 일관성**:
- `PageMetaConfig` (page-meta-config.ts에 export됨), `MetaItem` (PageMeta.tsx에 export됨), `SbItem`/`SbPattern` (_data.ts에 export됨) — 모두 일관 import
- `derivePageMeta(slug: string, sidebarMeta: SbItem): PageMetaConfig` — T1과 T2 동일 시그니처
- `findSidebarBreadcrumb(pathname: string)` — Epic 2 T1에서 정의됨, 그대로 사용

**완료.**
