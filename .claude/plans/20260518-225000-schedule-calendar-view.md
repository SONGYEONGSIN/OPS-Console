---
plan_id: 20260518-225000-schedule-calendar-view
status: completed
created: 2026-05-18T13:50:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260518-223916-schedule-calendar-view.md
branch: feat/schedule-calendar-view
---

# Plan: 운영부 달력 (월 그리드) — services + schedule_events 결합 + Inspector 연동

## Goal

`/dashboard/schedule` 페이지에 월 그리드 캘린더 view를 default로 추가한다 (기존 list view는 `?view=list`로 진입). services `write_start_at`/`write_end_at` 두 이벤트 + `schedule_events`를 같은 셀에 컬러 dot + 한 줄 텍스트로 렌더. 캘린더 셀 아이템 클릭 시 우측 InspectorPanel이 슬라이드 — schedule_event는 schedule variant(편집 가능), service는 services variant(read-only). 상단 "+ 새 일정" 버튼으로 schedule_events 신규 작성. 월 이동은 `?month=YYYY-MM` URL 기반으로 RSC가 refetch.

## Approach

대안 B (브레인스톰 추천) + 사용자 결정 3건 반영:
- (A) default view = calendar
- (B) `?month` URL 기반 RSC refetch
- (C) Inspector 사용 + multi-variant dispatch (schedule_events / services)

CalendarView는 client component로 월 state 대신 URL query 의존(`useRouter().push("?month=...&view=calendar")`). InspectorPanel은 CalendarView 내부에서 mount하되 클릭된 row의 출처에 따라 variant prop을 동적으로 결정. + 새 일정 버튼은 admin/member에게만 노출 (기존 schedule 권한 정책 유지).

캘린더 그리드 계산 + KST 날짜 변환 + 이벤트 그루핑은 pure 함수로 분리해 단위 테스트(RED-GREEN).

## Out of Scope

- services 캘린더 추가 (외부 시트 import)
- pay_start_at / pay_end_at 표시 (write 2 날짜만 v1)
- 주간/일간 view (월간만)
- 드래그로 일정 이동/연장
- 일정 반복(recurrence)
- 다국어/타임존 (KST 고정)

## 영향 파일

| # | 파일 | 변경 유형 | 비고 |
|---|---|---|---|
| 1 | `src/app/dashboard/schedule/_calendar-helpers.ts` | 신규 | 월 그리드(42셀) + KST 변환 + 이벤트 그루핑 pure 함수 |
| 2 | `src/app/dashboard/schedule/__tests__/_calendar-helpers.test.ts` | 신규 | (1) 단위 테스트 — RED 먼저 |
| 3 | `src/features/services/queries.ts` | 수정 | `listServicesForCalendar(rangeStartYmd, rangeEndYmd)` 추가 |
| 4 | `src/features/services/__tests__/queries.test.ts` | 수정 | (3) 단위 테스트 추가 |
| 5 | `src/app/dashboard/schedule/CalendarToolbar.tsx` | 신규 | 월 prev/next/today + view 토글 + + 새 일정 (admin/member only) |
| 6 | `src/app/dashboard/schedule/CalendarView.tsx` | 신규 | client — 그리드 렌더 + InspectorPanel 통합 (multi-variant dispatch) |
| 7 | `src/app/dashboard/schedule/__tests__/CalendarView.test.tsx` | 신규 | RTL — 그리드 + 토글 + 클릭 → inspector + new 일정 |
| 8 | `src/app/dashboard/schedule/page.tsx` | 수정 | searchParams `view`/`month` + services range fetch + view 분기 |

**총 8 파일** → HARD-GATE **간략 설계** (6~19 구간)

## 단계

