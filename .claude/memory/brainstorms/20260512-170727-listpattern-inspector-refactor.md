# Brainstorm: ListPattern + InspectorListBody 컴포지션 추출 리팩토링

작성 일시: 2026-05-12 17:07 KST
세션 컨텍스트: 2026-05-12 마라톤 (PR #45~#74) 종료 직후. main `813cc8b`, working tree clean.

## 의도

- **산출물**: `ListPattern.tsx` (1217줄)과 `InspectorListBody.tsx` (2176줄)의 거대 variant 분기를 variant-specific 컴포넌트로 분해. 두 파일 모두 800줄 상한 이하로 슬림화.
- **사용자**: 향후 새 도메인 메뉴를 추가하는 본인. 새 variant 추가 시 거대 파일 한 곳에 분기 row 추가가 아닌 자기 도메인 파일만 추가하도록 (open/closed).
- **트리거**: variant 9개 도달(default + team + post-feedback + post-notice + schedule + my-todo + cohort + receivables + ai-work). 부채 시급도 ↑로 마킹. 다음 도메인 추가 시 2400줄 가까이 도달 위험.
- **성공 기준** (측정 가능):
  1. `ListPattern.tsx` ≤ 800줄, `InspectorListBody.tsx` ≤ 800줄
  2. 9 페이지(notices/team/feedback/posts/schedule/my-todo/cohort/receivables/ai-work)에서 unit + e2e 회귀 0
  3. `/verify` 통과 (lint + typecheck + unit + e2e + 콘솔 에러 0)
  4. 새 variant 추가 비용 < 기존(1 파일 신규 + dispatcher 1줄 매핑 추가)

## 제약

### 기술
- **RSC 직렬화 경계**: 이번 세션 학습 1 — `(row) => ReactNode` 같은 함수 prop은 RSC 호환 불가. variant-component 매핑은 import-time static dispatcher여야 함 (런타임 함수 prop 금지).
- **클라이언트 컴포넌트 경계**: `"use client"` 지시문이 ListPattern/InspectorListBody에 있음. 변경 후에도 동일 boundary 유지.
- **테스트 구조**: `ListPattern.test.tsx`, `InspectorListBody.test.tsx`, `InspectorImprovementBody.test.tsx`, `InspectorDashBody.test.tsx`, `InspectorPanel.test.tsx` 존재. 분할 시 테스트도 같이 분할.

### 비즈니스
- **production-running 9 도메인**: 회귀 0 절대 보장. 사용자가 매일 사용하는 운영 페이지.
- **시간**: 단일 마라톤 세션이 아닌 분할 작업이 안전 (큰 PR 회귀 위험 ↑).

### 코드베이스
- **기존 스타일**: 단일 거대 파일 + variant 분기. 추출 방향은 `src/app/dashboard/_components/inspector/InspectorXxxBody.tsx` 패턴 답습 가능(이미 4 \*Body 파일 존재 — Dash/List/Improvement/Panel).
- **`src/app/dashboard/_components/patterns/`**: ListPattern 외 GuidePattern 존재. 추출 위치 후보로 `patterns/list/{variant}.tsx` 또는 `inspector/variants/{variant}.tsx`.
- **callers**: 9 페이지에서 직접 사용. `[slug]/page.tsx`의 dynamic dispatcher도 있어 variant 추가/제거 영향이 광범위.

## 대안 비교

### 대안 A — 한 PR로 일괄 variant 추출 (big-bang)
- 핵심: 8 variants를 한 번에 별도 컴포넌트로 추출. ListPattern + InspectorListBody는 variant → component 매핑 dispatcher로 슬림화.
- 비용: 단일 PR ~20+ 파일 변경 (16 신규 + 2 슬림 + 2 dispatcher + 테스트 분할).
- 위험: 회귀 발생 시 원인 격리가 8 variant 어디서든 가능 — 디버깅 부담 ↑.
- 가역성: 낮음 (구조 자체가 바뀜, 단일 revert 가능하지만 손실 큼).
- 학습 효과: 한 번에 패턴 확립. 다음 variant 추가 비용 ↓.

### 대안 B — Phase 단위 점진 분할 (incremental, **추천**)
- 핵심: 1 variant씩 추출. PR #1: cohort 추출 → PR #2: receivables → ... PR #8까지. 각 PR이 1 variant + dispatcher 업데이트만.
- 비용: 8 PR + cumulative review. 각 PR은 ~3~5 파일 (인라인 설계 등급).
- 위험: 낮음 — 한 번에 1 variant만 변경. 회귀 시 PR 단위 revert로 격리.
- 가역성: 높음 (각 PR 단독 revert).
- 학습 효과: variant 분리 패턴이 PR #1에서 확립, 이후 8 PR이 동일 패턴 반복으로 안정성 ↑.

### 대안 C — config-only 추출 (UI는 그대로)
- 핵심: variant별 차이가 status label / column / 권한 위주라면 `variant-config.ts`에 매핑 객체로 분리. ListPattern/InspectorListBody의 render 코드는 유지.
- 비용: 작음 (1~2 파일).
- 위험: 800줄 상한 미해결 — UI/render 분기(InspectorListBody의 2176줄 대부분 = JSX)는 여전 한 파일에 남음. 부채 시급도 ↑ 미해결.
- 가역성: 높음.
- 학습 효과: 적음.

### 대안 Z — do nothing
- variant 10개 → 2400+ 줄. 다음 도메인 추가 시 한 파일 한계 명확.
- 임시 우회책 없음 (모듈 분리만이 해결).
- 단기 영향: 새 도메인 추가 비용 ↑ + 단일 파일 RSC 직렬화 함정 위험 누적.

## 추천 + 근거

**추천: 대안 B (Phase 단위 점진 분할)**

선택 근거:
1. **회귀 위험 최소화** — 9 페이지가 production-running. 1 variant 단위 PR이면 회귀 발생 시 격리가 명확. squash merge 정책 하에서도 단일 변수.
2. **TDD 친화** — variant별로 RED → GREEN → REFACTOR 사이클을 명확히 적용 가능. 기존 unit 테스트(`ListPattern.test.tsx`, `InspectorListBody.test.tsx`)를 분할해서 함께 이동. 각 variant 테스트가 독립.
3. **PR 리뷰 부담 분산** — 큰 PR 1개(약 20+ 파일)보다 작은 PR 8개(각 3~5 파일)가 머지 친화적. HARD-GATE도 각 PR이 "인라인 설계" 등급 수준으로 떨어짐.
4. **CrumbBar 5회 시행착오 학습** — 이번 세션 학습 2: "매번 한 변수만 만지지 말고 옵션 명확히 묻고 시작". B는 첫 PR에서 패턴 명확히 정의 후 8회 반복이라 학습에 부합.

**기각된 대안 A**: 한 번에 8 variants 옮기면 회귀 발생 시 원인 격리 어려움. 단, 만약 첫 1-2 variant 추출 후 패턴이 명확히 안정되면 마지막 2-3 variant는 묶음 머지로 가속 가능 (B → A 부분 전환 옵션).

**기각된 대안 C**: 800줄 상한 미해결로 부채 시급도 ↑ 항목 미해소. config 추출은 B의 일부로 자연스럽게 포함될 수 있음 (variant별 label/options/status를 각 variant 파일이 own).

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260512-170727-listpattern-inspector-refactor.md`
- HARD-GATE 등급:
  - **전체 epic**: 20+ 파일 → 전체 설계 (Planner 에이전트 필수)
  - **개별 PR**: 3~5 파일 → 인라인 설계 등급
- 권장 next skill: **`/plan`** — Phase 단위 분할 + 각 phase별 RED-GREEN-REFACTOR 사이클을 plan으로 분해
- 의존성: 첫 PR(예: cohort 또는 ai-work — 가장 분리도 명확한 variant)로 패턴을 확립한 뒤 나머지 7 variants는 동일 패턴 반복

## Phase 우선순위 후보 (plan에서 확정 예정)

| Phase | Variant | 추출 우선 근거 |
|------|---------|---------------|
| 1 | **cohort** | 신규 variant, 가장 격리도 높음 — onInvite 함수 prop만 의존. 패턴 확립 PR로 적합. |
| 2 | **receivables** | onUpdateRemarks + receivablesMailDryRun + SendReceivablesMailButton 의존. 외부 컴포넌트 분리도 명확. |
| 3 | **ai-work** | AI_TOOL_LABEL/OPTIONS/TONE + CATEGORY_LABEL/OPTIONS/TONE 등 constants 명확 격리. |
| 4 | **team** | currentUserPermission + OPERATORS + PERMISSION_LABEL — 권한 로직 격리. |
| 5 | **schedule** | scheduleType filter + 시프트 라벨(주간/오전/오후 history) 격리. |
| 6 | **my-todo** | filter 로직 격리. |
| 7 | **post-feedback** | postStatusLabel/Keys + NOTICE/FEEDBACK_STATUS_KEYS 격리. |
| 8 | **post-notice** | post-feedback과 짝. 두 variant는 같은 PR 가능. |
| (final) | **default** + dispatcher 정리 | 슬림화 마무리 + 800줄 검증 |
