# Design — Dashboard Chrome Redesign (PIVOT)

- **Date**: 2026-05-04
- **Owner**: 송영석
- **Topic**: `/dashboard` 상단 chrome 영역(좌측 로고/명칭, 가운데 검색, 우측 세션·알림·로그인) 전면 재디자인
- **Source**: 사용자 직접 피드백 (스크린샷 + brainstorm dialogue)
- **Status**: Awaiting user review

## 1. Goal

기존 Folio/에디토리얼 톤의 chrome (검은 TitleBar `운영부 · 상황실` + washi MenuBar `◆`)을 폐기하고, **PIVOT** 정체성의 단일 chrome bar로 재구성. 다섯 가지 시각·기능 요소(로고, 시스템 명칭, 세션 카운트다운, 알림, 로그인 정보)를 한 세트로 통합 적용한다. 사용자 정보는 mock("송영석" 하드코딩)에서 Supabase 인증 + OPERATORS 화이트리스트 lookup으로 전환.

## 2. Out of Scope

- dashboard 본체(`/dashboard` 1면 신문 메타포, 패턴 페이지, Sidebar, StatusBar) 디자인은 그대로 유지.
- 모바일 chrome (≤md, AppBar) 톤 통일은 별도 epic. 이번 PR은 데스크탑 ≥md만.
- Supabase profiles 테이블 신설 — 사용자 데이터는 OPERATORS 매핑 + email fallback로 충분.
- StatusBar/Sidebar의 PIVOT 톤 통일 — chrome만 별도 레이어로 둔다 (추후 결정).

## 3. Architecture

### 3.1 Identity (확정)

- **명칭**: `PIVOT` + tracked uppercase 부제 `OPS DESK`
- **로고**: 18×18 검은 사각 + 안쪽 8×8 흰 사각 (Bauhaus 풍)
- **타이포**: Pretendard / 굵은 산세리프, 영문 워드마크 18px 800 weight
- **색상**: 흑백 + 1점 액센트(빨강 `#b8331e` ≈ 기존 vermilion 재활용 가능)
- **금지**: 한자(漢字) 글리프 일체 미사용 (사용자 명시)

### 3.2 Chrome 레이아웃 (1층 통합, 데스크탑 ≥md)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▣ PIVOT  OPS DESK   │   [검색 …  ⌘K]   │   15:00     3       송영신       │
│                     │                  │   세션      알림    운영2팀·팀장   │
└──────────────────────────────────────────────────────────────────────────────┘
        좌측 (1fr)         가운데 (1fr)              우측 (1fr)
        높이 52px (스택 인디케이터 변형 C)
```

- 그리드: `grid-template-columns: 1fr 1fr 1fr`
- 높이: 52px (KPI 스택 표기 수용)
- 보더: 상하 2px ink-line
- 배경: snow-bg (≈ 흰색에 약간 베이지 섞임)

### 3.3 컴포넌트 트리

```
DashboardLayout (server)
└── DashboardShell (client, sidebar drawer state)
    ├── Chrome (server)
    │   ├── ChromeBrand (server)         ▣ PIVOT OPS DESK
    │   ├── ChromeSearch (client)        — 기존 SearchBox 재활용
    │   └── ChromeRight (server)
    │       ├── SessionTimer (client)    — idle 카운트다운 + signOut
    │       ├── AlertsBell (client)      — v2 hover dropdown + click navigate
    │       └── ChromeUser (server)      — 풀네임 + 부제(팀·직급 또는 "관리자")
    ├── Sidebar (client)                 — 기존 그대로
    ├── <main>{children}</main>
    └── StatusBar (server)               — 기존 그대로
```

### 3.4 Server/Client 경계

- **layout.tsx**: server component로 변환. `getCurrentOperator()` 호출 → `{ user, operator | null }` 객체를 `<DashboardShell user={...} alerts={...}>`에 전달
- **DashboardShell.tsx** (신규, client): `"use client"`. sidebar drawer state + ESC handler + body scroll lock. children render
- **Chrome.tsx** (신규, server): user props로 ChromeBrand/ChromeRight 렌더, ChromeSearch는 client child
- **SessionTimer.tsx** (신규, client): mousemove/keydown listener + `useState` countdown
- **AlertsBell.tsx** (변경, client): hover/click 동작 변경

### 3.5 사용자 정보 fetch

```typescript
// src/features/auth/queries.ts (신규, server-only)
import { createClient } from "@/lib/supabase/server";
import { OPERATORS } from "./operators";

