# Dashboard Pages Design (2026-04-28)

> Folio /dashboard 사이드바 22개 메뉴 항목별 콘텐츠 페이지 초안. 동적 [slug] 라우트 + 4 패턴 demo (목록/대시/로그/설정) + 사이드바 active state.

---

## 1. 배경 / 결정사항

### 배경
- 현재 `/dashboard`는 "실시간 현황" 단일 페이지. 사이드바의 22 항목 중 1개만 동작.
- 나머지 21 항목은 시각만 (클릭 시 무동작).
- 사용자 요청: 사이드바 메뉴별 페이지 + 라우팅 + active state + 디자인 규칙 준수.

### 결정사항

| # | 항목 | 결정 |
|---|------|------|
| 1 | 콘텐츠 깊이 | **패턴별 demo** — 4 패턴 분류 후 패턴 안에서는 동일 mock data 재사용 |
| 2 | 라우팅 | **동적 `/dashboard/[slug]`** 단일 파일 + slug → 메타 lookup |
| 3 | Inspector 표시 | 패턴별 ON/OFF — 목록/대시 ON, 로그/설정 OFF |
| 4 | 셸 추출 | `dashboard/layout.tsx`로 추출 (TitleBar + AppBar + Sidebar + StatusBar) |
| 5 | active state | `usePathname()` 매칭, slug 비교 |
| 6 | 데이터 | 정적 mock (`_data/patterns.ts`). `OPERATORS`는 "팀·권한" 페이지에서 client import. Supabase fetch는 out of scope |
| 7 | `/dashboard` (slug 없음) | 기존 "실시간 현황" 페이지 그대로 유지 |
| 8 | 디자인 톤 | mockup `folio-dashboard.html` 에디토리얼 톤 + `design-tokens.ts` 색상 |
| 9 | `/reset-password` 같은 임시 가드 패턴 — 적용 안 함 | dashboard 페이지는 일반 인증 user 모두 접근 가능. middleware 처리만 |

### 4 패턴 분류 (22 페이지 → 4 컴포넌트)

| 패턴 | Inspector | 페이지 | 특징 |
|------|-----------|--------|------|
| **list** (14) | ON | 전체 서비스, 웹·프론트, API 게이트웨이, 백엔드 서비스, DB·저장소, 캐시, 메시지 큐, 배치 워커, 배치 작업, 일일 점검, 장애 대응, 변경 관리, 온콜 일정, 팀·권한 | 테이블 + 필터칩 + 행 선택 → Inspector 상세 |
| **dash** (4) | ON | 실시간 알림, 인수인계, Grafana 지표, 알림 이력 | 카드 위젯 grid + 시간순 흐름 |
| **log** (2) | OFF | Kibana 로그, APM 트레이스 | 풀 너비 텍스트 stream + 검색/필터 |
| **settings** (1) | OFF | 환경설정 | 좌 nav + 우 form split |

총 21 dynamic + 1 index(`/dashboard`) = **22 라우트**.

---

## 2. 아키텍처

### 라우팅 구조

```
src/app/dashboard/
├── layout.tsx                     ← 신규 — 셸(TitleBar/MenuBar/Sidebar/StatusBar)
├── page.tsx                       ← 기존 "실시간 현황" 그대로
├── [slug]/
│   └── page.tsx                   ← 신규 — slug → 메타 lookup → 패턴 렌더
└── _components/
    ├── (기존) MenuBar, Sidebar, Content, Inspector
    └── patterns/
        ├── ListPattern.tsx
        ├── DashPattern.tsx
        ├── LogPattern.tsx
        └── SettingsPattern.tsx
```

### slug → 페이지 흐름

```
[사용자] 사이드바 항목 클릭
  → <Link href={`/dashboard/${slug}`} prefetch={false}>
  → /dashboard/[slug]/page.tsx 진입
  → useParams로 params.slug 추출
  → findSidebarMeta(slug) → { label, pattern } | null
  → null이면 notFound() (Next.js 404)
  → pattern 컴포넌트 렌더 (props: title=label, data=getPatternMockData(slug, pattern))
```

### 셸 layout.tsx 책임

