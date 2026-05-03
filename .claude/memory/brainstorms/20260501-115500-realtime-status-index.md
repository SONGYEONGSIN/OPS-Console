# Brainstorm: 실시간 현황 (/dashboard index) 페이지 화면 구성

## 의도

- **산출물**: `/dashboard` index를 IT-ops 서비스 리스트 + Inspector → 운영부 도메인 종합 실시간 현황 대시보드로 전면 교체. page.tsx + 신규 8개 컴포넌트.
- **사용자**: 진학사 운영2팀(2교대 14:00~22:00 KST). 입실 직후 첫 화면. 시프트 컨텍스트 + 우선 행동 + 47 메뉴 진입점.
- **트리거**: 47 페이지 IA 재구성(PR #1) 후 index 페이지가 IA와 mismatch. 첫 인상 페이지라 시연 가치 가장 큼.
- **성공 기준**:
  1. 입실 후 3초 내 "지금 우선 봐야 할 것" 파악 가능
  2. 시프트/긴급/일정/팀 상태 4가지 한 화면 노출
  3. 47 메뉴 navigation 진입점 1개 이상 (12 프로젝트 카드)
  4. SaaS 스타터킷이 아닌 Folio 정체성 (washi/낙관/Pretendard) 시각화 최소 1개+

## 제약

- 기술: Next.js 16 App Router, Server Component 기본 + 시계/타임라인은 client. Tailwind v4 + design tokens 강제 (하드코딩 색상 0)
- 비즈니스: 시간 1.5~2시간 추정 (구현). Supabase 미연결, mock 데이터 활용 (projectMap/alertsWidgets/OPERATORS)
- 코드베이스: page.tsx 전면 교체 (services 리스트 제거). 5 패턴 컴포넌트와 별개 — index 전용 컴포넌트 신규 8개. HARD-GATE 간략 설계 등급(6~19 파일).

## 대안 비교

| 항목 | A: 에디토리얼 신문 | B: 트리아지 액션큐 | C: 상황실 NOC | Z: 그대로 |
|------|---|---|---|---|
| 핵심 | 마스트헤드 + LEDE + 시프트 타임라인 척추 + 프로젝트 그리드 + 활동 column | 큰 영역 "지금 할 일 큐" 5건 + 보조 정보 | 화면 grid 분할, 모든 zone 동등 NOC 톤 | IT-ops 리스트 유지 |
| 비용 | 1.5~2h | 1~1.5h | 2~3h | 0 |
| 위험 | typographic 강조 모바일 stack 깨질 가능 | 정적 mock에서 액션큐 단조로울 위험 | washi/cream 톤 이탈, 토큰 dirty | IA mismatch 지속 |
| 가역성 | page.tsx + 8 컴포넌트 revert 쉬움 | 동일 | 색상 토큰 추가 → 회귀 면적 큼 | - |
| 차별화 (anti-generic) | **매우 높음** (신문 프레이밍) | 중간 (액션큐는 흔한 패턴) | 낮음 (모니터링 NOC 흔함) | - |
| 학습 효과 | 에디토리얼 디자인 시스템 강화 | 운영자 행동 흐름 학습 | NOC 패턴 (재사용성 낮음) | 0 |
| 운영 시연 가치 | 높음 (Folio 정체성 표현) | 매우 높음 (즉시 행동) | 중간 | 낮음 |

## 추천 + 근거

### 추천: 대안 A — 에디토리얼 신문 톤

**선택 근거 (3가지):**

1. **Folio 브랜드 정체성과 직결** — washi 종이 + 낙관 vermilion + Pretendard 폰트가 신문 1면 톤과 자연스럽게 조합. 첫 화면 차별화가 가장 큰 가치를 만드는 지점.
2. **Anti-generic 강도 최상** — Tailwind 카드 그리드/대시보드 SaaS 스타터킷에서 가장 멀리 떨어진 대안. 시연자가 1~2초 안에 "이건 다른 톤이다"라고 느낌.
3. **시각이 콘텐츠** (시프트 타임라인 vermilion ink 흐름) — 운영부 컨텍스트(2교대 14~22)에 정확히 맞춤. 운영자가 "지금 시프트 어디쯤"을 숫자가 아닌 **공간으로 체감**. 어떤 SaaS 대시보드도 이렇게 안 함.

**기각된 대안 B (트리아지 액션큐):**
- 액션 우선 자체는 가치 있으나 mock 데이터로는 dynamic하지 못함 — Supabase 연결 후 진짜 가치 발현
- 시연 단계엔 시각 차별화가 더 중요. 추후 운영 단계에 LEDE 큰 한 줄로 부분 흡수 가능

**기각된 대안 C (상황실 NOC):**
- washi/cream 톤과 충돌, 색상 시스템 dirty 위험
- NOC 톤은 통신/네트워크 도메인이라 진학사 운영부 컨텍스트와 거리

**기각된 Z (do nothing):**
- IA 정합 미스매치 + 첫 인상 가치 큰데 적용 무시는 사용자 의도 무시

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260501-115500-realtime-status-index.md`
- 변경 규모: page.tsx + 신규 8 컴포넌트 = 9 파일 → HARD-GATE **간략 설계 등급**
- **권장 후속**: `/plan` 스킬로 9 파일 단계별 분해
- designer 에이전트는 이미 호출됨 (Phase 0 톤 + 핵심 컴포넌트 스니펫 완료) → plan의 step 시드로 활용

### 컴포넌트 인벤토리 (designer 에이전트 출력 기반)

신규 `src/app/dashboard/_components/index/` 하위:
- `Masthead.tsx` — 마스트헤드 (date + weekday + vol)
- `Lede.tsx` — 큰 한 줄 헤드라인
- `TriageList.tsx` — 알림 4건 컴팩트
- `ProjectEntry.tsx` — 12 프로젝트 그리드 단위
- `ShiftTimeline.tsx` — 시프트 타임라인 척추 (client)
- `OnCallPanel.tsx` — 1차/2차 온콜
- `ActivityColumn.tsx` — 활동 column
- `SectionLabel.tsx` — 섹션 kicker

수정: `src/app/dashboard/page.tsx` 전면 교체 (Server Component, services 리스트 제거)
