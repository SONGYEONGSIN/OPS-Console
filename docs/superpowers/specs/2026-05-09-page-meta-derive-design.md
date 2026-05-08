# Design — 47 페이지 PageHeader 메타 자동 derive (Epic 5)

- **Date**: 2026-05-09
- **Owner**: 송영석
- **Topic**: page-meta-config에 명시되지 않은 ~42개 slug에 대해 sidebar 데이터 + 패턴별 기본값으로 PageHeader 메타 자동 생성
- **Source**: 사용자 직접 피드백 (mockup services 페이지 형식을 모든 메뉴에 적용)
- **Status**: Awaiting user review
- **Predecessor**: Epic 2 (Page Header Pattern) 완료, page-meta-config.ts에 5개 명시

## 1. Goal

47 메뉴 페이지 모두 `accent — title` + 메타 + description이 의미있게 표시되도록, 명시되지 않은 slug에 대해 sidebar 데이터(부모 그룹 라벨 + sidebar count + 패턴 종류)에서 자동 derive. 사용자가 dev에서 보고 어색한 페이지만 후속 수정.

## 2. Out of Scope

- mockup 수준의 specific 메타 (예: "근무 II · 자동 새로고침 10초") — 페이지 본체 데이터 기반이므로 별도. 5개 명시된 페이지는 그대로 유지
- description의 한국어 다국어 지원 — 현재 ko-KR 단독
- meta의 동적 값 (서비스 수의 실시간 갱신 등) — sidebar의 정적 count 사용
- `dashboard/page.tsx` 1면 신문 — 영향 없음

## 3. Architecture

### 3.1 derive 로직

`src/app/dashboard/_data/page-meta-derive.ts` (신규):

```typescript
import type { PageMetaConfig } from "./page-meta-config";
import type { MetaItem } from "../_components/page-header/PageMeta";
import type { SbItem, SbPattern } from "./_data";  // re-export 필요
import { findSidebarBreadcrumb } from "./sidebar-helpers";

export function derivePageMeta(slug: string, sidebarMeta: SbItem): PageMetaConfig {
  const breadcrumb = findSidebarBreadcrumb(`/dashboard/${slug}`);
  const accent = breadcrumb.length >= 2
    ? breadcrumb[breadcrumb.length - 2].label
    : undefined;
  const title = sidebarMeta.label;
  const meta = derivePatternMeta(sidebarMeta.pattern, sidebarMeta.count);
  const description = derivePatternDescription(sidebarMeta.pattern, title);
  return { headline: { accent, title }, meta, description };
}

function derivePatternMeta(pattern: SbPattern | undefined, count: string | undefined): MetaItem[] {
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

function derivePatternDescription(pattern: SbPattern | undefined, title: string): string {
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

### 3.2 [slug]/page.tsx 통합

```typescript
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";

// ...
const config = PAGE_META[params.slug] ?? derivePageMeta(params.slug, meta);
```

기존 fallback `{ headline: { title: meta.label } }` → `derivePageMeta(...)`.

### 3.3 SbPattern 재노출

`page-meta-derive.ts`가 `SbPattern` import해야 하므로 `_data.ts`에서 re-export 확인. 이미 `export type SbPattern = "list" | "dash" | "log" | "settings" | "project"`로 export됨 (확인 후 그대로 사용).

## 4. 영향 파일 (3)

### 신규
- `src/app/dashboard/_data/page-meta-derive.ts`
- `src/app/dashboard/_data/__tests__/page-meta-derive.test.ts`

### 변경
- `src/app/dashboard/[slug]/page.tsx` — fallback 한 줄을 `derivePageMeta` 호출로 교체

**HARD-GATE 등급**: 인라인 설계 (3 파일).

## 5. 데이터 흐름

```
PAGE_META[slug]?
  ├─ YES → 명시된 config 사용 (5개)
  └─ NO  → derivePageMeta(slug, sidebarMeta)
            ├─ findSidebarBreadcrumb → 부모 그룹 추출 (accent)
            ├─ pattern + count → meta 기본값
            └─ pattern + title → description 기본값
```

## 6. 에러 처리

- `findSidebarBreadcrumb` 매칭 실패 → breadcrumb 빈 배열 → accent undefined → headline은 title만 (대시 X)
- `count` 없음 (예: 일부 list slug) → meta 빈 배열
- `pattern` 없음 → 모든 default case → meta 빈, description = `${title}.`

## 7. 테스트 전략 (TDD)

### 단위 (vitest)

`page-meta-derive.test.ts`:
1. **list 패턴 + count 있음** — accent=부모, meta=`[{전체, N건}]`, description=`{title} 목록입니다. 항목 선택...`
2. **dash 패턴 + count 있음** — meta=`[{위젯, N개}]`, description=`{title} 위젯을 시간순...`
3. **project 패턴** — meta=`[{운영, accent}]`, description=`{title} 프로젝트 진행 정보.`
4. **log 패턴** — meta=`[{로그, stream}]`
5. **settings 패턴** — meta=`[]`
6. **section 직속 item (group 없음)** — accent=section title (예: "개요")
7. **count 없음** — meta=`[]`

### 회귀
- 기존 `page-meta-config.test.ts` 그대로 (5개 명시 검증)
- e2e `services` (PAGE_META 명시) + sample 1개 추가 (자동 derive로 헤드라인 노출 검증, 예: `/dashboard/contacts`)

## 8. 검증 (DoD)

1. `npm run lint` 0 errors
2. `npx tsc --noEmit` 0 errors
3. `npm test` 303 + 신규 7 (≈ 310) 통과
4. dev 서버 sample 메뉴들 진입:
   - `/dashboard/contacts` (list, count=87) → "고객 응대 — 대학 연락처" + "전체 87건" + description
   - `/dashboard/contracts` (list, count=14) → "서비스사이클 — 계약" + "전체 14건"
   - `/dashboard/grafana` (settings) → "관측·로그 — Grafana 지표" + 빈 메타 + 설정 description
   - 기존 명시 5개는 PAGE_META 그대로 (services 등)
5. 어색한 페이지 식별 → 사용자 후속 수정 가능 (PAGE_META에 추가 명시)

## 9. 리스크

- **derive 결과가 mockup만큼 specific 못 함**: 자동은 generic. mockup의 services 메타("근무 II · 서비스 12개 · 자동 새로고침 10초")는 별도 명시 (이미 PAGE_META에 있음). 어색한 페이지는 후속 PAGE_META 추가로 처리.
- **section title vs group label**: 사이드바 트리 깊이에 따라 accent가 다름 (section 직속 = "개요", group 안 = "고객 응대"). 둘 다 자연스러운 한국어인지 사용자 확인 필요.
- **description 한국어 자연스러움**: 5개 패턴 default가 모두 의미 통하는지 dev에서 확인.

## 10. 후속 작업 (out of this epic)

- 어색한 페이지 사용자 직접 수정 (PAGE_META 추가)
- pattern 없는 slug ("실시간 현황" 같은 dashboard 인덱스 멤버)는 derive 안 됨 — 이미 [slug] 라우트가 아니라 영향 없음
