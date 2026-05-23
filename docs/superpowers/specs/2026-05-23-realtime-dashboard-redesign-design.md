# 실시간 현황 재설계 — Phase 1 (좌측 main + 테이블)

**Date:** 2026-05-23
**Status:** Draft (pending user review)
**Scope:** `/dashboard` 루트 (실시간 현황) — 좌측 main panel만. 우측 sidebar는 Phase 2.
**Reference:** `design-ref/realtime_dashboard.html` (1306 lines)

## 1. Goal

레퍼런스의 운영 대시보드 시각 언어를 따라 실시간 현황을 재구성한다. **Phase 1**에선 레이아웃 + 좌측 main panel(헤더 / 대형 KPI 3 / 중소 그룹 / 정식 테이블)을 구현한다. 우측 sidebar (헬스·콘솔·시뮬레이터)는 Phase 2.

## 2. Motivation

기존 9 동일 타일 UI는 위계 부재로 "한눈에 안 들어옴." 레퍼런스는 **3 대형 카드(우선 도메인) + 중소 그룹(보조 지표) + 정식 테이블(이벤트 흐름)** 의 구조로, 운영 대시보드의 시각 정체성을 갖는다.

## 3. Layout (Phase 1)

```
┌ dashboard-container (max-w-1680px, gap-5) ──────────────────────┐
│ 헤더 (border-b 2px ink, padding-bottom 12px)                     │
│  ├─ 좌: "실시간 운영 현황" + [● LIVE MONITOR] (dot pulse 박스)    │
│  └─ 우: 세그먼트 토글 ["전체 관점" | "내 업무만"]                  │
│                                                                  │
│ main panel (full width — Phase 2에서 2-col grid의 좌측 3fr로)    │
│  ├─ 대형 KPI 3열 grid (gap-4)                                    │
│  │   [사고 카드]    [내 할일 카드]    [오픈 서비스 카드]         │
│  ├─ 중소 그룹 grid (gap-4)                                       │
│  │   [재정·영업 박스 — 2열 sub]  [시스템 리소스 박스 — 3열 sub]   │
│  └─ 필터 + 테이블                                                │
│      [전체 N][사고 N][할일 N][서비스 N][백업 N]                  │
│      ┌──── live-table ──────────────────────────┐                │
│      │ 구분 | 상태/구분 | 운영 이벤트 내역 |  시점 │                │
│      │ [badge] 미해결    결제 오류       방금 전 │                │
│      └────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

- 모바일 (≤ 1024px): main을 단일 컬럼 stack 그대로 (KPI grid → 1열, 중소 grid → 1열)
- Phase 2에서 위 main 컨테이너를 2-col grid wrapper로 감싸고 우측에 sidebar 추가 — 이 단계에선 main이 full width

## 4. 헤더 — `LivePageHeader` 재설계

```
┌────────────────────────────────────────────────────────────┐
│ 실시간 운영 현황   [● LIVE MONITOR]      [전체 관점|내 업무만] │
└────────────────────────────────────────────────────────────┘
```

- **타이틀**: `text-[22px] font-extrabold tracking-[-0.03em] text-ink`
- **LIVE 인디케이터** (박스): vermilion border + 옅은 vermilion bg(`bg-vermilion/5`) + 좌측 LED dot(6px) `bg-vermilion` + pulse 애니메이션 `1.8s ease-in-out infinite`
- **세그먼트 토글**: 외곽 `border border-ink`, 내부 두 버튼. active = `bg-ink text-cream`, inactive = transparent + ink. 호버 transition 0.15s
- 하단 border `border-b-2 border-ink` + `pb-3`
- URL `?mine=` 로직은 기존과 동일

## 5. 대형 KPI 카드 (3개) — `KpiCardLarge`

각 카드:

```
┌─ kpi-card (washi-raised bg, border-ink 1px, p-5, min-h-[140px]) ─┐
│ [라벨]                                  [trend-tag]              │  ← kpi-header
│                                                                  │
│ [큰 숫자 48px font-extrabold]    [sparkline 100×40 SVG]          │  ← kpi-body
│                                                                  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (border-t dashed line-soft)─ ─ ─ ─           │
│ [footer 12px text-ink-muted]                                     │  ← kpi-footer
└──────────────────────────────────────────────────────────────────┘
hover: -translate-y-0.5 + shadow-sm
```

### 5.1 사고 카드
- label "미해결 사고 현황"
- trend-tag "실시간 경보" (danger: vermilion border + text)
- 숫자: 미해결 사고 수 (= `incidents` where status !== "처리완료" total). **숫자 색 vermilion** (긴급)
- sparkline (SVG path, 정적 mock — 후속 단계에서 실데이터)
- footer "전체 관리 대상 중 즉각 조치 필요 건수"

### 5.2 내 할일 카드
- label "내 미완료 할 일"
- trend-tag "진행률 N%" (default: ink border)
- 숫자: undone count (= todos undone). 색 ink (neutral)
- 우측: 진행 게이지 — 작은 분수 표시 `"미완 / 전체"` + 가로 progress bar (배경 `line-soft`, 채움 `ink`, width = done/total %)
- footer "본인에게 배정된 미완료 티켓 수"

### 5.3 오픈 예정 서비스 카드
- label "오픈 예정 서비스"
- trend-tag "안정적 빌드" (default)
- 숫자: upcoming open count (현 `servicesUpcomingCount`). 색 ink
- sparkline (정적 mock, stroke ink)
- footer "배포 및 모니터링 준비 단계 서비스"

### 5.4 카운트업
- 큰 숫자에 마운트 시 0→target 카운트업 적용 (기존 CountUp 재사용)
- reduced-motion 가드 유지

### 5.5 Sparkline (`Sparkline` 컴포넌트)
- SVG path props: `points: [number, number][]` 또는 직접 `d` string
- 100×40 viewBox, stroke 2px round, `stroke-vermilion` (사고) 또는 `stroke-ink` (서비스). fill none
- Phase 1은 **정적 mock path** (레퍼런스 그대로). 추세 데이터 수집은 비범위

### 5.6 ProgressBar (`KpiProgressBar` 컴포넌트)
- width prop (0~100), bg `bg-line-soft`, fill `bg-ink`, height 6px, border 1px ink
- transition `width 0.6s cubic-bezier(0.16,1,0.3,1)`
- 상단에 라벨 `done / total` (font-bold 10px 우정렬)

## 6. 중소 보조 지표 (그룹화)

좌우 2개 그룹 박스, `grid-cols-[1fr_1.5fr]` 비율.

### 6.1 재정·영업 행정 (좌, 2열 sub)
- 박스: `border-ink bg-cream p-4`
- 섹션 타이틀 `재정 및 영업 행정` — 앞에 6px vermilion 정사각 dot
- subcards (2열):
  - **체결 계약**: label / 큰 숫자(26px) / 보조설명 "체결 진행중"
  - **미수 채권**: label / 큰 숫자 **vermilion** (active) / 보조설명 "미지급 고지 발송"

### 6.2 시스템 리소스 및 모니터링 (우, 3열 sub)
- 동일 박스 스타일
- subcards (3열):
  - **백업 대기**: count = backup count / 보조 "요청 처리건"
  - **기관 연락처**: count = contacts total / 보조 "등록된 파트너"
  - **일정 / 활동**: "{schedule} / {worklog}" 형식 (분수형) / 보조 "금주 잔여 건"

### 6.3 MetricSubcard 공통
- bg `washi-raised`, border `line-soft` 1px, p-3
- label 12px muted, value 26px font-bold tabular-nums, desc 11px muted
- hover: border ink + bg `washi`
- value `.active` 클래스 → text-vermilion

## 7. 필터 + 정식 테이블 (`LiveTable` + `FilterTabs`)

### 7.1 필터 탭 (`FilterTabs`)
- 전체 / 사고 / 할일 / 서비스 / 백업·일정 (5개) — 각 안에 건수 pill
- 비활성: transparent + `border-line-soft` + ink-soft
- 호버: `bg-washi-raised` + `border-ink`
- 활성: **vermilion bg + cream text** + vermilion border
- 우측 끝에 `필터링된 결과: N건 표시 중` (12px ink-muted)

### 7.2 LiveTable
- 외곽: `border border-ink bg-washi-raised`
- 열 4개:
  - **구분** (w-20) — 도메인 badge
  - **상태/구분** (w-24) — 도메인별 상태 텍스트 (font-medium ink-soft)
  - **운영 이벤트 내역 및 타이틀** (flex-1)
  - **발생 시점** (w-28, 우정렬, mono tabular, ink-muted)
- 헤더: `bg-washi`, `border-b border-ink`, 12px font-bold ink-soft
- 행: `border-b border-line-soft`, hover `bg-washi`
- 행 클릭 → 기존 InspectorPanel 슬라이드 (variant + listRow 전달, 기존 동작 유지)

### 7.3 도메인 Badge
- 표준 텍스트 라벨 + border 색상 차등
- 사고: vermilion (default)
- 할일: ink
- 서비스: ink-muted
- 백업: **indigo** — design-tokens.ts에 추가 필요 (`indigo: "#2a4365"`)
- 일정: **amber** — design-tokens.ts에 추가 필요 (`amber: "#d97706"`)

### 7.4 상태 텍스트 매핑
- 사고: status 그대로 (`미해결`/`처리중`/`처리완료`)
- 할일: due_at 변환 — D-N (overdue → `지남`, today=`오늘`, +N일=`D-N`), null=`대기`
- 서비스: write_start_at → "M.D 오픈"
- 백업: leave_start_date 또는 status
- 일정: start_at → "M.D"

### 7.5 발생 시점 (`formatRelativeTime` 유틸 신규)
- created_at 기반 상대 시간:
  - <1분 → `방금 전`
  - <60분 → `N분 전`
  - <24시간 → `N시간 전`
  - 그 외 → `N일 전`
- mono tabular-nums

## 8. 데이터 통합 (`page.tsx`)

기존 9 도메인 fetch는 거의 유지. 사고는 "미해결" 분리 카운트 필요 (현재 incidentsTotal은 전체).

### 8.1 카운트 산출
- `incidentsUnresolvedCount` = `incidents` where `status !== "처리완료"` (필요 시 별도 쿼리 또는 client filter)
- `todosDoneCount`, `todosTotalCount` (진행률 계산용)
- `worklogCount` = listWorklog total

### 8.2 통합 테이블 데이터
- 모든 도메인 행을 하나의 `LiveTableItem[]`로 병합
- 각 item: `{ id, domain, badgeLabel, badgeColor, statusText, title, occurredAt }`
- 정렬: occurredAt desc (최신순)
- cap: 50건 (필터 적용 후 표시)

### 8.3 KpiTileConfig 폐기, 새 타입 정의
- `KpiCardLargeConfig` (사고/할일/서비스 3개)
- `MetricSubcardConfig` (재정 2 + 시스템 3 = 5개)

## 9. 새/변경 컴포넌트 정리

### 신규
- `_components/live/LiveIndicator.tsx` — 박스+dot pulse LIVE 배지
- `_components/live/SegmentToggle.tsx` — 세그먼트 토글 (ScopeToggle 교체)
- `_components/live/KpiCardLarge.tsx` — 대형 KPI 카드
- `_components/live/Sparkline.tsx` — SVG sparkline
- `_components/live/KpiProgressBar.tsx` — 가로 progress
- `_components/live/MetricGroupBox.tsx` — 그룹 박스
- `_components/live/MetricSubcard.tsx` — sub 카드
- `_components/live/FilterTabs.tsx` — 필터 칩 (FeedChips 교체)
- `_components/live/LiveTable.tsx` — 정식 테이블
- `_components/live/DomainBadge.tsx` — 도메인 badge
- `_lib/format-relative-time.ts` — 상대 시간 유틸 + 테스트

### 변경
- `LivePageHeader.tsx` — 디자인 새로 (타이틀 폰트/굵기/LIVE 박스/세그먼트 토글)
- `LiveOverview.tsx` — 거의 다 재작성 (새 컴포넌트 합성, 단일 컬럼 main panel)
- `page.tsx` — 데이터 재구성 (KPI 3 / sub 5 / table merged rows)
- `lib/design-tokens.ts` — `indigo`, `amber` 토큰 추가

### 제거 (Phase 1에서 dead)
- `KpiTile.tsx` (작은 9 타일 컴포넌트 — 더 사용 안 함) + 테스트
- `FeedChips.tsx` — FilterTabs로 교체
- `FeedRow.tsx` — LiveTable로 교체

### 유지
- `CountUp.tsx` (KPI 카드 큰 숫자에 활용)
- `feed.ts` — buildFeedItems/sortFeedItems는 LiveTable 데이터 빌드용 재활용 가능 (또는 새 빌더로 리네임)
- `InspectorPanel/Chrome/ListBody` — 행 클릭 인스펙터 (기존 그대로)

## 10. 테스트 전략

- 순수 유틸:
  - `formatRelativeTime.test.ts` — 방금 전/N분/시간/일 4 케이스
  - 새 LiveTable 데이터 빌더 (`buildLiveTableItems`) — 도메인별 → row 변환
- 컴포넌트:
  - LiveIndicator (dot pulse 클래스 존재)
  - SegmentToggle (active/inactive, click → mine 토글)
  - KpiCardLarge (label/숫자/footer/trend tag 렌더)
  - Sparkline (SVG path 렌더)
  - KpiProgressBar (width 스타일 적용)
  - MetricGroupBox / MetricSubcard
  - FilterTabs (5 칩 + 건수 + active)
  - LiveTable (헤더 4열, 행 렌더, 빈 상태)
  - DomainBadge (5 색상 변종)
- 통합:
  - LiveOverview (필터 클릭 → 테이블 필터링, 행 클릭 → 인스펙터)
- 회귀: 전체 vitest 통과, build 성공

## 11. 비범위 (Phase 2 이후)

- 우측 사이드바 (시스템 게이트웨이 헬스 / 실시간 로그 콘솔 / 시뮬레이터·관리자 컨트롤)
- 토스트 알림
- 2-col grid (main + sidebar) — Phase 1에선 main만 full width
- 실데이터 sparkline 추세 수집
- 실시간 push (Supabase Realtime channel)
- 행 flash 애니메이션 (실시간 인입 시각화)
- API quota 등 mock 헬스 데이터

## 12. 디자인 토큰 추가

`lib/design-tokens.ts` + Tailwind config:
- `indigo`: `#2a4365`
- `amber`: `#d97706` (또는 amber-700 표준)

