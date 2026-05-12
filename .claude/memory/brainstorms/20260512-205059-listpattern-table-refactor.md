# Brainstorm: ListPattern.tsx 1220줄 → Table variant 분리

작성 일시: 2026-05-12 20:51 KST
세션 컨텍스트: PR #75~#82 모두 머지 완료. main `fac5578`. InspectorListBody는 800줄 충족, ListPattern은 미손 상태.

## 의도

- **산출물**: `ListPattern.tsx` (1220줄)의 variant별 테이블 렌더 분기(~440줄)와 부속 helper(filter constants / blank row 생성 / formatter)를 variant 디렉토리로 분리. ListPattern.tsx ≤ 800줄.
- **사용자**: 본인. 새 도메인 메뉴(variant) 추가 시 단일 거대 파일 한 곳에 분기 row 추가가 아니라 자기 도메인 폴더만 신설/확장하도록 (open/closed).
- **트리거**: 이전 세션(2026-05-12) InspectorListBody refactor epic이 800줄 충족하며 종료. ListPattern은 epic 범위였으나 부분 완료. 같은 디렉토리(`list-variants/`)에 패턴이 이미 확립돼 있어 ROI 높음.
- **성공 기준** (측정 가능):
  1. `ListPattern.tsx` ≤ 800줄 (현재 1220, ~420줄 절감 필요)
  2. 9 페이지(notices/team/feedback/posts/schedule/my-todo/cohort/receivables/ai-work) unit + e2e 회귀 0
  3. `/verify` 통과 (lint + typecheck + unit + e2e)
  4. 새 variant 추가 비용: 1 디렉토리 신설 + registry 1줄 + dispatcher 영향 0줄

## 제약

### 기술
- **RSC 직렬화 경계**: 함수 prop(`(row) => ReactNode`)으로 component를 넘기지 않는다. registry는 import-time static binding (기존 `registry.ts` 패턴 답습).
- **클라이언트 컴포넌트 경계**: `"use client"` 유지. variant Table 파일도 클라이언트 컴포넌트.
- **테스트 구조**: `ListPattern.test.tsx` 존재. variant 분리 시 테스트도 같이 분리하거나 행위 기반 통합 테스트 유지 — 어떻게 분할할지 plan에서 결정.
- **InspectorListBody refactor 학습**: PR #75~#78 cohort/receivables/ai-work/team 4 variant가 이미 list-variants 디렉토리에 존재. 같은 디렉토리에 `Table.tsx`만 추가하는 게 최소 침습.

### 비즈니스
- **production-running 9 도메인**: 매일 사용. 회귀 0 절대 보장.
- **시간**: stacked PR 4개 임계점(메모리) 학습 — 5+ stacked PR 누적은 epic 조기 종료 트리거. ListPattern은 8 variants이므로 한 PR로 묶거나 2~3 PR로 압축 필요.

### 코드베이스
- **기존 list-variants 디렉토리**: `cohort/`, `receivables/`, `ai-work/`, `team/` 4개. 신규 5개 필요 (`default/`, `post-feedback/`, `post-notice/`, `schedule/`, `my-todo/`).
- **post-feedback / post-notice**: 동일 Table JSX를 공유 (variant prop으로 분기). 한 파일에 둘 다 처리 가능.
- **default variant**: ListPattern과 InspectorListBody 양쪽에 default 케이스가 있지만 InspectorListBody는 default를 별도 디렉토리로 분리 안 함. ListPattern Table도 default까지 분리 vs default는 inline 유지 선택 가능.
- **filter constants 8개** (TEAM_FILTERS, POST_FEEDBACK_FILTERS, ...): variant별 ~5줄씩. 총 ~50줄. Table과 같이 이동 또는 별도 phase로 분리 가능.
- **blank row 생성 분기** (create button onClick 안): ~90줄. variant 모듈로 함께 이동하면 ListPattern가 더 슬림.
- **formatter helpers** (formatCohortRange, formatDueAt, formatScheduleRange, inviteBadgeLabel/Class): ~60줄. 이미 cohort/schedule/my-todo variant 전용이라 함께 이동 자연.

## 대안 비교

### 대안 A — Table만 분리 (최소 침습, **추천**)
- 핵심: variant별 큰 `<table>` JSX만 `list-variants/<variant>/Table.tsx`로 추출. registry.ts에 Table 슬롯 추가. filter constants / blank row / formatter는 ListPattern에 남김.
- 비용: 신규 5 디렉토리(default 포함 시) + 9 Table.tsx 파일 + registry 9줄 + types.ts에 TableProps 추가 + ListPattern dispatcher.
- 절감 추정: ~440줄 (variant table JSX) → ListPattern 1220 - 440 + dispatcher ~40 = **~820줄** (800 상한 살짝 초과 가능).
- 위험: 800 상한 마진 좁음. filter constants(~50줄) 함께 이동하면 ~770줄로 안전. plan에서 보충 단계 추가.
- 가역성: 높음 (각 variant Table 독립).
- 학습 효과: InspectorListBody 패턴과 1:1 대응. 일관성 ↑.

### 대안 B — Table + filter constants + blank row + formatter 모두 variant 모듈로
- 핵심: variant 1 디렉토리에 모든 variant-specific 로직 집결. Table.tsx + filters.ts + blank.ts + formatter.ts. 진정한 open/closed.
- 비용: A의 +20% (file count 증가). 신규 variant 추가는 더 명확한 single-folder operation.
- 절감 추정: ~600줄 → ListPattern ~660줄. 마진 충분.
- 위험: filter constants는 단순 상수라 분리 ROI 낮음. blank row는 useState 안에서 호출돼 import 경로만 변경. 큰 위험 없음.
- 가역성: 높음.
- 학습 효과: 높음. registry 슬롯이 늘어남(Table/Filters/blankRow) — 다음 variant 추가 시 더 일관적.

