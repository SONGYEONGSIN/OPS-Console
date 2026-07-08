---
plan_id: 20260708-073000-outcomes-perf-report-redesign
status: completed
created: 2026-07-08T07:30:00Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260708-072000-outcomes-perf-report-redesign.md
---

# Plan: 성과리포트 재설계 — 관리자 중심 AI 성과 측정

## Goal
관리자 중심 4단계 워크플로우(목표→실행계획+성과지표(가중치합80%)→정량자동집계+관리자루브릭(20%)→리포트). MVP 정량 3종(서비스마감·사고·AI작업). 최종 = 성과80%+관리20% → 등급.

## Approach
기존 cycles/assignments/goals/plans 재사용 + 신규 2테이블(performance_metrics, performance_rubric_scores). aggregator 레지스트리 패턴. reviews는 legacy 방치(신규 흐름 미사용). STEP 8→4.

## Out of Scope
- 월간 스냅샷 영속 테이블(2차), 계약체결·todos 등 4~5번째 소스(2차)
- reviews(step3~7) 신규 흐름 사용
- 김유정(operators 미매칭) → 로그+스킵, silent fallback 금지

## 영향 파일 (신규 9 / 수정 11)
| 파일 | 유형 |
|------|------|
| migrations performance_metrics + RLS | 신규 |
| migrations performance_rubric_scores + RLS | 신규 |
| features/performance/aggregators/{registry,closing,incidents,ai-work}.ts | 신규 |
| features/performance/scoring.ts | 신규 |
| __tests__/{aggregators,scoring}.test.ts | 신규 |
| schemas.ts / actions.ts / queries.ts / permission.ts | 수정 |
| list-variants/performance/{View,EditForm,Stepper,filters}.tsx | 수정 |
| outcomes/page.tsx / [id]/print/page.tsx | 수정 |

## 단계

### T1: REVALIDATE 경로 버그 수정
- 상태: done / 파일 actions.ts / DoD grep 일치 / 의존 없음
### T2: [RED] scoring 테스트
- 상태: pending / DoD 실패 확인 / 의존 없음
### T3: scoring.ts 구현
- 상태: pending / DoD T2 GREEN / 의존 T2
### T4: [RED] aggregator 3소스 테스트
- 상태: pending / DoD 실패 확인 / 의존 없음
### T5: registry + closing/incidents/ai-work aggregator
- 상태: pending / DoD T4 GREEN / 의존 T4
### T6: metric/rubric zod + STEP 1~4
- 상태: pending / DoD typecheck / 의존 없음
### T7: 마이그 2테이블 + RLS
- 상태: pending / DoD SQL apply·RLS admin분기 / 의존 T6
### T8: createMetric/upsertRubric/publishReport 액션
- 상태: pending / DoD 가중치검증 호출 / 의존 T3,T6
### T9: queries 집계 조인
- 상태: pending / DoD 상세 반환 / 의존 T5,T7
### T10: EditForm 실액션 배선
- 상태: pending / DoD placeholder 제거 / 의존 T8
### T11: View 3섹션 + Stepper 4단계
- 상태: pending / DoD 렌더 확인 / 의존 T9
### T12: print 최종 리포트 + 등급
- 상태: pending / DoD 발행 렌더 / 의존 T11

## 리스크
1. operator 이름 매칭 16/17(김유정 미매칭) → 로그+스킵
2. 가중치 합=0.8 부동소수 → 정수(80) 저장/epsilon
3. STEP 8→4: reviews legacy 방치 (합의됨)
4. RLS 신규 2테이블 admin+본인 read 분기 필수

## 진행 추적
| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-07-08T07:30:00Z | plan | created | full gate, 12 steps |
