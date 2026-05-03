---
plan_id: 20260501-115500-realtime-status-index
status: completed
created: 2026-05-01T02:55:00Z
completed: 2026-05-01T05:48:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260501-115500-realtime-status-index.md
---

# Plan: 실시간 현황 (/dashboard index) 페이지 구성

## Goal

`/dashboard` index를 IT-ops 서비스 리스트 → 운영부 도메인 종합 실시간 현황 (에디토리얼 신문 톤)으로 전면 교체. 입실 직후 3초 내 우선 행동 파악 + Folio 정체성(washi/낙관/Pretendard) 시각화 + 47 메뉴 진입점.

## Approach

Bottom-up bite-sized: leaf 컴포넌트 → mock 데이터 → page.tsx 조립 → e2e 정합. 각 컴포넌트는 RED-GREEN 단위 테스트로 검증. 시계 의존(ShiftTimeline)은 fake date 모킹. design-lint hook이 단계별 하드코딩 색상 차단.

## Out of Scope

- Supabase 실데이터 연결 (별도 epic)
- 47 메뉴 다른 페이지 디테일 (이번 PR은 index 한정)
- 모바일 시안 fine-tuning (lg breakpoint stack 변환만)
- Action queue (대안 B 보류)

## 영향 파일

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `src/app/dashboard/_data/patterns.ts` | 추가 | dashboardActivities/shiftEvents/dashboardHeadline export |
| `src/app/dashboard/_components/index/SectionLabel.tsx` | 신규 | 공통 kicker (server) |
| `src/app/dashboard/_components/index/Masthead.tsx` | 신규 | 마스트헤드 (server) |
| `src/app/dashboard/_components/index/Lede.tsx` | 신규 | 큰 헤드라인 (server) |
| `src/app/dashboard/_components/index/TriageList.tsx` | 신규 | 알림 4건 (server) |
| `src/app/dashboard/_components/index/ProjectEntry.tsx` + `ProjectGrid.tsx` | 신규 | 12 프로젝트 (server) |
| `src/app/dashboard/_components/index/ShiftTimeline.tsx` | 신규 | 시프트 진행도 (client) |
| `src/app/dashboard/_components/index/OnCallPanel.tsx` | 신규 | 1차/2차 온콜 (server) |
| `src/app/dashboard/_components/index/ActivityColumn.tsx` | 신규 | 활동 column (server) |
| `src/app/dashboard/page.tsx` | 전면 교체 | server component, 7 zone 조립 |
| `e2e/dashboard.spec.ts` | 갱신 | services 어설션 → masthead/lede 어설션 |

## 단계

### T1: mock 데이터 확장
- 상태: pending
- 파일: `src/app/dashboard/_data/patterns.ts`
- 변경: `dashboardActivities`(15건 `{time, who, act}`), `shiftEvents`(5~7건 `{at, label}`), `dashboardHeadline`(`{lede, urgentCount}`) export 추가
- DoD: import 타입 체크 통과
- 의존: 없음

### T2: SectionLabel
- 상태: pending
- 파일: `_components/index/SectionLabel.tsx` + 테스트
- 변경: `<SectionLabel kicker="..." />` 공통 kicker 컴포넌트
- DoD: vitest RED→GREEN 통과
- 의존: 없음

### T3: Masthead
- 상태: pending
- 파일: `_components/index/Masthead.tsx` + 테스트
- 변경: 발행일자/요일/vol 표시, design tokens 사용
- DoD: "OPSROOM 일간" + "vol." 토큰 어설션 통과
- 의존: T2

### T4: Lede
- 상태: pending
- 파일: `_components/index/Lede.tsx` + 테스트
- 변경: dashboardHeadline.lede props로 큰 한 줄, vermilion accent
- DoD: 헤드라인 문자열 + 토큰 색상 어설션
- 의존: T1

### T5: TriageList
- 상태: pending
- 파일: `_components/index/TriageList.tsx` + 테스트
- 변경: alertsWidgets에서 urgent 4건 추출 컴팩트 리스트
- DoD: urgent 4건 노출 어설션
- 의존: T2

### T6: ProjectEntry + ProjectGrid
- 상태: pending
- 파일: `_components/index/ProjectEntry.tsx`, `ProjectGrid.tsx` + 테스트
- 변경: projectMap 12개 한 줄 카드 grid
- DoD: 12개 entry 렌더 어설션
- 의존: T2

### T7: ShiftTimeline
- 상태: pending
- 파일: `_components/index/ShiftTimeline.tsx` (client) + 테스트
- 변경: 14~22 KST 세로축 + shiftEvents 마커 + vermilion ink 진행. **vi.setSystemTime 모킹**으로 16:30 시점 진행도 검증
- DoD: 모킹된 시각에서 진행도 정확히 계산
- 의존: T1

### T8: OnCallPanel
- 상태: pending
- 파일: `_components/index/OnCallPanel.tsx` + 테스트
- 변경: OPERATORS에서 1차/2차 운영자 표시
- DoD: 운영자 이름 2건 어설션
- 의존: T2

### T9: ActivityColumn
- 상태: pending
- 파일: `_components/index/ActivityColumn.tsx` + 테스트
- 변경: dashboardActivities 15건 typographic feed
- DoD: 15건 렌더 어설션
- 의존: T1, T2

### T10: page.tsx 전면 교체
- 상태: pending
- 파일: `src/app/dashboard/page.tsx`
- 변경: server component, services/Inspector 제거, 7 zone(A~G) 조립. lg 좌측 main+우측 rail, sm stack
- DoD: dev에서 /dashboard 렌더 + design-lint 0 위반
- 의존: T3, T4, T5, T6, T7, T8, T9

### T11: e2e 어설션 갱신
- 상태: pending
- 파일: `e2e/dashboard.spec.ts`
- 변경: services 어설션 제거 → masthead/lede/12 프로젝트 grid 어설션 추가
- DoD: npm run e2e 통과
- 의존: T10

### T12: 통합 검증
- 상태: pending
- 변경: tsc/lint/test/e2e/design-audit 4개 명령
- DoD: 0 에러
- 의존: T11

## 리스크

- **시계 모킹** (T7): vi.setSystemTime 누락 시 결과 비결정 — RED 단계에서 명시 필수
- **하드코딩 색상**: design-lint hook 실시간 차단. design-tokens.ts에 vermilion 키 이미 존재 확인됨 (사전 점검 완료)
- **e2e 단절** (T10~T11): 같은 PR 내 묶어 GREEN 보장
- **layout.tsx 셸 충돌**: T10 시작 전 layout 그리드 컨테이너 1회 검토

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-01T02:55:00Z | plan | created | brainstorm 기반 |
| 2026-05-01T05:48:00Z | T1~T12 | all done | 201 단위테스트 통과, lint 0 errors, typecheck 0 errors |
| 2026-05-01T05:48:00Z | plan | completed | dev 서버 시각 확인 + e2e 실행은 사용자 측 검증 단계로 위임 |
