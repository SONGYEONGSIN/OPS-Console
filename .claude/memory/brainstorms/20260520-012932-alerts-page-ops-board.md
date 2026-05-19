# Brainstorm: /dashboard/alerts 새 알림 페이지 — 운영 보드 컨셉

## 의도
- **산출물**: /dashboard/alerts 풀 페이지. 카테고리 카드 그룹 보드.
- **사용자**: 운영부 — 오전/오후 정기적으로 운영 상황 한 번 훑고 우선순위 결정.
- **트리거**: chrome 종 아이콘 클릭 시 404. AlertsBell 호버 dropdown은 "지금 푸시" 5건만 보여줘 누적 history/카테고리 인지 불가.
- **성공 기준**:
  1. 클릭 시 404 아닌 페이지 렌더
  2. 카테고리 카드 4개 (마감 임박 / 미수 경과 / 인수인계 대기 / 시스템) 노출
  3. 각 카드 = 카운트 + 톱 3 미리보기 + 전체 보기 링크
  4. 종 dropdown(실시간 푸시)과 페이지(상황 보드)가 톤이 명확히 다름

## 제약
- **기술**: Next.js RSC 우선. mock data 1차 (실 도메인 query 연결은 follow-up). page-meta-config의 alerts 메타 재사용.
- **비즈니스**: 1차 PR은 골격만 — 실 query 연결은 데이터 분포 확인 후. UI 컨셉 검증 우선.
- **코드베이스**: AlertsBell의 mock(`alertsWidgets`) 그대로 사용. 기존 chrome alerts prop 흐름 변경 X.

## 대안 비교

| 항목 | A. 인박스 | B. 운영 보드 (선택) | C. 칸반 |
|------|----------|---------------------|---------|
| 멘탈 모델 | Gmail 수신함 | 관제 패널 | Linear 칸반 |
| 종↔페이지 분리 | 약함 (둘 다 시간순) | 명확 (푸시 vs 보드) | 보통 |
| 운영부 핏 | 보통 | 높음 (D-N/카테고리) | 낮음 (사이즈 작음) |
| 1차 구현 비용 | 중 | 저 | 고 |

## 추천 + 근거

**대안 B (운영 보드)** 선택.

**근거**:
1. 종 dropdown = "지금 푸시 5건" / 페이지 = "카테고리 보드"로 의도가 분명히 다름
2. Folio 운영부 도메인(services 마감 / receivables 경과 / handover 대기)이 자연스럽게 카테고리화
3. mock alertsWidgets가 이미 urgent/review/ok 톤 분류 — 재사용 가능
4. 1차 PR이 골격만으로 충분 (PageHeader + 4 카드)

**기각된 A (인박스)**: 종 dropdown과 페이지가 둘 다 시간순 리스트라 톤 중복. "실시간 현황과 다르게 가자"는 사용자 의도와 어긋남.

**기각된 C (칸반)**: 운영부 사이즈에 칸반은 과함. 알림이 곧 todo가 아님 (이미 my-todo가 별도). 칸반 인터랙션 비용 대비 효과 모호.

## 다음 단계

1. `/dashboard/alerts/page.tsx` 신설 — RSC + 4 카테고리 카드 그룹
2. 1차 mock data (alertsWidgets 재사용 또는 카테고리별 mock)
3. 시각 확인 → 사용자 피드백
4. follow-up PR: 실 query 연결 (services D-N / receivables 경과 등)

권장: 1~5 파일 인라인 설계 → 직접 구현. plan 스킬 호출 불필요.
