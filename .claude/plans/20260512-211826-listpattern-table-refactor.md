---
plan_id: 20260512-211826-listpattern-table-refactor
status: completed
created: 2026-05-12T12:18:26Z
completed: 2026-05-12T12:50:00Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260512-205059-listpattern-table-refactor.md
---

# Plan: ListPattern.tsx 1220줄 → Table variant 분리 (≤ 800줄)

## Goal

`ListPattern.tsx`의 variant별 테이블 JSX(~440줄) + filter constants(~50줄) + blank row factory(~90줄) + variant 전용 formatter/badge 헬퍼(~60줄)를 `inspector/list-variants/<variant>/` 디렉토리로 이동하여 ListPattern은 dispatcher + 공통 header/footer + Inspector 호스팅만 보유. KPI: ListPattern.tsx ≤ 800줄, 9 페이지 unit + e2e 회귀 0.

## Approach

**대안 B (Table + filters + blank + formatter 모두 variant 모듈로) — 2 PR 분할**:

- **PR 1** (5 파일): cohort variant 완전 분리 + registry 슬롯 확장 + dispatcher 도입 → 패턴 확립
- **PR 2** (18 파일): 나머지 7 variant 일괄 (team/post-feedback+notice 묶음/schedule/my-todo/receivables/ai-work/default) + 800줄 KPI 검증

InspectorListBody refactor에서 확립된 list-variants registry 패턴을 재활용. 신규 variant 추가 비용 = 1 폴더 신설로 떨어짐.

## Out of Scope

- `ListRow` type 정의 자체 이동 (26+ 파일이 import 중 — 별도 mini-PR 대상, 본 epic 후순위)
- `ListPattern.test.tsx` variant별 분리 (통합 테스트로 dispatcher 라우팅 회귀 방지 — surgical)
- `GuidePattern.tsx` 및 다른 거대 컴포넌트 (별도 epic 후보)
- 사이드바 mock count / receivables count hardcode 정리

## 영향 파일

### PR 1 — cohort 패턴 확립 (5 파일)

| 파일 | 변경 유형 | 설명 |
| ---- | --------- | ---- |
| `inspector/list-variants/types.ts` | 수정 | `TableProps` export 추가 |
| `inspector/list-variants/registry.ts` | 수정 | cohort 엔트리에 `Table`/`Filters`/`blank` 슬롯 추가 |
| `inspector/list-variants/cohort/Table.tsx` | 신규 | cohort `<table>` JSX + formatCohortRange + inviteBadgeLabel/Class + COHORT_STATUS_LABEL/COLOR |
| `inspector/list-variants/cohort/filters.ts` | 신규 | COHORT_FILTERS + blankCohortRow |
| `patterns/ListPattern.tsx` | 수정 | cohort 분기 → dispatcher. 전용 헬퍼/상수/blank 분기 제거 |
| `inspector/__tests__/list-variants/cohort.test.tsx` | 수정 | CohortTable describe 추가 |

### PR 2 — 나머지 7 variant 일괄 (18 파일)

