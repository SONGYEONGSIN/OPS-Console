# Brainstorm: onboarding 종합 페이지 재설계 (탭 + 가이드 + 체크리스트 + 회차)

작성: 2026-05-10 / 사용자: 송영석

영감: 사용자가 첨부한 Orchestrator System onboarding 화면 (탭 4개 + 단계별 카드 그룹). 첨부 그대로가 아닌 Folio 컨텍스트(washi/cream 톤, 진학어플라이 도메인) 재구성.

## 의도

- **산출물**:
  - 새 패턴 `GuidePattern` (탭 + 카드 그룹 슬롯) — manual/sop/faq에서도 재사용 가능
  - 정적 가이드 콘텐츠 (`onboarding/_content.ts`) — 단계별 카드 그룹
  - `onboarding_checklist_items` 테이블 + RLS + 본인 진행도 추적
  - `/dashboard/onboarding/page.tsx` 탭 4개:
    1. **온보딩 가이드** (정적 카드 그룹)
    2. **체크리스트** (본인 진행 토글)
    3. **회차 관리** (현재 ListPattern variant=cohort 흡수, admin only)
    4. **활동 로그** (placeholder, 후속 epic)
  - 회차 상세 `[id]` 라우트는 유지하되 메인 페이지 회차 탭에서 inspector로 처리
- **사용자**:
  - 신입(trainee): 가이드 학습 → 체크리스트 진행 → 매뉴얼 링크
  - 사수(mentor): 본인 회차 진행도 모니터, 가이드 read
  - admin: 회차 관리 탭 + 가이드 콘텐츠 read (편집 UI는 후속)
  - 그 외 운영자: 가이드 read만 (학습 자료로 자유 접근)
- **트리거**: 사용자가 "ListPattern이 모든 메뉴에 최선인가?" 의문 제기. 메뉴별 화면 다양화 + onboarding의 가이드형 본질 부각
- **성공 기준**:
  1. 첫 진입 시 가이드 탭 (정적 카드 그룹 6~8개)
  2. 탭 전환 시 URL 쿼리(`?tab=`)로 상태 보존
  3. 체크리스트 탭에서 본인 cohort 진행도 토글 → DB persist
  4. 회차 관리 탭에서 기존 ListPattern variant=cohort 그대로 동작
  5. GuidePattern은 manual/sop/faq에서 재사용 가능 (콘텐츠만 swap)

## 제약

- **기술**:
  - 탭은 client component (URLSearchParams + onClick). 콘텐츠 카드 그룹은 정적 데이터(`onboarding-content.ts`) — DB는 cohort/checklist만
  - 첨부 이미지의 다크 컬러 무시(Folio washi/cream 톤 유지) — 레이아웃 영감만 차용
  - 가이드 콘텐츠 분량: 8 그룹 × 3~6 항목 — 한 번에 작성 부담 → MVP는 4 그룹으로 시작 가능
- **비즈니스**:
  - 가이드 콘텐츠 편집 UI / 회차별 가이드 변형 / 진행 통계 / 알림 — 후속 epic
  - 활동 로그는 본 epic placeholder만
- **코드베이스**:
  - 새 패턴 추가 — ListPattern과 별개. 기존 cohort variant는 회차 관리 탭으로 흡수, 페이지 라우팅은 `/dashboard/onboarding`만 유지
  - `onboarding_checklist_items` 테이블 신설 (todos 재활용 가능했지만 도메인 분리 — RLS 정책이 cohort 소속 검증으로 다름)
  - GuidePattern은 ListPattern과 별개의 새 컴포넌트 — variant 폭증 회피

## 대안 비교

| 항목 | A: 탭 4개 풀 (가이드/체크/회차/로그) | B: 탭 2개만 (가이드/회차) | C: GuidePattern 단일 탭 + 회차는 별도 페이지 | Z: do-nothing (현재 cohort variant 유지) |
|---|---|---|---|---|
| 비용 | ~18파일 | ~10파일 | ~7파일 | 0 |
| 위험 | 가이드 콘텐츠 분량 ↑ — MVP 좁히기 | 체크리스트 의미 미정 | 라우팅 변경 영향 | 사용자 의문 미해소 |
| 가역성 | 탭 추가/제거 자유 | 체크리스트는 v2 추가 | 라우팅 분리는 후행 비용 | n/a |
| 학습 효과 | GuidePattern + 다중 탭 데이터 모델 | GuidePattern만 | GuidePattern만 | 없음 |

## 추천 + 근거

**추천: 대안 A — 탭 4개 풀 구성, 단 분할 머지**

근거:
1. 사용자 요청이 종합 화면 — 부분만 만들면 검증 미흡
2. GuidePattern + 탭 + checklist는 onboarding 외 도메인(manual/sop/faq)에서도 재사용 — 패턴 정착 의의 큼
3. 분할 머지(PR-1: 가이드 + 탭 + 회차 흡수 / PR-2: 체크리스트 / PR-3: e2e)로 머지 단위 안전성 확보
4. 활동 로그는 placeholder만 — events.jsonl 또는 별도 시스템은 별도 epic

**기각 B**: 체크리스트는 onboarding 본질의 핵심 — 분리하면 사용자 가치 절반. my-todo로 위임은 의미 분리 안 됨 (todo는 일반, 절차는 onboarding 컨텍스트)

**기각 C**: 라우팅 분리는 메뉴 구조 변형 — 사이드바 onboarding 단일 slug 의미와 어긋남

### 본 epic 스코프 (PR-1 우선)
- **PR-1 (이번 머지 목표)**: GuidePattern + 탭 시스템 + 가이드 콘텐츠(MVP 4~6 그룹) + 회차 관리 탭(기존 cohort variant 임베드) + 활동 로그 placeholder. 체크리스트 탭은 placeholder
- **PR-2**: `onboarding_checklist_items` 테이블 + RLS + 체크리스트 탭 본 구현
- **PR-3**: e2e + 가이드 콘텐츠 보강 + admin 가이드 편집 UI(후속)

### 가이드 콘텐츠 그룹 후보 (Folio/진학어플라이 컨텍스트)
1. **입사 첫날** (4 항목): 인사·자리·계정·지문등록·OJT 시작
2. **운영부 이해** (4 항목): 조직·시프트·시스템 개요·OPS Console 둘러보기
3. **시스템 학습** (5 항목): notices·feedback·schedule·my-todo·alerts 사용법
4. **업무 첫걸음** (4 항목): 신청 흐름·고객 대응·인수인계·시프트 진입
5. **OPS Console 운영자 도구** (3 항목): 메뉴 권한 요청·디자인 토큰·바이브코딩 가이드
6. **마무리** (3 항목): 평가·피드백·정상 시프트 진입

## 다음 단계

- HARD-GATE 등급: **간략~전체 경계** (15~18파일) → `/plan from-brainstorm` + 분할 머지
- 후속 epic: GuidePattern을 manual/sop/faq에 재사용, 활동 로그 시스템, 가이드 편집 UI
