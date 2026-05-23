# 실시간 현황 Phase 2 — 우측 사이드바 + 토스트

**Date:** 2026-05-23
**Status:** Draft
**Scope:** `/dashboard` 우측 사이드바(3 영역) + 우하단 토스트. Mock 우선.
**Reference:** `design-ref/realtime_dashboard.html`
**Phase 1 baseline:** main panel(헤더·KPI·테이블) 완성 상태

## 1. Goal

Phase 1로 완성된 main panel 우측에 **운영 모니터링 사이드바(3 영역)** + **우하단 LED 토스트**를 추가해 운영 대시보드 정체성을 완성. 데이터는 모두 Mock(레이아웃 가치 검증). 실 데이터 연결은 Phase 3.

## 2. Layout 변경

```
┌ dashboard-container (max-w-[1680px]) ────────────────────────────────────────┐
│  헤더 (sticky)                                                                │
├──── 2-col grid (lg:grid-cols-[3fr_1fr] gap-6) ───────────────────────────────┤
│ ┌ main 3fr ────────────────────────────┐  ┌ side 1fr (sticky top-N) ─────┐  │
│ │ KPI 3 / 그룹 2 / 필터+테이블 (기존)    │  │ § 시스템 게이트웨이 상태     │  │
│ │                                       │  │   - LED + 라벨 + 값 3행      │  │
│ │                                       │  │ § 실시간 백그라운드 로그     │  │
│ │                                       │  │   - 검은 mono console 320px  │  │
│ │                                       │  │ § 관리자 컨트롤              │  │
│ │                                       │  │   - 시뮬레이션 토글          │  │
│ │                                       │  │   - 테스트 이벤트 인입       │  │
│ └───────────────────────────────────────┘  └──────────────────────────────┘  │
│                                                                              │
│                                              ┌ Toast (fixed bottom-right) ─┐ │
│                                              │ ● {message}                  │ │
│                                              └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

- 모바일/태블릿 (≤ lg): 단일 컬럼 stack — 사이드바가 main 아래로
- 사이드바는 `position: sticky` (스크롤 시 우측 고정)
- 인스펙터 패널 슬라이드와의 관계: 인스펙터 열리면 사이드바 우측은 인스펙터 뒤로 가려짐. 인스펙터 close 시 다시 보임. 별도 처리 X (기존 `md:pr-[400px]` 흐름 그대로)

## 3. § 1 시스템 게이트웨이 상태

### 외부 박스 (SideBox 공통 컴포넌트)
- border ink 1px, bg-washi-raised, p-4
- title row: 좌측 "시스템 게이트웨이 상태" (13px bold ink) + 우측 메인 헬스 LED (green default)
- title 아래 border-b ink

### 항목 3개 (HealthLed + 라벨 + 값)
| 라벨 | 값 (mock) | LED |
|---|---|---|
| YouTube API Quota | `67.2% 잔여` | green |
| Supabase Connection | `12ms (Good)` | green |
| Cron 자동화 엔진 | `정상 가동` | green (시뮬레이션 ON 시 vermilion 깜빡임) |

### LED 컴포넌트 (`HealthLed`)
- 6-8px round, box-shadow LED glow
- variant: `green`(정상) / `vermilion`(경고·작동중) / `amber`(주의)
- vermilion variant는 `animate-[led-flicker_1s_alternate_infinite]` (globals.css 신규 keyframes)

### 컴포넌트
- `SideBox.tsx` — 공통 박스 (title slot + children)
- `HealthLed.tsx` — LED 인디케이터
- `SystemHealthPanel.tsx` — 3 항목 list

## 4. § 2 실시간 백그라운드 로그 콘솔

### 박스
- title "실시간 백그라운드 로그" + 우측 작은 mono "Auto Scroll" 라벨
- 본체: 검은 배경 console (height 320px, overflow-y-auto)

### Console (`ConsoleStream`)
- bg `#1a160f` (디자인 토큰 추가: `console`), text `#eae5d9` (`console-fg`)
- font-mono 12px, padding 12px, line-height 1.5
- 각 줄: `console-line` with type `info`(cyan) / `warn`(yellow) / `err`(salmon)
- 자동 스크롤 (새 줄 추가 시 bottom)
- **Mock 동작**: 초기 3줄 (시스템 부팅 같은) 정적 표시. 시뮬레이션 토글 ON 시 6초마다 랜덤 로그 1줄 추가, 50줄 초과 시 가장 오래된 줄 제거

