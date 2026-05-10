---
plan_id: 20260510-172500-onboarding-cohorts
status: in_progress
created: 2026-05-10T17:25:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260510-172000-onboarding-cohorts.md
---

# Plan: onboarding 회차(cohorts) 관리

## Goal

`/dashboard/onboarding`을 mock fallback에서 회차 관리 페이지로 전환. admin이 신입 합류 시 회차를 생성하고 상태(계획/진행/완료) 추적, 본인(trainee)·사수(mentor)는 read. 회차 상세(세션)는 후속 epic.

## Approach

schedule + todos 패턴 미러링하되 RLS는 `admin OR trainee_email = me OR mentor_email = me`. ListPattern은 default variant 재활용 (cohort row를 name/status/owner로 매핑) — variant 7 도달 회피, 후속 sessions epic까지 컴포지션 리팩토링 미룸. 회차 상세는 placeholder.

## Out of Scope

- onboarding_sessions 테이블 / 첨부 이미지 그리드 UI (후속 epic)
- 템플릿 자동 생성 / 평가 / 피드백 / 알림
- ListPattern 컴포지션 리팩토링 (variant 6 도달 후 sessions 추가 시점에 결정)

## 영향 파일

| 파일 | 변경 | 설명 |
|---|---|---|
| `supabase/migrations/20260515_onboarding_cohorts_table.sql` | 신규 | 테이블 + 시드 + 인덱스 + 트리거 |
| `supabase/migrations/20260515b_onboarding_cohorts_rls.sql` | 신규 | RLS 4정책 + GRANT |
| `src/features/onboarding/schemas.ts` | 신규 | row/create/update zod + status enum |
| `src/features/onboarding/queries.ts` | 신규 | `listCohorts()` |
| `src/features/onboarding/actions.ts` | 신규 | create/update/delete |
| `src/features/onboarding/__tests__/schemas.test.ts` | 신규 | zod RED |
| `src/features/onboarding/__tests__/queries.test.ts` | 신규 | mock |
| `src/features/onboarding/__tests__/actions.test.ts` | 신규 | 시그니처 |
| `src/app/dashboard/onboarding/page.tsx` | 신규 | RSC + onPersist |
| `src/app/dashboard/onboarding/[id]/page.tsx` | 신규 | placeholder |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 (선택) | ListRow에 cohort 도메인 필드 추가 |
| `src/app/dashboard/_components/inspector/InspectorListBody.tsx` | 수정 | cohort 편집 폼 (default variant에 trainee/mentor/dates 추가) |
| `e2e/onboarding.spec.ts` | 신규 (T9) | 권한 분기 |
| `scripts/cleanup-test-cohorts.mjs` | 신규 (T9) | `[E2E]` cleanup |

총 14파일. 분할: PR-A(백엔드+페이지) / PR-B(e2e).

## 단계

### T1: schemas RED
- **파일**: `src/features/onboarding/__tests__/schemas.test.ts`
- **DoD**: vitest fail (모듈 없음)
- **의존**: 없음

### T2: schemas GREEN
- **파일**: `src/features/onboarding/schemas.ts`
- **DoD**: T1 통과
- **의존**: T1

### T3: 마이그레이션 — 테이블 + 시드
- **파일**: `supabase/migrations/20260515_onboarding_cohorts_table.sql`
- **변경**: id/title/trainee_email/mentor_email/start_date/end_date/status/notes + 트리거 + 인덱스. 시드: 김지나 사원 회차 1건 (예: trainee=kjn@..., mentor=ys1114@..., start=2026-05-14, status='in_progress')
- **DoD**: SQL Editor 실행 후 select count = 1
- **의존**: 없음 (T1과 병렬)

### T4: 마이그레이션 — RLS + GRANT
- **파일**: `supabase/migrations/20260515b_onboarding_cohorts_rls.sql`
- **변경**: select/insert/update/delete = `is_admin() OR trainee_email = jwt email OR mentor_email = jwt email`. (insert는 admin only로 좁힐지 — 일단 동일 정책으로 단순화, UI에서 admin만 작성 버튼 노출)
- **DoD**: pg_policies 4정책
- **의존**: T3

### T5: queries + actions + 시그니처 테스트
- **파일**: `queries.ts`, `actions.ts`, `__tests__/queries.test.ts`, `__tests__/actions.test.ts`
- **변경**: listCohorts (created_at desc) / create/update/delete + canCreate (admin only — 작성은 admin 강제)
- **DoD**: vitest GREEN + tsc OK
- **의존**: T2, T4

### T6: ListRow 확장 + InspectorListBody cohort 폼
- **파일**: `ListPattern.tsx` (ListRow type), `InspectorListBody.tsx`
- **변경**: ListRow에 `traineeEmail / mentorEmail / startDate / endDate` 추가. InspectorListBody에 cohort 편집용 fields (default variant 폼에 동적 추가 또는 새 분기). 단순화: 변경 없이 default variant로 매핑하고 폼은 default variant 그대로 (cohort 전용 fields는 후속에 추가).
- **결정**: 본 epic에서는 default variant 재활용 — InspectorListBody 변경 최소. trainee/mentor는 owner/leader 등 기존 필드에 매핑.
- **DoD**: typecheck OK
- **의존**: T2

### T7: page.tsx + meta + 상세 placeholder
- **파일**: `src/app/dashboard/onboarding/page.tsx`, `src/app/dashboard/onboarding/[id]/page.tsx`, `__tests__/page.test.tsx`, `_data/page-meta-config.ts` (description)
- **변경**: 리스트 RSC + onPersist. 상세는 "세션 관리 후속 epic" placeholder. meta description.
- **DoD**: dev에서 시드 1건 표시
- **의존**: T5, T6

### T8: PR-A 분할 머지 + SQL 실행 + dev 검증
- **DoD**: dev에서 admin 작성·수정·삭제 / 신입 read
- **의존**: T7

### T9: e2e
- **파일**: `e2e/onboarding.spec.ts`, `scripts/cleanup-test-cohorts.mjs`
- **변경**: admin 작성 / 무관 사용자 read 차단 시나리오
- **DoD**: 통과
- **의존**: T8

### T10: /verify
- **DoD**: 0 에러
- **의존**: T9

DAG: T1→T2, T3→T4, T2+T4→T5, T2→T6, T5+T6→T7→T8→T9→T10. T1·T3 병렬.

## 리스크

- **R1 default variant 재활용 한계**: cohort 전용 필드(trainee/mentor/dates) 표시·편집이 default variant에 부족. 본 epic은 owner=trainee 이름으로 매핑하고 dates는 meta로 표시. 충분치 않으면 T6에서 cohort variant 신설 결정.
- **R2 RLS 자기참조**: trainee가 본인 회차 update 가능하면 본인이 mentor 변경 시도 등 위험. update에서는 본인이 trainee 또는 mentor일 때 read만 허용해도 충분 — 본 epic은 update도 본인 허용(단순화) 후 후속 가다듬기.
- **R3 신입 합류 시점 동기화**: 시드 김지나 회차 trainee_email은 operators 테이블에 김지나가 존재해야 RLS 통과. operators 시드 확인.

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T17:25:00Z | plan | created | brainstorm 20260510-172000 기반, 첨부 이미지 분석 결과 sessions은 후속 epic |
| 2026-05-10T17:33:00Z | T6 변경 | revise | default variant 재활용 → cohort variant 신설로 변경 (admin SQL 의존 회피, variant 7 도달) |
