# Brainstorm: /dashboard 실시간 현황 완전 재구성 — 운영부 콕핏(HUD)

## 의도
- **산출물**: /dashboard 1면 전면 재작성. 3 zone HUD layout(좌 나 · 중 운영부 · 우 시스템).
- **사용자**: 운영부 — 입실 후 5초 안에 "나 · 팀 · 시스템" 세 차원의 상태를 동시 인지.
- **트리거**: 기존 신문 1면 메타포는 정보 단위가 분산. alerts 통합 + D-N/heatmap 추가 이후 컨셉이 혼합되어 메시지가 약함. 사용자 명시 요청.
- **성공 기준**:
  1. 1면 진입 시 3 zone이 동시에 보임 (스크롤 없이)
  2. 각 zone의 위젯이 다른 메뉴의 도메인 신호를 미니어처로 노출 (services D-N / handover 진행 / receivables 미수 / worklog 활동 / incidents / contracts 등)
  3. 좌 zone = 본인 KPI 중심, 중 zone = 운영부 전체 보드, 우 zone = 시스템 신호
  4. EventTicker로 실시간 변화 감 추가

## 제약
- **기술**: Next.js RSC + Tailwind. mock data 1차, 실 query 연결은 follow-up.
- **비즈니스**: 1차 PR로 골격 완성 (HUD shell + 각 zone 핵심 위젯). 데이터 분포·실용성 검증 후 위젯 보강·정리.
- **코드베이스**: 기존 D-N 카운트다운/도메인 Heatmap 재사용. 신문 1면 컴포넌트(Masthead/Lede/TriageList/ShiftTimeline/OnCallPanel/ProjectGrid/ActivityColumn)는 page.tsx에서 import 제거 (파일은 dead로 두고 다음 PR에서 정리).

## 대안 비교

| 항목 | A. HUD 3 zone (선택) | B. Day Stripe | C. Briefing 1장 | D. Live Console |
|------|---------------------|----------------|------------------|------------------|
| 정보 차원 | 나·팀·시스템 3축 동시 | 시간 1축 | 1면 단일 | 이벤트·KPI 2축 |
| 도메인 활용 | 매우 풍부 | 시간 의존 데이터만 | 적음 | 중간 |
| 새로움 | 비행 콕핏 메타포 | 가로 스트라이프 | 신문 재해석 | 터미널 |
| 구현 비용 | 중-고 | 고 (시계열 query) | 중 | 중 |

## 추천 + 근거

**대안 A (HUD 3 zone)** 선택.

**근거**:
1. 본인·운영부·시스템 3 차원을 동시 인지 — 정보 밀도와 가독성 균형
2. 기존 D-N/Heatmap 그대로 재사용 가능 (중 zone에 배치)
3. 좌(나) zone이 my-todo, services 본인 담당, handover 발신, receivables 미수, worklog 활동 등 본인 중심 도메인 종합 — 신박함의 핵심
4. 우(시스템) zone이 시프트/온콜/트래픽/빌드/배포/세션 등 운영 헬스 신호 종합
5. EventTicker로 라이브 감 — D 컨셉의 장점 흡수

**기각**:
- B (Day Stripe): 시각 자체는 신박하나 시계열 query 비용·복잡도 높고 데이터 부족
- C (Briefing 1장): 정보 밀도는 좋으나 도메인 활용 깊이 부족
- D (Live Console): 터미널 풍은 운영부 컬러(클래식 페이퍼)와 톤 미스매치

## 다음 단계

1차 PR (이번):
- HudShell (3 zone CSS grid wrapper)
- LeftMePanel — MyTodoSummary / MyServicesSummary / MyHandoverSummary / MyReceivablesSummary / MyActivityFeed
- CenterOpsPanel — DnCountdown(재사용) / DomainHeatmap(재사용) / EventTicker(신규)
- RightSystemPanel — ShiftClock / OnCallChip / TrafficGauge / BuildDeployStatus / SessionCount
- page.tsx 전면 재작성

Follow-up:
- 실 query 연결 (mock → 실 데이터)
- 기존 컴포넌트(Masthead/Lede/TriageList/ShiftTimeline/OnCallPanel/ProjectGrid/ActivityColumn) 미사용 시 정리
- EventTicker 라이브 갱신 (polling 또는 server-sent events)