export async function getCurrentOperator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const operator = OPERATORS.find(op => op.email === user.email) ?? null;
  return {
    email: user.email,
    operator,           // null = 비-OPERATORS (admin/dev)
    displayName: operator?.name ?? user.email.split("@")[0],
    role: operator?.role ?? "관리자",
    team: operator?.team ?? null,  // null이면 ChromeUser는 "관리자" 단독 부제 표시
  };
}
```

`ysong2526@gmail.com` 같은 dev/admin 계정은 OPERATORS에 없어 fallback 분기가 자연스럽게 처리된다 (메모리 `project_dev_account.md`).

### 3.6 SessionTimer (Idle Timeout)

- 초기값: 15:00 (900초)
- 활동 이벤트: `mousemove`, `keydown`, `click` — `document` 레벨 listener
- 활동 감지 시: 카운트다운 900초로 reset
- `setInterval(1000ms)`로 1초씩 감소
- 0초 도달 시: `signOut()` server action 호출 → `redirect("/login?reason=idle")`
- 표시: `MM:SS` 형식, 5분 미만일 때 빨강 강조 (선택)
- tab 비활성화 시: `setInterval` 자연 stop (브라우저 throttling) — 의도된 동작

### 3.7 AlertsBell v2 (호버 드롭다운 + 클릭 이동)

- 종 SVG 아이콘 20×20 (현재 `◎` 글리프에서 SVG로 교체)
- 우측 상단 빨간 배지 (urgent count, 0이면 숨김)
- **호버 200ms**: 인라인 드롭다운으로 최근 5건 미리보기
- **클릭**: `router.push("/dashboard/alerts")`
- 드롭다운 자체에서 클릭 시 해당 알림 상세로 이동
- ESC + 외부 클릭 닫기 (현재 동작 유지)

## 4. 디자인 토큰

`src/lib/design-tokens.ts`에 신규 추가 (3개):

```typescript
export const colors = {
  // ... 기존 ...

  // PIVOT chrome 전용 (별도 레이어)
  chromeGraphite: '#18181b',     // 검은 사각 mark, 텍스트
  chromeSnow: '#f5f5f4',         // chrome 배경 (krem 대신)
  chromeMuted: '#71717a',        // 부제, 라벨 (sub muted)
} as const;
```

기존 `vermilion` 액센트는 그대로 재활용 (배지, urgent indicator).

## 5. 데이터 흐름

```
┌──────────────────────────────────────────────────────────┐
│ layout.tsx (server)                                       │
│ ├─ getCurrentOperator() → user/operator                   │
│ └─ alertsWidgets (mock, getPatternMockData)              │
└──────────────────────────────────────────────────────────┘
       │ props (user, alerts)
       ▼
┌──────────────────────────────────────────────────────────┐
│ DashboardShell (client) — sidebar/scroll/ESC state       │
└──────────────────────────────────────────────────────────┘
       │ props
       ▼