- TitleBar / AppBar / Sidebar / StatusBar — 모든 dashboard 페이지 공통
- Sidebar는 layout 안에서 한 번만 마운트 → 페이지 전환 시 unmount/remount 없음
- `usePathname()`으로 active slug 추출 → Sidebar에 전달
- Inspector는 layout이 아닌 **페이지 안**에서 렌더 (패턴별 ON/OFF + selection 상태가 페이지 local)

### Sidebar 동작화

- 각 SbItem을 `<Link href={`/dashboard/${slug}`}>` 로 wrapping
- active 매칭: `pathname === '/dashboard/${slug}'` 또는 (`slug 미지정 항목` && `pathname === '/dashboard'`)
- active 시각: `bg-vermilion/10 text-vermilion border-l-2 border-vermilion`
- inactive: 기존 hover only

---

## 3. 컴포넌트 / 파일 구조

### 신규 파일 (8)

| 파일 | 역할 |
|------|------|
| `src/app/dashboard/layout.tsx` | 셸 추출 |
| `src/app/dashboard/[slug]/page.tsx` | slug → 메타 → 패턴 렌더 |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 테이블 + 필터칩 + Inspector |
| `src/app/dashboard/_components/patterns/DashPattern.tsx` | 카드 위젯 grid + Inspector |
| `src/app/dashboard/_components/patterns/LogPattern.tsx` | 풀 너비 로그 stream |
| `src/app/dashboard/_components/patterns/SettingsPattern.tsx` | 좌 nav + 우 form |
| `src/app/dashboard/_data/patterns.ts` | 패턴별 mock data |
| `e2e/dashboard-pages.spec.ts` | 22 라우트 + active + 패턴별 디테일 |

### 수정 파일 (5)

| 파일 | 변경 |
|------|------|
| `src/app/dashboard/_data.ts` | `SbItem`에 `slug?`, `pattern?` 필드 추가 + 22 항목 매핑 + `findSidebarMeta` helper |
| `src/app/dashboard/_components/Sidebar.tsx` | `<Link>` wrapping + active 시각 + `usePathname` |
| `src/app/dashboard/page.tsx` | 셸 부분 layout.tsx로 이동, Content + Inspector + selection만 남김 |
| `e2e/dashboard.spec.ts` | layout.tsx 추출 후 회귀 검증 (변경 최소) |

### 참조 (수정 없음)
`lib/design-tokens.ts`, `globals.css`, `features/auth/operators.ts`(팀 페이지에서 import), 기존 mockup `design-ref/folio-dashboard.html`

### 파일 수
신규 8 + 수정 5 = **13** → HARD-GATE 6~19 → **간략 설계** 등급. 이 design + 후속 plan으로 충족.

### slug → 라우트 매핑 (22)

| 섹션 | label | slug | pattern |
|------|-------|------|---------|
| 개요 | 실시간 현황 | (`/dashboard` index) | (기존) |
| 개요 | 실시간 알림 | `alerts` | dash |
| 개요 | 인수인계 | `handover` | dash |
| 서비스 그룹 | 전체 서비스 | `services` | list |
| 서비스 그룹 | 웹·프론트 | `services-web` | list |
| 서비스 그룹 | API 게이트웨이 | `services-api` | list |
| 서비스 그룹 | 백엔드 서비스 | `services-backend` | list |
| 서비스 그룹 | DB·저장소 | `infra-db` | list |
| 서비스 그룹 | 캐시 | `infra-cache` | list |
| 서비스 그룹 | 메시지 큐 | `infra-mq` | list |
| 서비스 그룹 | 배치 워커 | `batch-worker` | list |
| 운영 작업 | 배치 작업 | `batch-jobs` | list |
| 운영 작업 | 일일 점검 | `daily-check` | list |
| 운영 작업 | 장애 대응 | `incidents` | list |
| 운영 작업 | 변경 관리 | `changes` | list |
| 관측·로그 | Grafana 지표 | `grafana` | dash |
| 관측·로그 | Kibana 로그 | `kibana` | log |
| 관측·로그 | APM 트레이스 | `apm` | log |
| 관측·로그 | 알림 이력 | `notifications` | dash |
| 관리 | 온콜 일정 | `oncall` | list |
| 관리 | 팀·권한 | `team` | list (OPERATORS import) |
| 관리 | 환경설정 | `settings` | settings |