### 대안 C — Big-bang 한 PR (모든 8 variant Table + 부속 helper 일괄)
- 핵심: 단일 PR로 전체 refactor. patterns이 이미 InspectorListBody에서 확립되어 위험 낮음.
- 비용: 단일 PR ~20 파일 변경. 머지 후 회귀 격리 어려움.
- 위험: 하나 깨지면 전체 revert. 그러나 동일 패턴 반복이라 발생 가능성 낮음.
- 가역성: 낮음 (PR 단위 revert).
- 학습 효과: 빠른 결착. stacked PR 부담 0.

### 대안 D — Phase 단위 점진 분할 (InspectorListBody와 동일)
- 핵심: variant 1개씩 PR. 8 PR.
- 비용: 8 PR + cumulative review.
- 위험: stacked PR 4개 임계점 학습 위배. 부담 큼.
- 가역성: 매우 높음.
- 학습 효과: 이미 InspectorListBody에서 학습 완료 — 다시 8회 반복은 ROI 낮음.

### 대안 Z — do nothing
- 다음 variant 추가 시 ListPattern 1400+ 줄 도달. 다음 epic 재방문 비용 ↑.
- 임시 우회책 없음.

## 추천 + 근거

**추천: 대안 B (Table + filter constants + blank row + formatter 모두 variant 모듈로) — 단일 PR 또는 2 PR로 압축**

선택 근거:
1. **800줄 상한 마진 확보** — 대안 A는 800줄 상한 살짝 초과 가능성. B는 ~660줄로 안전. 이미 ListPattern 1220줄이 부담스럽다는 신호이므로 충분히 줄이는 게 본질적 ROI.
2. **InspectorListBody 패턴과 1:1 대응** — variant 디렉토리에 InspectorListBody용 `View/EditForm`이 이미 존재. 같은 곳에 `Table.tsx` + 부속 추가하면 한 variant의 모든 UI/로직이 한 폴더에 모임. 새 도메인 추가 시 단일 폴더 신설로 끝.
3. **stacked PR 회피** — 대안 D는 InspectorListBody에서 이미 학습 완료한 반복(8 PR). 메모리 학습("Stacked PR 4개 임계점")에 따라 단일 PR 또는 2 PR로 압축이 자연스러움. 같은 패턴 반복이라 회귀 위험 낮음.
4. **filter constants / blank row 분리 ROI 높음** — filter constants는 variant-specific identity (어떤 필터를 보여줄지). 분리하면 새 도메인 추가 시 ListPattern을 안 건드림. blank row는 variant-specific schema 초기값. 같은 이유.

**기각된 대안 A**: 800줄 상한 마진 좁음. ListPattern 본문이 dispatcher + 공통 header만 남는 게 본질적 정리.
**기각된 대안 C**: 8 variant + 부속 helper 일괄은 너무 큼. 적어도 패턴 확립 PR 1개 + 일괄 PR 1개로 안전 마진 확보.
**기각된 대안 D**: stacked PR 임계점 학습 위배. InspectorListBody에서 이미 4 PR로 패턴 정립된 상태라 굳이 8회 반복할 필요 없음.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260512-205059-listpattern-table-refactor.md`
- HARD-GATE 등급:
  - **전체 epic**: 15~20 파일 → **간략 설계** (`/plan` 권장) or **전체 설계** (Planner 에이전트)
  - **개별 PR**: ~10 파일 → 간략 설계
- 권장 next skill: **`/plan from-brainstorm <이 파일>`** — 2~3 phase 분할
- 의존성: 패턴 확립 phase(예: cohort/receivables Table 추출 + registry 슬롯 확장) → 나머지 7 variant 묶음 phase → 검증

## Phase 우선순위 후보 (plan에서 확정 예정)

| Phase | 범위 | 추출 우선 근거 |
|------|------|---------------|
| 1 | **패턴 확립**: registry 확장(Table/Filters/BlankRow 슬롯) + cohort variant 1개 완전 분리(Table+filters+blank+formatter) + dispatcher 도입 | 가장 격리도 높음 (onInvite + cohortStatus). 패턴 검증 |
| 2 | **나머지 7 variant 일괄**: team / receivables / ai-work / schedule / my-todo / post-feedback / post-notice / default Table + 부속 일괄 분리 | 패턴 1에서 확립 후 동일 반복 → 회귀 위험 낮음 |
| 3 (선택) | **default variant 정리** + ListPattern 잔여 정리(공통 header/footer만 남기기) | 800줄 검증, 부속 dead code 제거 |

또는 Phase 1+2 합쳐 단일 PR도 가능 — plan 단계에서 risk/시간 trade-off 재평가.

## 보조 정보

- **InspectorListBody refactor 학습 (직전 세션)**:
  - import-time static binding (registry.ts 패턴) — RSC 호환
  - shared.tsx (Section/DefList/Divider) — 공통 UI
  - useState(prop) 비교 패턴 (React Compiler 룰 — useEffect+setState 금지)
- **CI 잠복 에러 우선 처리**: main CI 빨강 상태 누적되면 stacked PR 모두 차단. 시작 전 main HEAD CI 통과 확인.
- **stacked PR 4개 임계점**: 5+ 누적 시 epic 조기 종료. 이번 epic은 1~2 PR 목표.

## 미진 / 백로그 (다음 epic 후보)

- ListPattern 외 GuidePattern.tsx 등 다른 거대 컴포넌트 점검 (확인 필요)
- 사이드바 mock 도메인 count hardcode 잔존
- receivables count hardcode 7건 (Excel 외부)
