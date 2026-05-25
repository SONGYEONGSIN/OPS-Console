---
plan_id: 20260525-020029-performance-report-menu
status: completed
created: 2026-05-25T02:00:29+09:00
completed: 2026-05-25T03:12:00+09:00
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260525-011311-performance-report-menu.md
merged_pr: 203
---

# Plan: 성과리포트 메뉴 — 8단계 평가 워크플로우

## Goal
`/dashboard/performance` 메뉴 신설. 8단계 평가 워크플로우(목표설정 → 실행계획 → 계획검토 → 중간점검 → 점검검토 → 자기평가 → 종합평가 → 완료)와 평가자/팀원 권한별 액션. 관리자가 시스템 한곳에서 평가 누적 관리·평가 수행.

## Approach
ListPattern + Inspector variant 신규(`performance`)로 기존 open/closed 아키텍처 재사용. 평가 사이클 1건 = ListRow 1건. 인스펙터 본문이 8단계 stepper. 권한별 액션은 단계×role 매트릭스로 자동 노출/잠금. 종합평가(step=7)에서 성과/역량 등급 2축(S/A/B/C/D) 입력.

## Out of Scope
- 가중치 server-side 자동 합산 (1차는 평가자 수동 종합)
- 연차별 평가 템플릿 가변 (`performance_templates` 테이블) — 1차는 2026 단일 하드코딩
- 평가 알림(종 dropdown 연동) — follow-up
- 평가 이력 차트 / 트렌드 분석 — follow-up

## 사용자 결정 (Open Questions 결과)

| Question | 결정 |
|----------|------|
| 평가 사이클 주기 | 8단계 자체가 사이클 단위. `name` 자유 텍스트(예: "2026 상반기") |
| 가중치 | 성과 80%(원서접수+PIMS 40 / 차세대 20 / 개인활동 20) + 관리자지표 20% 고정, 연차별 다른 기준 |
| 활동지표 소스 | worklog + services(me) + todos + my-ai-work + incidents 본인 자동 집계 |
| 임원/관리자 뷰 | 동일 페이지 admin 권한 분기 — 전체 리스트 + 핵심 카드 요약 |
| 인쇄 출력 | HTML 인쇄 라우트 (`/dashboard/performance/[id]/print`), 라이브러리 없음 |
| 평가 템플릿 | 2026 단일 하드코딩 |
| 평가 등급 | S/A/B/C/D × 2축(성과평가 / 역량평가). 종합평가 단계에서 평가자 입력 |

