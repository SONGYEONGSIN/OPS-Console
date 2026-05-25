---
plan_id: 20260510-181000-onboarding-redesign
status: completed
created: 2026-05-10T18:10:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260510-180500-onboarding-redesign.md
---

# Plan: onboarding 종합 페이지 재설계

## Goal

`/dashboard/onboarding`을 ListPattern variant=cohort 단일 화면 → 탭 4개 종합 페이지로 재설계.
가이드 / 체크리스트 / 회차 관리 / 활동 로그를 한 페이지에 공존. GuidePattern 신설로 가이드형 메뉴(manual/sop/faq) 재사용 토대 확보.

## Approach

PR 분할:
- **PR-1 (본 epic 첫 머지)**: GuidePattern 컴포넌트 + 정적 가이드 콘텐츠(MVP 4~6 그룹) + 탭 시스템 + 회차 관리 탭(기존 cohort variant 임베드) + 체크리스트/로그 탭 placeholder
- **PR-2 (후속)**: `onboarding_checklist_items` 테이블 + RLS + 체크리스트 탭 본 구현
- **PR-3 (후속)**: e2e + 가이드 콘텐츠 보강 + admin 가이드 편집 UI

가이드 콘텐츠는 정적(`_content.ts`) 시작. 첨부 이미지 영감 기반 Folio 컨텍스트 재구성.

## Out of Scope (본 epic)

- 가이드 콘텐츠 DB 저장 / admin 편집 UI
- 활동 로그 시스템 (events 또는 댓글)
- 회차별 가이드 변형 / 진행 통계 / 알림
- GuidePattern을 manual/sop/faq에 재사용 (별도 epic)

## 영향 파일 (PR-1)

| 파일 | 변경 | 설명 |
|---|---|---|
| `src/app/dashboard/_components/patterns/GuidePattern.tsx` | 신규 | client 탭 + 카드 그룹 슬롯 |
| `src/app/dashboard/_components/patterns/__tests__/GuidePattern.test.tsx` | 신규 | 탭 전환·카드 렌더 테스트 |
| `src/app/dashboard/onboarding/_content.ts` | 신규 | 정적 가이드 콘텐츠 4~6 그룹 |
| `src/app/dashboard/onboarding/page.tsx` | 수정 | ListPattern → GuidePattern, 회차 탭에 ListPattern 임베드 |
| `src/app/dashboard/onboarding/__tests__/page.test.tsx` | 그대로 | 시그니처만 |
| `src/app/dashboard/_data/page-meta-config.ts` | 수정 | description 보강 (탭 안내) |

총 6파일. 작은 PR이지만 GuidePattern은 새 패턴이라 중요.

## 단계

### T1: GuidePattern RED 테스트
- **파일**: `src/app/dashboard/_components/patterns/__tests__/GuidePattern.test.tsx`
- **변경**: 탭 4개 노출 / 첫 탭 active / 클릭 시 콘텐츠 변경 / 카드 그룹 렌더
- **DoD**: vitest fail
- **의존**: 없음

### T2: GuidePattern GREEN
- **파일**: `src/app/dashboard/_components/patterns/GuidePattern.tsx`
- **변경**: client component, useSearchParams로 ?tab= 보존, 카드 그룹 + 번호 매겨진 항목 슬롯
- **DoD**: T1 통과
- **의존**: T1

### T3: 가이드 콘텐츠 정적 데이터
- **파일**: `src/app/dashboard/onboarding/_content.ts`
- **변경**: 4~6 그룹 (입사 첫날 / 운영부 이해 / 시스템 학습 / 업무 첫걸음 / OPS Console 도구 / 마무리)
- **DoD**: 타입 정합 + tsc 통과
- **의존**: T2 (GuideSection 타입)

### T4: page.tsx 변경 + 회차 탭 ListPattern 임베드
- **파일**: `src/app/dashboard/onboarding/page.tsx`
- **변경**: ListPattern → GuidePattern 사용. 탭 4개 (가이드/체크리스트 placeholder/회차/로그 placeholder). 회차 탭 안에서 기존 ListPattern variant=cohort + onPersist 그대로
- **DoD**: dev에서 4탭 노출 + 가이드 카드 + 회차 리스트 작동
- **의존**: T2, T3

### T5: meta description + 시각 검증
- **파일**: `_data/page-meta-config.ts`
- **변경**: onboarding.description 갱신 ("탭으로 가이드·체크리스트·회차·로그를 한 곳에")
- **DoD**: 사용자 dev 화면 확인
- **의존**: T4

### T6: PR-1 머지
- **DoD**: CI pass + 사용자 OK
- **의존**: T5

후속 PR-2 / PR-3은 본 plan 외 별도 plan.

## 리스크

- **R1 가이드 콘텐츠 작성 분량**: 첨부 이미지 8 그룹 그대로면 부담 ↑. MVP 4 그룹으로 좁히고 후속 PR-3에서 보강.
- **R2 탭 URL 쿼리**: `useSearchParams`는 client. RSC page에서 client 컴포넌트로 prop 전달. dev에서 새로고침 후 탭 상태 유지 검증.
- **R3 회차 탭 ListPattern 임베드**: ListPattern은 inspector 패널과 결합. GuidePattern 안에 임베드 시 inspector 동작 영향 확인 필요.
- **R4 ListPattern variant=cohort 중복**: page에서 GuidePattern + ListPattern 동시 사용 — variant 7 도달은 그대로. 컴포지션 리팩토링은 PR-2 이후 별도 epic.

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T18:10:00Z | plan | created | brainstorm 20260510-180500 기반, 첨부 이미지 영감 |
| 2026-05-10T20:05:00Z | T1~T5 | done | GuidePattern + 가이드 콘텐츠 8 그룹 (첨부 이미지 그대로) + page 탭 4개 |
| 2026-05-10T20:30:00Z | content | revise | OPS Console 언급 제거, 첨부 이미지(2025 신입 교육계획) 8 그룹으로 정확히 미러 |