`.claude/rules/design.md` 절차 따라: tokens 정의 → tailwind.config.ts에서 노출 → 컴포넌트에서 클래스 사용 (`text-indigo`, `border-amber` 등). 하드코딩 헥스 금지.

## 13. 리스크 / 메모

- **Sparkline 정적 mock**: Phase 1에선 디자인 톤만 확보. 사용자가 "데이터가 실시간 변하는지"를 명시적으로 비교하지 않는 한 mock 유지 OK
- **incidents "미해결" 분리 카운트**: 현재 incidentsTotal은 전체. 새로 `listIncidents({ status: ["미처리", "처리중"], ... })` 또는 별도 카운트 쿼리 필요. 데이터 모델 변경 없음 (where clause만)
- **toast / pulse 애니메이션**: Tailwind `animate-pulse`는 기본 제공이지만 레퍼런스 keyframes는 box-shadow LED 효과까지 포함. 커스텀 keyframes를 `tailwind.config.ts`에 추가
- **세그먼트 토글 vs ScopeChips 일관성**: 다른 페이지의 ScopeChips와 디자인이 달라짐 — 실시간 현황은 운영 대시보드 톤이라 의도적 차별화. 다른 페이지는 그대로
- **KpiTile/FeedRow/FeedChips 제거**: dead 확인 후 안전 제거 (Phase 1 마지막 task)

## 14. Self-Review

- [x] 레퍼런스 HTML 핵심 요소 모두 반영 (Phase 1 범위 안에서)
- [x] 데이터 출처 명시 (mock vs 실데이터 구분)
- [x] 신규 컴포넌트 11개 + 변경 4개 + 제거 3개
- [x] 디자인 토큰 추가 명시 (indigo / amber)
- [x] 비범위 명시 (사이드바 / 토스트 / 실시간 push)
- [x] 리스크 4가지 명시