### T1: 캘린더 헬퍼 RED 테스트 작성
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/__tests__/_calendar-helpers.test.ts` (신규)
- **변경**:
  - `describe("toKstYmd")`: `2026-05-31T16:00:00Z` (UTC) → `"2026-06-01"` (KST 익일) 검증
  - `describe("buildMonthGrid")`: 2026-05 입력 시 42셀(6주×7열), 첫 셀 = 일요일, 각 셀 `{ date, ymd, inMonth }` 반환
  - `describe("groupItemsByDay")`: services + schedule_events mix 입력 → `Map<ymd, CalendarItem[]>`. service는 write_start/end_at 각각 분해, null skip. category enum 보존. 정렬은 [allDay desc, sortKey asc]
- **DoD**: `npm test _calendar-helpers` 실행 시 import 에러로 RED 확인
- **의존**: 없음

### T2: 캘린더 헬퍼 GREEN 구현
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/_calendar-helpers.ts` (신규)
- **변경**:
  - `CalendarCategory = "service-start" | "service-end" | "shift" | "event" | "leave" | "training"`
  - `CalendarItem = { id; ymd; category; label; sortKey; sourceVariant: "schedule" | "services"; rowRef: any }` — rowRef는 inspector 진입 시 원본 row
  - `toKstYmd(iso)`: `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 사용
  - `buildMonthGrid(year, month0)`: 첫 칸 = 해당 월 1일 직전 일요일, 42칸
  - `groupItemsByDay(events, services)`: 위 명세대로
- **DoD**: T1 테스트 GREEN
- **의존**: T1

### T3: services range fetch RED 테스트
- **상태**: pending
- **파일**: `src/features/services/__tests__/queries.test.ts` (수정)
- **변경**: `describe("listServicesForCalendar")` 추가
  - mock supabase builder가 `or` body에 `and(write_start_at.gte.X,write_start_at.lte.Y),and(write_end_at.gte.X,write_end_at.lte.Y)` 패턴으로 호출되는지
  - empty result → `[]`
- **DoD**: `npm test services/queries` 실행 시 RED
- **의존**: 없음

### T4: services range fetch GREEN 구현
- **상태**: pending
- **파일**: `src/features/services/queries.ts` (수정)
- **변경**: `export async function listServicesForCalendar(rangeStartYmd, rangeEndYmd): Promise<ServicesRow[]>`
  - `.from("services").select("*").or(...)`
  - `safeParse` 패턴은 기존 함수 mirror
- **DoD**: T3 GREEN + typecheck
- **의존**: T3

### T5: CalendarToolbar 컴포넌트
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/CalendarToolbar.tsx` (신규)
- **변경**:
  - `"use client"`. Props: `{ year, month0, view, canWrite, onPrev, onNext, onToday, onViewChange, onNewEvent }`
  - 좌측: `‹ YYYY.MM ›` + "오늘" + + 새 일정 (canWrite만)
  - 우측: view 토글 (calendar/list, 활성 = `bg-ink text-cream`)
  - 색상은 기존 토큰만 (vermilion/ink/line/cream)
- **DoD**: typecheck. CalendarView 테스트에서 간접 검증
- **의존**: 없음 (T6과 병렬 가능)

### T6: CalendarView RED 테스트
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/__tests__/CalendarView.test.tsx` (신규)
- **변경** (RTL + vitest, `vi.useFakeTimers`로 2026-05-15 고정):
  - props: `events`, `services`, `currentMonth={ year, month0 }`, `view`, `canWrite`, callbacks(onMonthChange, onViewChange, onPersist, onDelete)
  - 헤더 `2026.05` + 42셀 렌더
  - schedule_event row가 해당 셀에 `data-category="shift"` dot + 텍스트
  - service row가 `data-category="service-start"` dot + 텍스트
  - "다음 달" 버튼 클릭 → onMonthChange({ year: 2026, month0: 5 }) 콜
  - schedule_event dot 클릭 → InspectorPanel 슬라이드(variant=schedule)
  - service dot 클릭 → InspectorPanel(variant=services) read-only
  - + 새 일정 클릭 (canWrite=true) → blank schedule row + editing 활성
- **DoD**: `npm test CalendarView` RED (컴포넌트 미존재)
- **의존**: T2 (헬퍼 GREEN)

### T7: CalendarView GREEN 구현
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/CalendarView.tsx` (신규)
- **변경**:
  - `"use client"`. Props는 T6 명세 그대로
  - `useInspectorState` 사용. 클릭된 item의 `sourceVariant`를 state에 저장
  - InspectorPanel 1개 mount, InspectorListBody의 `variant` prop은 현재 선택된 sourceVariant로 동적 결정 (기존 dispatcher 그대로 사용)
  - 7열 grid + 헤더 ["일","월","화","수","목","금","토"] (한자 금지)
  - 셀: 날짜 숫자(inMonth=false면 `text-faint`) + items 최대 4개 dot+한줄, 초과 `+N`
  - dot 색 매핑 컴포넌트 상수: service-start=`bg-sage`, service-end=`bg-indigo`, shift=`bg-vermilion`, event=`bg-ink`, leave=`bg-line-soft`, training=`bg-washi-raised border border-line`
  - 모든 색은 기존 design-tokens. 신규 추가 X
  - 상단 CalendarToolbar render