**패턴 분포**: list 14 / dash 4 / log 2 / settings 1 (= 21 dynamic + 1 index)

---

## 4. UX (각 패턴 wireframe)

### (1) 목록 패턴 (list — 14 페이지)

```
[셸: TitleBar/MenuBar/Sidebar/StatusBar]
┌─ Content ─────────────────────────────┬─ Inspector ──┐
│ [crumb] 운영부 / 서비스 / 전체 서비스    │ 행 선택 시:    │
│                                       │   상세 정보    │
│ ╭─ 헤더 ─────────────────────────╮     │   (이름/      │
│ │ 전체 서비스 · 12건             │     │    상태/      │
│ │ [필터칩: 전체 / 활성 / 점검]    │     │    담당/      │
│ ╰────────────────────────────────╯     │    최근 배포)  │
│                                       │              │
│ ┌─────────────────────────────────┐    │ 미선택 시:     │
│ │ ID    이름     상태    담당      │    │   "행을        │
│ │ ───────────────────────────────│    │    선택하세요"  │
│ │ ●     결제GW   urgent  김슬기    │    │              │
│ │       ...                      │    │              │
│ └─────────────────────────────────┘    │              │
└───────────────────────────────────────┴──────────────┘
```
- `lg:grid-cols-[1fr_320px]` (Inspector 320px)
- 행 선택 → Inspector 상세 (페이지 local state)
- 모바일: Inspector 숨김

### (2) 대시 패턴 (dash — 4 페이지)

```
[셸]
┌─ Content ─────────────────────────────┬─ Inspector ──┐
│ [crumb]                               │ 위젯 선택:    │
│ 실시간 알림 · 3건                      │   상세 메타   │
│                                       │              │
│ ┌─ 카드1 ────┐ ┌─ 카드2 ─┐ ┌─ 카드3 ──┐│ 미선택:       │
│ │ ⚠ urgent  │ │ 정상    │ │ 점검중   ││   요약 통계   │
│ │ 결제 지연  │ │ 47건    │ │ 2건     ││              │
│ │ 14:23     │ │ 24h     │ │ 30m     ││              │
│ └───────────┘ └─────────┘ └─────────┘│              │
│                                       │              │
│ [시간순 흐름 list]                      │              │
└───────────────────────────────────────┴──────────────┘
```
- 위젯 grid: `md:grid-cols-2 lg:grid-cols-3`
- 위젯 클릭 → Inspector 상세
- 미선택 시 Inspector에 "전체 요약" 위젯

### (3) 로그 패턴 (log — 2 페이지)

```
[셸]
┌─ Content (풀 너비, Inspector 없음) ─────────────────┐
│ [crumb] / Kibana 로그                              │
│                                                    │
│ ╭─ 검색바 ────────────────────────────────────╮     │
│ │ [search] 쿼리 입력…  [필터: 시간/레벨/서비스] │     │
│ ╰────────────────────────────────────────────╯     │
│                                                    │
│ ┌─ 로그 stream (monospace) ─────────────────────┐  │
│ │ 14:23:45 [INFO]  결제 게이트웨이 헬스체크 통과  │  │
│ │ 14:23:42 [WARN]  API latency 350ms (>200)    │  │
│ │ 14:23:01 [ERROR] DB 연결 실패 — retry 3/3     │  │
│ │ ...                                           │  │
│ └────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```
- Content 풀 너비
- mock 50줄 (정적, 무한 스크롤은 future)

### (4) 설정 패턴 (settings — 1 페이지)

```
[셸]
┌─ Content ────────────────────────────────────────────┐
│ [crumb] / 환경설정                                    │
│                                                      │
│ ┌─ 좌 nav ──────────┬─ 우 form ─────────────────────┐│
│ │ ◉ 일반            │  일반 설정                     ││
│ │ · 알림            │                                ││
│ │ · 표시            │  언어  [한국어 ▼]              ││
│ │ · 보안            │  타임존 [Asia/Seoul ▼]         ││
│ │ · 통합 (SSO)      │  테마 [○ light ● dark]         ││
│ └───────────────────┴────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```
- 좌 nav 240px + 우 form 1fr
- nav 클릭 → page state로 form 전환 (라우팅 X)
- 저장 동작은 placeholder ("Demo · 실제 저장 안 됨" 안내)