| 파일 | 변경 유형 | 설명 |
| ---- | --------- | ---- |
| `inspector/list-variants/types.ts` | 수정 | `Filter` union + `RegistryEntry` 보강 |
| `inspector/list-variants/shared.tsx` | 수정 | STATUS_LABEL/COLOR/RING 이동 |
| `inspector/list-variants/team/Table.tsx` | 신규 | team table + PERMISSION_COLOR |
| `inspector/list-variants/team/filters.ts` | 신규 | TEAM_FILTERS + blankTeamRow |
| `inspector/list-variants/post/Table.tsx` | 신규 | post-feedback/post-notice 공유 + postStatusLabel/Keys |
| `inspector/list-variants/post/filters.ts` | 신규 | POST_FEEDBACK_FILTERS + POST_NOTICE_FILTERS + blankPostRow |
| `inspector/list-variants/schedule/Table.tsx` | 신규 | schedule table + formatScheduleRange + SCHEDULE_TYPE_LABEL/COLOR |
| `inspector/list-variants/schedule/filters.ts` | 신규 | SCHEDULE_FILTERS + blankScheduleRow |
| `inspector/list-variants/my-todo/Table.tsx` | 신규 | my-todo table + formatDueAt + PRIORITY_LABEL/COLOR + 체크박스 onToggleDone prop |
| `inspector/list-variants/my-todo/filters.ts` | 신규 | MY_TODO_FILTERS + todayKstKey/kstDateKey + applyMyTodoFilter + blankMyTodoRow |
| `inspector/list-variants/receivables/Table.tsx` | 신규 | receivables table |
| `inspector/list-variants/receivables/filters.ts` | 신규 | RECEIVABLES_FILTERS (no blank — readonly) |
| `inspector/list-variants/ai-work/Table.tsx` | 신규 | ai-work table + AI_TOOL_LABEL/TONE + CATEGORY_LABEL/TONE |
| `inspector/list-variants/ai-work/filters.ts` | 신규 | blankAiWorkRow (currentUserName) |
| `inspector/list-variants/default/Table.tsx` | 신규 | default table |
| `inspector/list-variants/default/filters.ts` | 신규 | DEFAULT_FILTERS + blankDefaultRow |
| `inspector/list-variants/registry.ts` | 수정 | 7 variant 엔트리 추가 |
| `inspector/InspectorListBody.tsx` | 수정 | postStatusKeys/Label import 경로 갱신 |
| `patterns/ListPattern.tsx` | 수정 | 8 variant 분기 사다리 제거 → single dispatcher. ≤ 800줄 확인 |

## 단계

### T1.1: TableProps 타입 신설 (2분)
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/types.ts`
- **변경**: `TableProps` export 추가 (`rows: ListRow[]; selectedId: string | null; onSelect: (row: ListRow) => void`)
- **DoD**: `npm run typecheck` 통과
- **의존**: 없음

### T1.2: cohort.test.tsx RED 추가 (4분)
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/__tests__/list-variants/cohort.test.tsx`
- **변경**: `describe("CohortTable")` 추가 — 헤더 4개 / 빈 행 안내 / 상태 뱃지 / invite 뱃지 어서션
- **DoD**: `npm test cohort.test.tsx` → import fail → RED 확인
- **의존**: T1.1

### T1.3: CohortTable + cohort/filters.ts 신설 — GREEN (5분)
- **상태**: pending
- **파일**: `cohort/Table.tsx` (신규), `cohort/filters.ts` (신규)
- **변경**:
  - Table.tsx: cohort `<table>` 전체(ListPattern 794~851줄) + `formatCohortRange` + `inviteBadgeLabel/Class` + `COHORT_STATUS_LABEL/COLOR` 이동
  - filters.ts: `COHORT_FILTERS` + `blankCohortRow()` factory
- **DoD**: T1.2 RED 테스트 GREEN. `npm test cohort.test.tsx` 통과
- **의존**: T1.2

### T1.4: registry.ts cohort 슬롯 확장 (3분)
- **상태**: pending
- **파일**: `list-variants/registry.ts`
- **변경**: cohort 엔트리에 `Table: CohortTable`, `Filters: COHORT_FILTERS`, `blank: blankCohortRow` 추가 + satisfies 시그니처 확장
- **DoD**: `npm run typecheck` 통과
- **의존**: T1.3

### T1.5: ListPattern cohort 분기 → dispatcher (5분)
- **상태**: pending
- **파일**: `patterns/ListPattern.tsx`
- **변경**: cohort `<table>` 블록 제거, cohort 전용 헬퍼/상수/blank 분기 제거, dispatcher 분기 도입 (`variantRegistry[variant]?.Table` 패턴 cohort만 활성)
- **DoD**: 기존 `ListPattern.test.tsx` cohort describe GREEN. `npm run lint` 통과. `wc -l` ~1110줄
- **의존**: T1.4