- **DoD**: T6 GREEN. typecheck/lint pass
- **의존**: T2, T5, T6

### T8: page.tsx 통합
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/page.tsx` (수정)
- **변경**:
  - searchParams 비동기 unwrap (`Promise<{ view?: string; month?: string }>`)
  - `view = sp.view === "list" ? "list" : "calendar"` (default calendar)
  - `month` 파라미터 파싱 (regex `^\d{4}-\d{2}$`, 실패 시 today KST 기준)
  - currentMonth → 그리드 시작/끝일 계산 (helpers 사용) → `listServicesForCalendar(start, end)` + `listScheduleEvents()` 병렬 fetch
  - view=calendar → CalendarView 렌더 (props 전달)
  - view=list → 기존 ListPattern 그대로
  - PageHeader / requireMenu / canWrite 흐름 무변경
- **DoD**:
  - `npm run typecheck`
  - 수동: `/dashboard/schedule` 진입 → calendar default, `?view=list` → list view, `?month=2026-08` → 그달 데이터
  - 기존 schedule e2e 깨지는지 점검 (e2e가 default=list 가정이면 spec 1줄 수정 가능성)
- **의존**: T4, T7

### T9: 회귀 검증 + 시각 확인
- **상태**: pending
- **파일**: 없음 (실행만)
- **변경**: `npm run lint && npm run typecheck && npm test`
- **DoD**: 전체 PASS. 수동 시각 확인 (스크린샷 또는 사용자 확인)
- **의존**: T8

## 의존 그래프

```
T1 → T2 ─┬─→ T6 → T7 → T8 → T9
         │         ↑
T3 → T4 ─┘         │
T5 ────────────────┘
```

T1/T3/T5는 병렬 가능.

## 리스크 / 엣지 케이스

1. **KST UTC 경계** — `2026-05-31T16:00:00Z` = KST 2026-06-01. 반드시 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 사용. T1 명시 검증
2. **월 1일 요일** — `getDay()` 일=0. 6주 고정 = 항상 42셀 (다음 달 일부 포함)
3. **multi-variant Inspector dispatch** — InspectorListBody의 variant prop이 동적 결정. 기존 dispatcher는 single variant 가정 — T7 구현 시 동작 검증 필요. 안 되면 InspectorPanel 2개 conditional render로 fallback
4. **같은 셀 다중 아이템 정렬** — `[allDay desc, sortKey asc, category 안정정렬]`. T1 명시
5. **services range nested or** — PostgREST `or("and(...),and(...)")` 문법. T3 builder call args 정확 검증
6. **services dot read-only** — services variant는 EditForm 비활성 (기존 services list-variant 동작 그대로)
7. **기존 e2e 회귀** — schedule e2e가 list view 가정 시 `?view=list` 명시 진입으로 spec 1줄 수정. T9에서 검증
8. **모바일 viewport** — calendar 셀이 작아 dot 식별 어려움. v1: 모바일에서도 같은 grid 표시 (font-size 축소). 후속 PR에서 mobile 단순화 가능
9. **+ 새 일정 권한** — admin/member만 가시. viewer는 토글바에 버튼 미표시 (기존 schedule canWrite 로직 mirror)
10. **빈 month 파라미터/잘못된 형식** — regex 검증 실패 시 today fallback. invalid 처리는 silent (에러 페이지 X)

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-18T13:50:00Z | - | plan 생성 | source: brainstorm 20260518-223916 |
