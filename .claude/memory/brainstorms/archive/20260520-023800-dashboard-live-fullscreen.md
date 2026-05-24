# Brainstorm: /dashboard 실시간 현황 — 풀스크린 위젯 그리드

## 의도
- **산출물**: /dashboard 풀스크린 페이지. chrome(사이드바/탭/종) 전부 hide. Apple Stocks/Health 위젯 톤.
- **사용자**: 운영부 — 1면 진입 즉시 시스템 전체 상태 인지. 본인 토글로 시야 좁힘.
- **트리거**: 기존 신문 1면/HUD 모두 다른 메뉴와 톤 중복. "실시간 현황 자체가 다른 종류의 화면"이 사용자 명시 요구.
- **성공 기준**:
  1. 진입 시 chrome 자동 hide (CSS overlay or fixed inset-0)
  2. 우측 상단 X로 chrome 복귀
  3. 전체 ↔ 내것 토글 (URL `?mine=true`)
  4. 데이터는 실제 query (services / handover / receivables / incidents / contracts / backup / worklog / my-todo / contacts)
  5. Apple 위젯 톤 — 큰 카드 + 작은 타일 + 활동 feed, 절제된 색

## 제약
- **레이아웃 처리**: layout.tsx 건드리지 않고 page.tsx에서 fixed inset-0 z-[100] overlay 패턴 (사이드바 위 덮어쓰기)
- **풀스크린 toggle**: client state로 진입 시 ON. X 클릭 시 OFF → 일반 div로 전환 (chrome 노출)
- **1차 PR 범위**:
  - 위젯 골격 + 전체 카운트 (getMenuCounts 재사용)
  - 마감 임박 D-N (listServices + write_end_at 임박 4개)
  - 미수채권 (receivables sheet — 14일+ 경과)
  - mine 토글 URL state만 (services / my-todo 본인 필터)
  - 최근 worklog 10건
- **Follow-up**: handover/receivables mine 필터 / 라이브 폴링 / 트렌드 차트

## 추천 + 근거

**Apple Stocks/Health 톤 + 풀스크린 overlay** 채택.

**근거**:
1. 큰 카드 2개(Hero) + 작은 타일 5개(Stat) + 활동 feed = 정보 밀도와 가독성 균형
2. 다른 메뉴(list 도메인)와 톤 명확히 다름 — 위젯 그리드는 운영부 어디에도 없음
3. 풀스크린 overlay는 layout.tsx 무수정 — surgical
4. 실 query: getMenuCounts + listServices 임박 + receivables sheet — 기존 인프라 재사용

**기각**:
- A (Bloomberg): 너무 dense, Folio 컬러 톤(클래식 페이퍼)과 충돌
- C (Linear/Notion): 모던 SaaS — 다른 메뉴들과 톤 가까움
- D (잡지): 데이터 밀도 부족, 실시간 현황 의도와 불일치

## 다음 단계 (1차 PR)

1. `_components/live/` 디렉토리 신설:
   - LiveFullscreen.tsx (client, X 토글, ScopeToggle)
   - HeroCard.tsx (큰 카드 — 마감 임박 / 미수채권)
   - StatTile.tsx (작은 타일 — 서비스/계약/사고/백업/인수인계)
   - ActivityFeed.tsx (worklog 최근 10건)
   - ScopeToggle.tsx (전체 / 내것)
2. `page.tsx` 전면 재작성 — server에서 실 데이터 fetch + props 전달
3. 테스트 각 컴포넌트
4. follow-up: 도메인별 mine 필터 / 라이브 폴링 / 트렌드 sparkline
