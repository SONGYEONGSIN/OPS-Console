# Brainstorm: InspectorListBody 787줄 → 4 variant View/EditForm 분리

작성 일시: 2026-05-13 KST
세션 컨텍스트: PR #83+#84+#85 머지 직후. main HEAD `669dfd5`. ListPattern epic 종료. InspectorListBody는 800 임박(787).

## 의도

- **산출물**: `InspectorListBody.tsx`(787줄)에 inline으로 남아있는 4 variant (post/schedule/my-todo/default)의 View/EditForm을 `list-variants/<variant>/`로 분리. ≤ 600줄 목표 (가능하면 ~400).
- **사용자**: 본인. 다음 variant 또는 form 변경 시 800줄 상한 초과 회피 + 일관된 list-variants 디렉토리 구조 유지.
- **트리거**: ListPattern epic 종료 직후 자연 follow-up. 800 마진 13줄로 임박. 메모리 시드의 부채성 백로그 명시.
- **성공 기준**:
  1. `InspectorListBody.tsx` ≤ 600줄
  2. 9 페이지 unit + e2e 회귀 0
  3. 720 unit test GREEN 유지
  4. registry 4 variant 신규 슬롯 (post/schedule/my-todo/default의 View/EditForm) 등록

## 제약

### 기술
- **RSC 직렬화 경계**: import-time static binding 유지 (registry 패턴 답습)
- **클라이언트 컴포넌트**: 모든 View/EditForm은 `"use client"` 유지 (form input/state 보유)
- **shared.tsx + status.ts 재사용**: 기존 Section/DefList/Divider + STATUS_LABEL/COLOR/RING 활용

### 비즈니스
- **production-running 9 도메인**: 회귀 0 절대 — feedback / notices / schedule / my-todo / 기타 default variant 페이지
- **stacked PR 4개 임계점 학습**: 1~2 PR로 압축

### 코드베이스
- **inline form 의존성**: post EditForm은 `OPERATORS`(@/features/auth/operators), `STATUS_BADGE`, `postStatusKeys/Label` 사용 — post/Table.tsx에 이미 있음. 본거지 공유 가능
- **ScheduleForm은 isoToLocalKst/localKstToIso 헬퍼 의존 (KST 변환)** — schedule/EditForm.tsx로 함께 이동
- **ServiceView는 default variant의 mock 데이터(처리량/p99/온콜 등) 가짐** — default/View.tsx로 이동 가능. surgical 변경
- **InspectorListBody.test.tsx 417줄**: dispatcher 라우팅 + form input 회귀 자동 감지. 분리 없이 통합 테스트 유지

## 대안 비교

### 대안 A — 4 variant View/EditForm 모두 분리 (단일 PR, **추천**)
- 핵심: post/schedule/my-todo/default 각각의 View/EditForm을 list-variants로 이동. registry 슬롯 채움. InspectorListBody는 dispatcher만
- 비용: ~10 신규 파일 (5 View + 5 EditForm — post는 View/Form 둘 다) + InspectorListBody/registry 수정
- 절감: ~500줄. InspectorListBody 787 → ~280
- 위험: 단일 PR ~12 파일. 회귀 격리 어려움 — 그러나 ListPattern epic에서 같은 패턴 안정 실증
- 가역성: 낮음 (구조 변경)
- 학습 효과: list-variants registry가 9 variant 모두에서 동일 구조로 닫힘 — 다음 variant 추가 시 1 폴더 신설

### 대안 B — Phase 단위 (post → schedule → my-todo → default 4 PR)
- 핵심: 1 variant씩 PR. 4 PR
- 비용: 4 PR, cumulative review
- 위험: 매우 낮음
- 학습 효과: 같음
- **기각**: stacked PR 4개 임계점 학습 위배. ListPattern PR 2가 7 variant 일괄로 안전성 입증

### 대안 C — 2 PR 분할 (post + schedule | my-todo + default)
- 핵심: post(가장 큰, 220줄 form)와 schedule을 PR 1, my-todo + default를 PR 2
- 비용: 2 PR
- 위험: 중간. PR 1에서 일관성 확립 → PR 2 일괄
- 학습 효과: 같음

### 대안 Z — do nothing
- 800 마진 13줄. 다음 form 입력 추가 시 즉시 초과. 미루면 같은 epic 재방문 비용

## 추천 + 근거

**추천: 대안 A (단일 PR로 4 variant View/EditForm 모두 분리)**

선택 근거:
1. **ListPattern PR #84 검증** — 7 variant 일괄(18 파일)이 회귀 0으로 안정 머지. 같은 패턴 4 variant 12 파일은 더 안전
2. **stacked PR 임계점 회피** — 단일 PR이 자연. ListPattern epic의 학습 직접 활용
3. **registry 일관성 닫힘** — 9 variant 모두 View/EditForm/Table/Filters/blank 슬롯 채워짐 → 완성된 구조
4. **시간 효율** — 1 PR로 ~30분 종료. 4 PR 분할은 ROI 낮음

**기각된 B**: 너무 잘게 쪼갬. 4개 변경이 같은 패턴 반복이라 큰 단위 가능
**기각된 C**: 2 PR도 stacked. 어차피 패턴 명확 → 1 PR로 충분

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260513-inspectorlistbody-view-editform-extract.md`
- HARD-GATE 등급: ~12 파일 → **간략 설계** (`/plan` 권장하지만 패턴 명확해서 plan 인라인 가능)
- 권장 next: 직접 plan 인라인 → RED-GREEN 진행. ListPattern epic과 동일 흐름

## 단계 분해 (인라인 plan)

1. **T1**: `post/View.tsx` 신설 (PostView 이동, ~50줄). `post/EditForm.tsx` 신설 (inline post form 이동, ~200줄)
2. **T2**: `schedule/EditForm.tsx` 신설 (ScheduleForm + isoToLocalKst/localKstToIso 이동, ~170줄)
3. **T3**: `my-todo/EditForm.tsx` 신설 (MyTodoForm 이동, ~127줄)
4. **T4**: `default/View.tsx` 신설 (ServiceView 이동, ~80줄)
5. **T5**: registry.ts에 4 variant 신규 슬롯 (post/schedule/my-todo/default의 View/EditForm) 등록
6. **T6**: InspectorListBody.tsx 정리 — inline form 제거, ViewMode dispatcher에 default 분기 추가, STATUS_LABEL/STATUS_BADGE/SCHEDULE_TYPE_OPTIONS/TODO_PRIORITY_OPTIONS 등 정의를 각 variant 모듈로 이동
7. **T7**: 회귀 검증 + commit + PR