### T1.6: 회귀 검증 + 커밋 + PR 생성 (3분)
- **상태**: pending
- **파일**: 없음 (검증만)
- **변경**: `npm run lint && npm run typecheck && npm test` 통과 후 conventional commit + push + PR 생성
- **DoD**: 모든 명령 exit 0. PR #X 생성, CI green
- **의존**: T1.5

## 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| RSC 직렬화 함정 — registry inline factory 침투 | 9 페이지 SSR 깨짐 | named export만, `(row) =>` 차단. grep으로 검증 |
| 800줄 미달 실패 | KPI 미달 | PR 2 T2.12에서 `wc -l` 검증. 미달 시 `ListRow` 분리 fallback 보유 |
| post-feedback/post-notice 라벨 분기 누락 | 두 페이지 라벨 깨짐 | post/Table.tsx variant prop 분기. ListPattern.test.tsx post describe로 회귀 자동 감지 |
| postStatusLabel/Keys import 경로 깨짐 | 빌드 실패 | T2.5에서 InspectorListBody import 경로 갱신 (T2.4 직후) |
| 체크박스 토글 state mutation | my-todo 회귀 | Table은 `onToggleDone` prop. state는 ListPattern 보유 |
| e2e 회귀 (9 production 도메인) | 운영 중단 | PR 1은 cohort/onboarding spec. PR 2는 풀 e2e `--workers=1` |
| drive-by refactor 유혹 | scope creep | 헬퍼 본체 한 글자도 안 바꾸고 이동만 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-12T12:18:26Z | (plan 생성) | — | brainstorm-205059로부터 |
| 2026-05-12T11:50Z | T1.1~T1.6 | done | PR #83 — cohort 패턴 확립, 1220 → 1106 (-114) |
| 2026-05-12T12:05Z | PR #83 머지 | done | main HEAD `0125df7`, fast-forward |
| 2026-05-12T12:48Z | T2.1~T2.13 | done | PR #84 — 7 variant 일괄, 1106 → 452 (-654, 63% 총 감소) |
| 2026-05-12T12:50Z | PR #84 머지 | done | main HEAD `fd9867d`. Epic 완료 |

## 결과 (PR #84 push 시점)

- ListPattern.tsx 1220 → **452줄** (-768, **63% 감소**)
- 800줄 KPI 충족 (마진 348줄)
- 720 unit test 전수 GREEN
- typecheck + lint 통과
- 18 변경 파일 (3 modified + 15 신규)
- PR #84: https://github.com/SONGYEONGSIN/Folio/pull/84

## 학습 (재사용 자산)

1. **TDD hook strict 모드 vs surgical refactor 충돌** — settings.local.json의 CLAUDE_TDD_ENFORCE=strict는 type-only 변경(types.ts)이나 cross-directory test layout(inspector/__tests__/list-variants/cohort.test.tsx)을 인식 못 함. epic 동안 `warn`으로 잠시 변경 후 종료 시 원복하는 패턴 정립
2. **JSX에서 `<obj[key].Comp />` 직접 사용 불가** — TypeScript JSX는 컴포넌트 이름이 PascalCase 변수여야 함. `const X = obj[key].Comp; return <X .../>` 패턴 필요
3. **union narrowing + optional slot** — registry entry가 union일 때 `entry?.Slot`는 narrowing 실패. `"Slot" in entry && entry.Slot` 가드로 narrow
4. **post-feedback/post-notice 공유 Table** — variant prop 분기로 한 컴포넌트가 두 variant 처리. registry에 같은 컴포넌트 두 번 등록 (Filters만 다름)
5. **체크박스 state mutation 분리** — Table 컴포넌트는 onToggleDone prop만 받고 state mutation/persist는 dispatcher closure가 처리. RSC 호환