### Sidebar active state

- 활성: `bg-vermilion/10 text-vermilion border-l-2 border-vermilion`
- 비활성: 기존 hover only

### 모바일 (max-md)
- Inspector 숨김 (모든 패턴)
- settings 좌 nav: 상단 horizontal scroll

---

## 5. 데이터 흐름 / 코드

### slug → 메타 lookup

```ts
// _data.ts
export type SbPattern = "list" | "dash" | "log" | "settings";

export type SbItem = {
  ico: string;
  label: string;
  count?: string;
  slug?: string;        // 미지정 = 라우팅 비활성 (헤더 등)
  pattern?: SbPattern;
};

export function findSidebarMeta(slug: string): { label: string; pattern: SbPattern } | null {
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

### `/dashboard/[slug]/page.tsx`

```tsx
"use client";
import { useParams, notFound } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { ListPattern } from "../_components/patterns/ListPattern";
import { DashPattern } from "../_components/patterns/DashPattern";
import { LogPattern } from "../_components/patterns/LogPattern";
import { SettingsPattern } from "../_components/patterns/SettingsPattern";
import { getPatternMockData } from "../_data/patterns";

export default function DynamicDashboardPage() {
  const params = useParams<{ slug: string }>();
  const meta = findSidebarMeta(params.slug);
  if (!meta) notFound();

  const data = getPatternMockData(params.slug, meta.pattern);

  if (meta.pattern === "list") return <ListPattern title={meta.label} data={data} />;
  if (meta.pattern === "dash") return <DashPattern title={meta.label} data={data} />;
  if (meta.pattern === "log") return <LogPattern title={meta.label} data={data} />;
  return <SettingsPattern title={meta.label} data={data} />;
}
```

### 셸 layout.tsx

```tsx
// dashboard/layout.tsx
"use client";
import { Sidebar } from "./_components/Sidebar";
import { MenuBar } from "./_components/MenuBar";
import { sidebarSections } from "./_data";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen grid-rows-[34px_36px_1fr_26px]">
      <TitleBar />
      <MenuBar />
      <main className="grid h-full min-h-0 lg:grid-cols-[260px_1fr]">
        <Sidebar sections={sidebarSections} />
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </main>
      <StatusBar />
    </div>
  );
}
```

### mock data

```ts
// _data/patterns.ts
import { OPERATORS } from "@/features/auth/operators";

export const listMockRows = [
  { id: "SVC-001", name: "결제 게이트웨이", status: "urgent",  owner: "김슬기" },
  { id: "SVC-002", name: "회원 서비스",     status: "active",  owner: "정윤나" },
  { id: "SVC-003", name: "검색 인덱서",     status: "review",  owner: "한효진" },
  // ... 8개
];

export const dashMockWidgets = [
  { id: "W1", tone: "urgent", label: "결제 지연", value: "350ms", time: "14:23" },
  { id: "W2", tone: "ok",     label: "정상 서비스", value: "47건", time: "24h" },
  // ... 6개
];

export const logMockLines = [
  { ts: "14:23:45", level: "INFO",  msg: "결제 게이트웨이 헬스체크 통과" },
  { ts: "14:23:42", level: "WARN",  msg: "API latency 350ms (>200)" },
  // ... 50줄
];

type SettingsField =
  | { type: "select"; label: string; value: string; options: string[] }
  | { type: "radio"; label: string; value: string; options: string[] }
  | { type: "toggle"; label: string; value: boolean };