### 디자인 토큰 추가
```
--color-console-bg: #1a160f;
--color-console-fg: #eae5d9;
--color-console-info: #8bb3e5;
--color-console-warn: #e9c46a;
--color-console-err: #e76f51;
```

(레퍼런스 색상 그대로. console 전용 색이라 별도 토큰)

## 5. § 3 관리자 컨트롤 (시뮬레이터)

### 박스
- bg-washi, border ink, p-3 (다른 박스보다 좁은 padding)

### 2 버튼
- **주 버튼**: `시뮬레이션 활성화` (full width, bg-ink text-cream, 12px font-semibold). active 시 `bg-vermilion border-vermilion` + 텍스트 `시뮬레이션 정지`
- **보조 버튼**: `테스트 이벤트 인입 (+1)` (full width, transparent + border ink, 11px)

### 동작 (Mock)
- 주 버튼 토글: `sim` state. on 시:
  - 6초 interval 시작 → `triggerEvent()` 호출
  - Cron LED → vermilion flicker, 텍스트 → `스케줄 수집 작동 중`
  - 토스트: "🚀 실시간 시뮬레이션 가동 시작" — wait, emoji 금지. 대신 "시뮬레이션 가동" (LED 좌측 점은 토스트 컴포넌트 자체에 있음)
- off 시: interval clear, LED green 복귀
- 보조 버튼: 즉시 `triggerEvent()` 한 번

### `triggerEvent` (mock)
- 토스트 표시 ("[사고] 신규 이벤트 감지" 등 랜덤 메시지 풀)
- 콘솔에 로그 한 줄 추가
- 새 행이 LiveTable에 인입 — Phase 2에선 **콘솔/토스트만** 처리. 테이블 인입(`new-flash` 애니메이션)은 Phase 3.

### 컴포넌트
- `AdminControls.tsx` — 2 버튼 + sim state hook

## 6. 우하단 토스트

### `Toast.tsx` + `ToastContainer.tsx`
- ToastContainer: `fixed bottom-6 right-6 z-[100]`, flex col gap-2
- Toast: bg-ink text-cream, p-2.5 px-4, border washi 1px, shadow-md, font 12px
- 좌측에 작은 vermilion LED dot (6px round)
- 진입 애니메이션: `translateY(50px) opacity 0` → `translateY(0) opacity 1` 0.3s ease-out cubic
- 자동 사라짐: 3.5초 후 페이드아웃 + 0.3s 후 DOM 제거

### 트리거
- Context (`ToastContext` provider) + `useToast()` hook
- `showToast(message: string)` → 큐에 추가
- 동시 여러 토스트 stack 가능 (시뮬레이션 ON 시 6초마다 새로 인입)

## 7. 컴포넌트 정리

### 신규 (Phase 2)
- `_components/live/SideBox.tsx` + 테스트
- `_components/live/HealthLed.tsx` + 테스트
- `_components/live/SystemHealthPanel.tsx` + 테스트
- `_components/live/ConsoleStream.tsx` + 테스트 (mock 로그 풀 별도 모듈 가능)
- `_components/live/AdminControls.tsx` + 테스트
- `_components/live/Toast.tsx` + `ToastContainer.tsx` + 테스트
- `_components/live/toast-context.tsx` (Provider + useToast hook)
- `_components/live/LiveSidebar.tsx` — 3 영역 합성
- `_lib/mock-log-pool.ts` — 콘솔 로그 풀 (또는 `_components/live/` 내부)