┌────────────────────┬────────────────────┬───────────────┐
│ ChromeBrand (srv)  │ ChromeRight (srv)  │ Sidebar/etc.  │
│                    │ ├ SessionTimer (cli)│              │
│                    │ ├ AlertsBell (cli) │              │
│                    │ └ ChromeUser (srv) │              │
└────────────────────┴────────────────────┴───────────────┘
```

## 6. 에러 처리

- `getCurrentOperator()` user null → middleware 단계에서 이미 `/login` redirect되므로 chrome render 시점엔 user 보장됨. null은 발생할 수 없는 invariant.
- OPERATORS 매칭 실패 → fallback 표시 (email username + "관리자"). 에러 아님.
- SessionTimer signOut 호출 실패 → 다음 활동 시 supabase 자체 토큰 만료로 처리됨.
- AlertsBell mock 데이터 빈 배열 → "새 알림 없음" 인라인 메시지 (기존 유지).

## 7. 테스트 전략 (TDD)

### 7.1 단위 (vitest)

- `getCurrentOperator.test.ts`: OPERATORS 매칭 / fallback / null user
- `SessionTimer.test.tsx`: 초기 15:00 / mousemove reset / 0:00 도달 시 signOut 호출 / unmount cleanup
- `AlertsBell.test.tsx`: 호버 200ms 드롭다운 / 클릭 navigate / 빈 알림 / ESC 닫기
- `Chrome.test.tsx`: brand/search/right zone 모두 render 확인 + user props 전달
- `DashboardShell.test.tsx`: sidebar open/close, ESC 핸들러

### 7.2 e2e (playwright)

- `e2e/dashboard.spec.ts` 갱신:
  - chrome 좌측 `PIVOT OPS DESK` text 어설션
  - 검색창 가운데 정렬 + `⌘K` indicator
  - 우측 SessionTimer `15:00` 초기 표시
  - 알림 종 SVG 클릭 시 `/dashboard/alerts` URL 이동
  - 사용자 풀네임 표시 (operators의 첫 멤버 fixture로)

### 7.3 Idle 타임아웃 e2e

- 시간 모킹: vitest는 `vi.setSystemTime`, playwright는 `page.clock.install({ time })` + `page.clock.fastForward("15:00")` — 15분 후 자동 로그아웃 검증
- 활동 시 reset 검증 (5분 후 클릭 → 다시 15분으로)

## 8. 영향 파일 (예상 12-15개)

### 신규
- `src/app/dashboard/_components/chrome/Chrome.tsx`
- `src/app/dashboard/_components/chrome/ChromeBrand.tsx`
- `src/app/dashboard/_components/chrome/ChromeRight.tsx`
- `src/app/dashboard/_components/chrome/ChromeUser.tsx`
- `src/app/dashboard/_components/chrome/SessionTimer.tsx`
- `src/app/dashboard/_components/DashboardShell.tsx`
- `src/features/auth/queries.ts`

### 변경
- `src/app/dashboard/layout.tsx` — server 변환
- `src/app/dashboard/_components/MenuBar.tsx` — 삭제 (Chrome으로 흡수)
- `src/app/dashboard/_components/AlertsBell.tsx` — v2 hover/navigate
- `src/app/dashboard/_components/SearchBox.tsx` — chrome 컨테이너 적응 (max-width)
- `src/lib/design-tokens.ts` — chromeGraphite/Snow/Muted 추가
- `tailwind.config.ts` — 토큰 노출
- `e2e/dashboard.spec.ts` — chrome 어설션 갱신
- 관련 vitest 테스트들

### 삭제
- `src/app/dashboard/_components/__tests__/MenuBar.test.tsx` (Chrome.test.tsx로 흡수)

**HARD-GATE 등급**: 간략 설계 (6-19 파일).

## 9. 리스크

- **layout server 변환**: client `useEffect`/state가 자식으로 분리되며 props 누락 가능. e2e로 sidebar drawer 회귀 검증 필수.
- **OPERATORS 누락 fallback**: 사용자 본인이 dev 계정이라 lookup miss → fallback 분기가 늘 발동됨. 표시 방식 검증 필요.
- **Idle timer + tab visibility**: tab 비활성화 시 `setInterval` throttling으로 카운트다운이 부정확해질 수 있음. 사용자 확인된 의도 (사양상 OK).
- **Chrome 톤 ↔ 본체 톤 격차**: chrome=흑백 + dashboard 본체=washi/베이지. 시각적 불연속 위험. 1차 dev 서버 점검에서 사용자 확인.
- **e2e 시간 모킹**: 15분 idle 검증에 playwright `page.clock` API 활용 (Playwright ≥1.45). vitest 단위 테스트는 `vi.setSystemTime` (ShiftTimeline 테스트에서 검증된 패턴 재활용).

## 10. 검증 (DoD)

1. `npm run lint` — 0 errors
2. `npx tsc --noEmit` — 0 errors
3. `npm test` — 모든 vitest 통과 (신규 + 회귀)
4. `npm run e2e` — chrome 신규 어설션 + 회귀
5. dev 서버 `/dashboard` 진입 — PIVOT chrome 시각 확인 (사용자 본인 계정 fallback 표기 OK)
6. 알림 호버 드롭다운 + 클릭 navigate 동작
7. 5분 후 idle 시뮬레이션 → 15분 후 자동 로그아웃 확인 (수동 또는 e2e clock)
8. design-audit hook — 0 위반