export const settingsSections = [
  { id: "general",  label: "일반", fields: [
    { type: "select", label: "언어",  value: "한국어", options: ["한국어", "English"] },
    { type: "select", label: "타임존", value: "Asia/Seoul", options: ["Asia/Seoul", "UTC"] },
    { type: "radio",  label: "테마",  value: "dark", options: ["light", "dark"] },
  ] },
  { id: "alerts",   label: "알림", fields: [
    { type: "toggle", label: "장애 발생 시 데스크탑 알림", value: true },
    { type: "toggle", label: "이메일 요약 (일간)", value: false },
  ] },
  { id: "display",  label: "표시", fields: [
    { type: "select", label: "기본 뷰", value: "목록", options: ["목록", "카드"] },
    { type: "toggle", label: "고밀도 표시", value: false },
  ] },
  { id: "security", label: "보안", fields: [
    { type: "toggle", label: "2단계 인증 (TOTP)", value: false },
    { type: "select", label: "세션 만료", value: "14일", options: ["1시간", "1일", "14일"] },
  ] },
  { id: "sso",      label: "통합 (SSO)", fields: [
    { type: "toggle", label: "Microsoft SSO 연결", value: true },
  ] },
] satisfies { id: string; label: string; fields: SettingsField[] }[];

export function getPatternMockData(slug: string, pattern: SbPattern) {
  // team 페이지는 OPERATORS 활용
  if (slug === "team") {
    return {
      rows: OPERATORS.map((op) => ({
        id: op.email,
        name: op.name,
        status: "active" as const,
        owner: op.team,
        meta: op.role,
      })),
    };
  }
  if (pattern === "list") return { rows: listMockRows };
  if (pattern === "dash") return { widgets: dashMockWidgets };
  if (pattern === "log") return { lines: logMockLines };
  return { sections: settingsSections };
}
```

### Sidebar 동작화

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 각 SbItem 렌더 시:
const pathname = usePathname();
const isActive = slug
  ? pathname === `/dashboard/${slug}`
  : pathname === "/dashboard";

return slug ? (
  <Link
    href={`/dashboard/${slug}`}
    prefetch={false}
    className={isActive
      ? "border-l-2 border-vermilion bg-vermilion/10 text-vermilion ..."
      : "...inactive..."}
  >
    ...
  </Link>
) : (
  <div className="...inactive...">...</div>
);
```

---

## 6. 에러 처리 / Edge cases

| 케이스 | 처리 |
|--------|------|
| 잘못된 slug | `findSidebarMeta` null → `notFound()` → Next.js 404 |
| 그룹 헤더 클릭 | slug 미지정 → toggle만 (기존 그대로) |
| `/dashboard` 진입 | slug 없음 → 기존 page.tsx ("실시간 현황") 그대로 |
| 모바일 사이드바 + Link 클릭 | 페이지 unmount → drawer 자연 close (path 변경 useEffect) |
| Inspector 미지원 패턴 selection | 패턴 컴포넌트 안에 selection state 없음 → Inspector 영역 자체 미렌더 |
| layout.tsx 추출 후 기존 dashboard 회귀 | 기존 e2e 시나리오 모두 통과 + design-sync 99.4% 유지 확인 |
| settings 좌 nav 클릭 | 라우팅 X — page state로 섹션 전환 |
| dash 패턴 "선택된 위젯 없음" | Inspector에 "전체 요약" placeholder |
| list 패턴 빈 데이터 | "조회 결과가 없습니다" empty state (mock data 항상 있어 실제 미발생) |
| `<Link prefetch>` | 22 사이드바 모든 Link에 `prefetch={false}` — 부담 회피 |
| `usePathname` Suspense | layout.tsx에서 호출 (검증된 패턴) |
| OPERATORS client import | 운영자 이름/이메일/팀/직급은 secret 아님 (사내 공개 OK). 문제없음 |

### Middleware
PUBLIC_PATHS 변경 없음. dynamic 페이지도 인증 필요 (기본 동작).

### 보안
- 페이지별 권한 체크는 out of scope (현재 모든 인증 user 접근 가능)
- mock data는 운영자 이름 외 secret 없음

---

## 7. 테스트 전략

### Vitest unit
- `findSidebarMeta` 3 케이스 (정상 slug / 잘못된 slug / 그룹 안 sub-item slug)
- 누적: 23 (기존) + 3 = **26 Vitest**

### Playwright e2e (`e2e/dashboard-pages.spec.ts` 신규)

