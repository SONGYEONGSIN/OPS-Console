---
plan_id: 20260512-171323-listpattern-inspector-refactor
status: in_progress
created: 2026-05-12T08:13:23Z
hard_gate: full
source: brainstorm:20260512-170727-listpattern-inspector-refactor.md
---

# Plan: ListPattern + InspectorListBody 컴포지션 추출 리팩토링

## Goal

`ListPattern.tsx` (1217줄)과 `InspectorListBody.tsx` (2176줄)을 800줄 상한 이하로 분해. 8 variant 분기를 variant-specific 컴포넌트 + import-time registry로 추출하여 새 도메인 추가 시 open/closed 원칙 충족.

**측정 가능 성공 기준**:
1. 두 파일 모두 ≤ 800줄
2. 9 페이지 (notices/team/feedback/posts/schedule/my-todo/cohort/receivables/ai-work) 회귀 0
3. `/verify` 통과 (lint + typecheck + unit + e2e + 콘솔 에러 0)
4. 새 variant 추가 비용 = 1 디렉토리 신설 + registry 1줄

## Approach

**대안 B (Phase 단위 점진 분할)** — 각 variant를 별도 PR로 추출. 8 Phase 순차 진행. 첫 PR(cohort)에서 패턴 확립 후 7회 반복. 추출 패턴은 **import-time static registry** (RSC 직렬화 함정 회피, PR #47 학습).

디렉토리:
- `src/app/dashboard/_components/inspector/list-variants/<variant>/{View,EditForm}.tsx`
- `src/app/dashboard/_components/patterns/list/<variant>.tsx`
- `src/app/dashboard/_components/inspector/list-variants/registry.ts` + `patterns/list/registry.ts`

## Out of Scope

- ListPattern/InspectorListBody 외 다른 Inspector body 파일(Dash/Improvement/Panel) 변경
- `[slug]/page.tsx` dispatcher 변경 — variant 문자열 그대로 전달 유지
- variant 로직 자체 개선 (drive-by refactor 금지, 컨테이너 위치만 이동)
- `@/lib/ai-work/constants` 등 외부 모듈 이동
- production 트래픽이 있는 다른 도메인의 인접 리팩토링

## 영향 파일 (전체 epic 누적)

| 파일 | 변경 유형 | Phase |
|------|----------|-------|
| `inspector/list-variants/types.ts` | 신규 | 1 |
| `inspector/list-variants/registry.ts` | 신규 | 1, 점진 누적 |
| `inspector/list-variants/{cohort,receivables,ai-work,team,schedule,my-todo,post,default}/{View,EditForm}.tsx` | 신규 (총 16) | 1~8 |
| `patterns/list/registry.ts` | 신규 | 4, 점진 누적 |
| `patterns/list/shared.ts` | 신규 | 5, 점진 누적 |
| `patterns/list/{team,schedule,my-todo,post,default}.tsx` | 신규 (총 5) | 4~8 |
| `inspector/InspectorListBody.tsx` | 수정 (점진 슬림화) | 1~8 |
| `patterns/ListPattern.tsx` | 수정 (점진 슬림화) | 4~8 |
| `__tests__/list-variants/<variant>.test.tsx` | 신규 (8개) | 1~8 |
| `__tests__/list/<variant>.test.tsx` | 신규 (5개) | 4~8 |
| `InspectorListBody.test.tsx`, `ListPattern.test.tsx` | 수정 | 1~8 |

**총 ~40+ 신규/수정 파일** (분산: 8 PR × 5~7 파일/PR)

## Phase 의존성

```
Phase 1 (cohort, 패턴 확립)
  └→ Phase 2 (receivables)
       └→ Phase 3 (ai-work)
            └→ Phase 4 (team, +ListPattern-side registry 신설)
                 └→ Phase 5 (schedule, +shared.ts 신설)
                      └→ Phase 6 (my-todo)
                           └→ Phase 7 (post-feedback + post-notice 짝, 1 PR)
                                └→ Phase 8 (default + ≤800줄 검증)
```

**병렬화 비추천**: 순차 진행이 안전. 이유 (1) Phase 1 패턴 확립 후 2~3은 기계적 복사, (2) Phase 4가 ListPattern-side 첫 도입, (3) shared.ts 점진 누적 import 충돌 회피.

## 단계 (Phase 1 상세, Phase 2~8 요약)

### Phase 1 — cohort 추출 (패턴 확립용 PR)

#### T1.1: shared types 신설
- **상태**: pending
- **파일**: `inspector/list-variants/types.ts` (신규)
- **변경**: `Variant` union (8 키 + `"default"`) + `ViewProps` / `EditFormProps` 공통 타입
- **DoD**: `npm run typecheck` 통과
- **의존**: 없음

#### T1.2: cohort 테스트 작성 — RED
- **상태**: pending
- **파일**: `inspector/__tests__/list-variants/cohort.test.tsx` (신규)
- **변경**: `<InspectorListBody variant="cohort" editing={false} />` View 어서션 + `editing={true}` EditForm 필드 + onInvite 콜백 호출
- **DoD**: `npm test -- cohort.test.tsx` 실행 → import path 미존재로 **실패** (RED 확인)
- **의존**: T1.1

#### T1.3: CohortView 이동 — GREEN 1/2
- **상태**: pending
- **파일**: `inspector/list-variants/cohort/View.tsx` (신규), `inspector/InspectorListBody.tsx` (수정)
- **변경**: `CohortView` 함수 본체 + `inviteBadgeLabel/Class` 헬퍼 + `formatCohortRange` 이동. InspectorListBody는 import 경로만 변경, 분기 로직 유지
- **DoD**: cohort.test.tsx의 View 케이스 GREEN + 기존 InspectorListBody.test.tsx cohort 어서션 GREEN
- **의존**: T1.2

#### T1.4: CohortForm 이동 — GREEN 2/2
- **상태**: pending
- **파일**: `inspector/list-variants/cohort/EditForm.tsx` (신규), `inspector/InspectorListBody.tsx` (수정)
- **변경**: `CohortForm` 함수 + onInvite prop signature 유지
- **DoD**: cohort.test.tsx EditForm 케이스 GREEN
- **의존**: T1.3

#### T1.5: registry 도입 — REFACTOR
- **상태**: pending
- **파일**: `inspector/list-variants/registry.ts` (신규), `inspector/InspectorListBody.tsx` (수정)
- **변경**: `export const variantRegistry = { cohort: { View: CohortView, EditForm: CohortForm } } as const`. ViewMode/EditMode dispatcher에서 `variantRegistry[variant]?.View ?? <fallback if-else>` 패턴. cohort 외 7개는 기존 fallback 유지
- **DoD**: `grep "CohortView\|CohortForm" inspector/InspectorListBody.tsx` → 0 hits + 전 unit 테스트 GREEN
- **의존**: T1.4

#### T1.6: 회귀 검증 + commit
- **상태**: pending
- **파일**: 없음 (검증만)
- **변경**: `npm run lint && npm run typecheck && npm test` 풀 패스. 브라우저 콘솔 에러 0 (cohort 페이지 스모크 시 가능하면).
- **DoD**: 모든 명령 exit 0
- **의존**: T1.5
- **commit msg**: `refactor: InspectorListBody cohort variant 분리 — list-variants registry 도입`

---

### Phase 2 — receivables 추출

T2.1~T2.6 = Phase 1과 동일 사이클. 추가: `pickSchoolOwnerEmail`/`elapsedDays`/`toISODateInput` 헬퍼 함께 이동, SendReceivablesMailButton dry-run 모드 e2e (`receivables.spec.ts`) 검증 1단계 추가.

### Phase 3 — ai-work 추출

T3.1~T3.6 = 동일 사이클. `AI_TOOL_OPTIONS`/`CATEGORY_OPTIONS` 등 `@/lib/ai-work/constants` import는 신규 컴포넌트에서 그대로 사용 (constants 이동 X — surgical).

### Phase 4 — team 추출 (+ ListPattern-side registry 첫 도입)

T4.1~T4.7 (확장):
- T4.1: `patterns/list/registry.ts` 신설 (table 분기용)
- T4.2: team 테스트 RED (`__tests__/list/team.test.tsx` + `__tests__/list-variants/team.test.tsx`)
- T4.3: team 테이블 이동 (`patterns/list/team.tsx`)
- T4.4: TeamView/TeamForm 이동 (inspector 측)
- T4.5: 양쪽 registry에 team 매핑 추가
- T4.6: ListPattern + InspectorListBody의 team 분기 제거
- T4.7: 회귀 + commit (권한 select admin only 회귀 e2e 필수)

### Phase 5 — schedule 추출 (+ `patterns/list/shared.ts` 신설)

T5.1~T5.7: `Filter` 타입 + `SCHEDULE_TYPE_LABEL/COLOR` + `formatScheduleRange` 헬퍼를 `shared.ts`로 신설 이동. 이후 Phase 6/7이 이 shared 활용.

### Phase 6 — my-todo 추출

T6.1~T6.6: `MY_TODO_FILTERS`, `formatDueAt`, `todayKstKey/kstDateKey`를 shared.ts에 누적 추가.

### Phase 7 — post-feedback + post-notice 짝 (한 PR)

T7.1~T7.7: `post/View.tsx`가 `postVariant` prop으로 분기. registry에 2개 키로 동일 컴포넌트 매핑. `postStatusLabel/Keys` export는 shared.ts로 이동 + ListPattern.tsx에서 re-export 보존 (호출처 grep 후 결정).

### Phase 8 — default 슬림화 + ≤800줄 검증 (epic 마무리)

T8.1~T8.5:
- T8.1: default 테스트 RED (양쪽)
- T8.2: ServiceView + 기본 post 폼 + default 테이블 이동
- T8.3: registry에 default 키 + fallback 로직 제거 — 분기 사다리 완전 제거
- T8.4: **800줄 검증** — `wc -l` 두 파일 모두 ≤ 800
- T8.5: `/verify` 풀 사이클 + 9 도메인 e2e 전체

## 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| RSC 직렬화 함정 재발 (PR #47 학습) | 9 페이지 SSR 깨짐 | registry는 import-time static binding만. inline factory(`(row) => <X/>`) 금지. 각 Phase RED 테스트에 SSR `renderToString` 어서션 권장 |
| 9 페이지 회귀 (production-running) | 운영 중단 | Phase별 e2e 해당 도메인 spec 통과 필수. `[slug]/page.tsx` 디스패처는 변경 0 |
| post-feedback/post-notice 짝 처리 | 라벨 혼동 | Phase 7에서 한 PR + `describe("post-feedback")` + `describe("post-notice")` 분리 어서션 |
| default 조기 슬림화 | 잔여 variant 추출 중 default 의미 변화 | default는 반드시 Phase 8 마지막 |
| `postStatusLabel/Keys` export 깨짐 | 빌드 깨짐 | Phase 7 전 `grep -rn "postStatusLabel\|postStatusKeys" src/` 호출처 확인, shared.ts 이동 + re-export 보존 |
| shared.ts 점진 누적 충돌 | Phase 5/6 중복 이동 | Phase별 PR 본문에 shared.ts 이동 헬퍼 명시. Phase 시작 시 grep 확인 |
| 테스트 어서션 중복 | InspectorListBody.test.tsx와 list-variants 측 중복 | Phase별 후반에 기존 InspectorListBody.test.tsx의 해당 variant 케이스를 **이동** (복사 X). 오케스트레이터 테스트는 dispatcher 라우팅 1줄만 |
| Drive-by refactor 유혹 | Scope creep, 회귀 영역 ↑ | Surgical change 엄수 — phase = variant 1개 + registry 1줄만 |
| ListPattern blank factory (590~676줄) | Phase 8 800줄 미달 가능성 | Phase 4의 team 추출 시 `blankRow.ts` 신설 시작. 각 phase에서 본인 variant blank만 이동 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-12T08:13:23Z | (plan) | created → in_progress | brainstorm spec 기반 |
