# Brainstorm: 온보딩 체크리스트를 회차 관리 탭 인스펙터로 이동

## 의도
- 산출물: 별도 '체크리스트' 탭 제거 → '회차 관리' 탭에서 신입(회차) 행 클릭 시 인스펙터 안에 그 신입의 체크리스트를 표시·토글
- 사용자: admin(전체 회차 토글), trainee 본인(자기 회차 토글), mentor(읽기 전용). 신입 한 명을 열어 진행 점검·체크하는 시점
- 트리거: 현재 '체크리스트' 탭 + cohort 드롭다운 구조가 "회차"로 보여 신입별 관리라는 멘탈 모델과 어긋남. cohort/View.tsx에 이미 "진행(후속 epic)" 플레이스홀더가 있어 원래 설계 의도와 일치
- 성공 기준: (1) 체크리스트 탭 사라짐 (2) 회차 인스펙터에서 섹션별 체크/진행률 표시 (3) 권한대로 토글 동작 (4) 토글 시 DB 반영 + 낙관적 UI (5) 기존 테스트 통과 + 신규 테스트 추가

## 제약
- 기술: 인스펙터 View는 현재 순수 서버 컴포넌트 → 토글 상호작용은 "use client" 하위 패널로 분리해야 함. ViewProps로 액션 전달은 선례 있음(onInvite/onUpdateRemarks via EditFormProps)
- 코드베이스: ListRow는 전 variant 공유 타입 — cohort 전용 필드(traineeEmail 등)가 이미 있어 checklist 필드 추가는 일관. registry/dispatcher 무변경
- 데이터: 체크리스트 항목 정의는 정적(onboardingGuideSections), 체크 상태는 checklist_items(cohort_id FK). 회차 수가 적어 eager 로딩 비용 무시 가능
- 보안: 토글 권한 = trainee 본인 || admin (selectedCohort 기준 → per-row 계산으로 이동)

## 대안 비교

| 항목 | 대안 A: eager 로드 + View 내 client 패널 | 대안 B: lazy 로드(인스펙터 open 시 server action fetch) | 대안 Z: do nothing |
| --- | --- | --- | --- |
| 비용 | 중 (~8파일) | 중상 (+ 로딩상태/client fetch 배선) | 0 |
| 위험 | 낮음 (데이터 흐름 단순, RSC 직렬화 호환) | 중 (open별 fetch 경합·로딩 UX) | 멘탈모델 불일치 잔존 |
| 가역성 | 높음 | 높음 | - |
| 학습 효과 | 인스펙터에 도메인 진행위젯 끼우는 표준 패턴 정립 | 인스펙터 lazy-load 패턴 | - |

## 추천 + 근거
- **추천: 대안 A (eager 로드 + cohort/ChecklistPanel client 컴포넌트)**
- 근거: 회차 수가 적어 모든 회차 체크상태를 page.tsx에서 한 번에 로드해 ListRow에 실어보내면 client fetch 불필요 → 데이터 흐름 최단·RSC 직렬화 호환. cohort/View는 서버 컴포넌트 유지하고 "진행" 섹션에 client 패널만 임베드. ChecklistTab 로직 재사용
- **기각된 대안 B**: lazy는 회차 수가 수백 단위로 커질 때 가치. 현 규모(소수 회차)에선 로딩 UX·경합만 늘어 과설계. 향후 회차 폭증 시 B로 전환
- **대안 Z 기각**: cohort/View 플레이스홀더가 이미 이동을 전제. 탭 분리 유지 시 사용자가 지적한 개념 불일치 지속

## 다음 단계
- 예상 변경: onboarding/page.tsx · cohort/View.tsx · 신규 cohort/ChecklistPanel.tsx · types.ts(ViewProps) · InspectorListBody.tsx · ListPattern.tsx(ListRow+onToggle 배선) · ChecklistTab 제거 · 관련 테스트 → 약 8파일 + 테스트 (HARD-GATE 간략 설계, 인스펙터 아키텍처 변경으로 복잡도 보정)
- 권장: `/plan` 으로 단계 분해 후 TDD 구현