| 테스트 | 시나리오 |
|--------|---------|
| 22 라우트 진입 smoke | 각 slug에 대해 200 + 라벨 노출 + 콘솔 에러 0 (loop 1 테스트) |
| 잘못된 slug → 404 | `/dashboard/nonexistent` (TEST_USER 미설정 시 skip) |
| Sidebar active state | `/dashboard/services`에서 사이드바 "전체 서비스"에 vermilion 클래스 |
| 사이드바 클릭 → 라우팅 | `/dashboard`에서 "실시간 알림" 클릭 → URL `/dashboard/alerts` |
| **목록**: 행 선택 → Inspector 갱신 | `/dashboard/services` 첫 행 클릭 → Inspector 행 메타 표시 |
| **대시**: 위젯 선택 → Inspector | `/dashboard/alerts` 첫 위젯 클릭 → Inspector |
| **로그**: Inspector 영역 미렌더 | `/dashboard/kibana` 우측 Inspector 영역 없음 (풀 너비) |
| **설정**: 좌 nav → 우 form 전환 | `/dashboard/settings`에서 "알림" 클릭 → URL 변경 없이 form 전환 |
| **팀 OPERATORS**: 17명 표시 | `/dashboard/team` 17행 + "송영석" 한 행 |

신규 약 6-8 테스트 (양 브라우저 ×2 = ~13 케이스). **누적 e2e**: 69 + ~13 = **약 82**

### design-sync
- 22 페이지: mockup 미존재 → 대상 외
- `/dashboard` (기존): 99.4% 유지 확인

### 사용자 시각 검증 (5 시나리오)
1. `/dashboard/services` (목록) — 행 선택 → Inspector
2. `/dashboard/alerts` (대시) — 위젯 grid + 선택
3. `/dashboard/kibana` (로그) — 풀 너비 stream
4. `/dashboard/settings` (설정) — 좌 nav + 우 form 전환
5. `/dashboard/team` (목록 + OPERATORS) — 17명 + 송영석

---

## 8. Risk / Out of scope

### Risk + 완화

| Risk | 영향 | 완화 |
|------|------|------|
| layout.tsx 추출 시 기존 dashboard 회귀 | 기존 e2e fail / 시각 변동 | 추출 후 dashboard.spec.ts 모든 시나리오 통과 + design-sync 99.4% 유지 |
| Sidebar 22 항목 active 매칭 누락 | 클릭해도 active 안 들어감 | `findSidebarMeta` group 재귀 + e2e smoke로 22 라우트 검증 |
| Link prefetch 비용 | 22 prefetch 부담 | `prefetch={false}` 명시 |
| usePathname Suspense (Next.js 16) | hydration mismatch | layout.tsx에서 호출 (검증 패턴) |
| 4 패턴이 22 페이지 다양성 대표 부족 | "전체 서비스"와 "팀·권한"이 같은 mock data | 의도된 단순화 (B 결정). 헤더에 "Demo · 실제 데이터 미연결" 안내 |
| settings 폼 저장 placeholder | 사용자 혼동 | "Demo · 변경사항 적용 안 됨" 안내 |

### Out of scope

- slug별 차별 mock data
- Supabase 실 데이터 fetch (services/incidents/alerts 등)
- settings 폼 실제 저장 동작
- 페이지별 권한 체크 (Operator role)
- 사이드바 검색/필터
- Cmd+K palette
- 페이지 전환 transition
- 사이드바 collapse 토글
- Inspector resizable 너비
- 22 페이지 mockup HTML
- 키보드 네비게이션 (사이드바 화살표 등)

---

## 9. 다음 단계

1. ✅ design.md 작성 (이 문서)
2. spec self-review
3. 사용자 spec 검토
4. writing-plans 스킬 호출 → `design-ref/2026-04-28-dashboard-pages-plan.md`
5. subagent-driven-development 실행

### 산출물 (구현 완료 시점)
- 신규 8 파일 (layout, [slug] page, 4 patterns, mock data, e2e spec)
- 수정 5 파일 (_data.ts, Sidebar, page.tsx, dashboard.spec.ts 등)
- Vitest 26 / Playwright ~82
- 메모리: dynamic [slug] + 패턴 demo 패턴 학습 기록