## 영향 파일 (~30개)

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260610_performance_cycles_table.sql` | 신규 | id/name/status/created_at + unique(name) |
| `supabase/migrations/20260610b_performance_cycles_rls.sql` | 신규 | SELECT all / INSERT·UPDATE admin |
| `supabase/migrations/20260611_performance_assignments_table.sql` | 신규 | cycle_id FK / evaluator_email / evaluatee_email / current_step 1-8 |
| `supabase/migrations/20260611b_performance_assignments_rls.sql` | 신규 | SELECT 본인관련 / INSERT admin / UPDATE admin OR evaluator |
| `supabase/migrations/20260612_performance_goals_table.sql` | 신규 | assignment_id FK / title / body / weight 0-1 |
| `supabase/migrations/20260612b_performance_goals_rls.sql` | 신규 | evaluator만 INSERT/UPDATE |
| `supabase/migrations/20260613_performance_plans_table.sql` | 신규 | goal_id FK / body |
| `supabase/migrations/20260613b_performance_plans_rls.sql` | 신규 | evaluatee만 INSERT/UPDATE |
| `supabase/migrations/20260614_performance_reviews_table.sql` | 신규 | step 3-7 / role enum / body / score / grade_performance / grade_competency |
| `supabase/migrations/20260614b_performance_reviews_rls.sql` | 신규 | step×role 매트릭스 INSERT 가드 |
| `src/features/performance/schemas.ts` | 신규 | zod 5 row 스키마 + STEP_VALUES + ROLE_VALUES + GRADE_VALUES + GRADE_DESCRIPTION_PERFORMANCE/COMPETENCY |
| `src/features/performance/permission.ts` | 신규 | canAct(step, role, user) 8×2 매트릭스 |
| `src/features/performance/queries.ts` | 신규 | listAssignmentsForUser / getAssignmentDetail / listAssignmentsAdmin |
| `src/features/performance/activity-aggregator.ts` | 신규 | 5 도메인 본인 활동 합산 |
| `src/features/performance/actions.ts` | 신규 | createGoal / submitPlan / submitReview / advanceStep |
| `src/features/performance/__tests__/schemas.test.ts` | 신규 | enum / weight / grade 검증 |
| `src/features/performance/__tests__/permission.test.ts` | 신규 | 16 매트릭스 케이스 |
| `src/features/performance/__tests__/queries.test.ts` | 신규 | user vs admin 분기 |
| `src/features/performance/__tests__/actions.test.ts` | 신규 | 권한 가드 + advanceStep + grade 입력 |
| `src/features/performance/__tests__/activity-aggregator.test.ts` | 신규 | 5 도메인 합산 fixture |
| `src/app/dashboard/_components/inspector/list-variants/performance/Stepper.tsx` | 신규 | 8단계 시각 stepper |
| `src/app/dashboard/_components/inspector/list-variants/performance/View.tsx` | 신규 | stepper + 단계별 본문 + grade 배지 |
| `src/app/dashboard/_components/inspector/list-variants/performance/EditForm.tsx` | 신규 | 권한별 입력 + step=7 grade select |
| `src/app/dashboard/_components/inspector/list-variants/performance/Table.tsx` | 신규 | 평가자/팀원/현재 단계/진척률 컬럼 |
| `src/app/dashboard/_components/inspector/list-variants/performance/filters.ts` | 신규 | 필터 + blankPerformanceRow |
| `src/app/dashboard/_components/inspector/list-variants/registry.ts` | 수정 | performance 1 entry |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | 수정 | Variant union +1 |
| `src/app/dashboard/performance/page.tsx` | 신규 | ListPattern variant=performance + admin 분기 |
| `src/app/dashboard/performance/[id]/print/page.tsx` | 신규 | chrome 없는 인쇄 전용 |
| `src/app/dashboard/performance/[id]/print/layout.tsx` | 신규 | 인쇄 톤 CSS + A4 |
| `src/app/dashboard/_data.ts` | 수정 | 사이드바 '성과 리포트' 항목 |
| `src/app/dashboard/_data/page-meta-config.ts` | 수정 | performance 헤드라인/설명 |
| `supabase/seeds/2026_h1_performance.sql` | 신규 (devonly) | 2026 H1 시드 cycle + 2 assignments |
| `e2e/performance.spec.ts` | 신규 | smoke — 평가자 step=1 등록 |

## 단계

### Phase A — DB 마이그 + RLS

#### T1: performance_cycles 테이블 마이그
- 상태: pending / 파일: 20260610_*.sql / DoD: `\d performance_cycles` 5 컬럼 + unique(name) / 의존: 없음

#### T2: performance_cycles RLS + GRANT
- 상태: pending / DoD: pg_policies 4행 / 의존: T1

#### T3: performance_assignments 테이블 (current_step 1-8 check)
- 상태: pending / DoD: 8 컬럼 + unique(cycle_id,evaluatee_email) + 트리거 / 의존: T1

#### T4: performance_assignments RLS
- 상태: pending / DoD: SELECT 본인관련만 노출 수동 확인 / 의존: T3

#### T5: performance_goals 테이블 + RLS
- 상태: pending / 의존: T3

#### T6: performance_plans 테이블 + RLS
- 상태: pending / 의존: T5

#### T7: performance_reviews 테이블 + RLS (step×role 매트릭스 + grade 2 컬럼)
- 상태: pending / 의존: T3

### Phase B — features TDD

#### T8: schemas RED + GREEN (zod 5 + GRADE_DESCRIPTION_* 2)
- 상태: pending / 의존: T1-T7

#### T9: permission RED + GREEN (16 매트릭스)
- 상태: pending / 의존: T8

#### T10: activity-aggregator RED + GREEN (5 도메인 합산)
- 상태: pending / 의존: T8

#### T11: queries RED + GREEN (user/admin 분기)
- 상태: pending / 의존: T9

#### T12: actions RED + GREEN — createGoal + advanceStep
- 상태: pending / 의존: T11

#### T13: actions RED + GREEN — submitPlan / submitReview (+ grade)
- 상태: pending / 의존: T12

### Phase C — 인스펙터 variant skeleton

#### T14: types.ts Variant union 확장 (1줄)
- 상태: pending / 의존: 없음

#### T15: Table + filters
- 상태: pending / 의존: T14

#### T16: Stepper 컴포넌트
- 상태: pending / 병렬 가능

#### T17: View — Stepper + 본문 + grade 배지
- 상태: pending / 의존: T16

#### T18: EditForm — 권한별 입력 + step=7 grade select + 가이드라인 tooltip
- 상태: pending / 의존: T13, T17

#### T19: registry.ts 1 entry
- 상태: pending / 의존: T14, T15, T17, T18

### Phase D — 페이지 + 사이드바 + 메타

#### T20: /dashboard/performance/page.tsx — admin 분기
- 상태: pending / 의존: T11, T19

#### T21: 사이드바 + searchItems 동기
- 상태: pending / 의존: T20

#### T22: page-meta-config 추가
- 상태: pending / 의존: T20

### Phase E — admin 핵심 카드 + 인쇄

#### T23: admin 핵심 카드 요약 (페이지 상단)
- 상태: pending / 의존: T20

#### T24: /performance/[id]/print 라우트 + layout
- 상태: pending / 의존: T20

#### T25: 인쇄 톤 CSS (A4 + 흑백 + 페이지 분할)
- 상태: pending / 의존: T24

### Phase F — 시드 + smoke E2E

#### T26: 2026 시드 SQL
- 상태: pending / 의존: T7

#### T27: E2E smoke — 평가자 step=1 등록
- 상태: pending / 의존: T20, T26

## 리스크
1. RLS step×role 매트릭스 누락 — performance_reviews INSERT 가드 16건 테스트 필수
2. current_step 트랜지션 동시성 — `update where current_step = expected_prev` optimistic lock
3. 권한 매트릭스 FE/BE 불일치 — RLS + zod+actions 이중화
4. 활동지표 자동 집계 정확성 — 1차는 단순 합계, 환산식은 사용자 검토 후
5. 인쇄 페이지 chrome 누락 — `print/layout.tsx`로 DashboardShell 분리
6. 사이드바 outcomes placeholder 치환 — `searchItems.ts` 동기 갱신

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-25T02:00:29+09:00 | — | plan created | 사용자 합의 후 저장 |
| 2026-05-25T03:12:00+09:00 | Phase A~E | completed | PR #203 머지(81612df) — 8단계 평가 워크플로우 본체. 후속 AdminSummary 톤 4 커밋(730e0c0/572a794/b1b6d32/5c611e1)으로 마무리. Out of Scope(가중치 자동합산·템플릿 가변·평가 알림·차트)는 별도 follow-up |