### 변경
- `LiveOverview.tsx` — main을 2-col grid의 좌측으로, 우측에 `<LiveSidebar />` 추가, `<ToastContainer />` 마운트
- `page.tsx` — LiveOverview에 새 prop(있다면) 전달. 데이터는 mock이므로 page.tsx 변경 최소
- `globals.css` — `@keyframes led-flicker`, `@keyframes toast-in/out` 추가
- `design-tokens.ts` / `globals.css @theme` — `console-*` 5색 토큰 추가

### 유지
- 기존 Phase 1 컴포넌트 (KpiCardLarge / FilterTabs / LiveTable / InspectorPanel 등) 변경 X
- LivePageHeader 변경 X

## 8. 디자인 토큰 추가

`globals.css :root` + `@theme inline`:
```
--console-bg: #1a160f;
--console-fg: #eae5d9;
--console-info: #8bb3e5;
--console-warn: #e9c46a;
--console-err: #e76f51;

@theme inline:
--color-console-bg: var(--console-bg);
... (5종)
```

## 9. 테스트 전략

- **컴포넌트 RTL**:
  - SideBox (title + children 렌더)
  - HealthLed (3 variant — green/vermilion/amber 색상 + flicker 클래스)
  - SystemHealthPanel (3 행)
  - ConsoleStream (초기 3 줄, 새 줄 push → 추가, 50줄 cap, 자동 스크롤은 통합 검증 어려워 skip)
  - AdminControls (2 버튼 + 토글 state)
  - Toast / ToastContainer (메시지 렌더, 3.5초 자동 제거 — fake timer)
  - ToastContext (showToast → 큐 + 자동 cleanup)
  - LiveSidebar (3 영역 모두 렌더)
- **회귀**: 전체 vitest 통과, build 성공
- **e2e 별도 없음** (Phase 2는 visual)

## 10. 인터랙션 흐름 (Mock)

1. 페이지 로드 → 사이드바 3 영역 정적 표시, 토스트 없음
2. "테스트 이벤트 인입" 버튼 클릭 → `triggerEvent()` → 토스트 1건 + 콘솔 1줄
3. "시뮬레이션 활성화" 버튼 클릭 → `sim=on`, Cron LED vermilion flicker, 버튼 텍스트 "정지"로
   - 즉시 1회 `triggerEvent()`
   - 이후 6초 interval로 `triggerEvent()` 반복
4. "시뮬레이션 정지" 클릭 → interval clear, LED green 복귀, 버튼 텍스트 복원

## 11. 비범위 (Phase 3)

- 실 데이터 연결 (Supabase Realtime / 실제 헬스 체크 ping / 실제 worklog stream)
- LiveTable에 인입 row flash 애니메이션
- 사이드바 위젯 사용자 커스터마이즈
- 토스트 액션 버튼 (snooze / dismiss)
- Cron 상태 외 다른 LED의 작동 중 표시

## 12. 리스크 / 메모

- **6초 interval mock** — 페이지 떠나는 시점에 cleanup 필요 (useEffect return). 메모리 누수 방지
- **Toast queue 동시성** — 시뮬레이션 ON일 때 6초마다 토스트 + 3.5초 자동 제거. 평균 1~2개 동시 표시. Stack overflow 위험 X
- **콘솔 50줄 cap** — DOM 노드 제한. 자동 스크롤 (`scrollTop = scrollHeight`) 매번 호출은 비용 미미
- **2-col grid + 인스펙터 슬라이드** — 인스펙터 열리면 사이드바 가려짐. 의도된 동작 (인스펙터가 우선)
- **반응형**: 모바일에선 사이드바를 main 아래로 stack (sticky 해제)

## 13. Self-Review

- [x] 레퍼런스 사이드바 3 영역 + 토스트 모두 반영
- [x] Mock 데이터 명시 (실 데이터 Phase 3 이연)
- [x] 디자인 토큰(console-*) 추가 절차 명시
- [x] 신규 컴포넌트 9개 + 변경 4개
- [x] 인스펙터/sticky/반응형 충돌 처리 명시
