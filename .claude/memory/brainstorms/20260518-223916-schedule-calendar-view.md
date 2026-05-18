# Brainstorm: 운영부 달력 (월 그리드) — services 날짜 기반 + schedule_events 결합

작성: 2026-05-18 / 사용자: 송영석 / 트리거: 사용자 요청 + 엑셀 Monthly Planner mock 제시

## 의도

- **산출물**: `/dashboard/schedule` 페이지에 월 그리드 캘린더 view 추가 (default). 기존 list view는 상단 view 토글로 유지. services `write_start_at`/`write_end_at` 2 이벤트 + 기존 `schedule_events`를 같은 셀에 컬러 dot + 한 줄 텍스트로 렌더
- **사용자**:
  - admin/member: 캘린더에서 월 전체 운영 상황 한눈에 (원서 시작/종료 + 운영부 공통 일정)
  - viewer: read-only 가시화
  - 모두: 기존 list view 토글 가능 (CRUD는 list view에서만)
- **트리거**: 사용자 직접 요청. 사이드바 라벨 "전체 일정" → "운영부 달력" 갱신 직후 화면 일관성
- **성공 기준**:
  1. 6주 × 7열 월 그리드 렌더 (KST 기준)
  2. services 원서 시작/종료 + schedule_events 셀에 컬러 dot + 한 줄
  3. 월 prev/next 이동 + 오늘로 점프
  4. list ↔ calendar 토글 (default = calendar)
  5. lint/typecheck/unit test 통과

## 제약

- **기술**:
  - Next.js 16 App Router — schedule page는 RSC (데이터 fetch), CalendarView는 client (`"use client"` for 월 state)
  - Tailwind v4 — 새 색상 하드코딩 X, design-tokens 사용 또는 기존 Tailwind 클래스
  - KST timezone — 날짜 계산은 Asia/Seoul 일관 (Vitest는 이미 TZ=Asia/Seoul)
  - list-variants 아키텍처 무변경 (CalendarView는 별도 컴포넌트, ListPattern dispatcher 안 건드림)
- **비즈니스**:
  - v1 read-only 시각화 — services는 편집 불가 (다른 페이지에서), schedule_events 편집은 기존 list view에서만
  - 색상 분배: write_start_at = 초록, write_end_at = 파랑, schedule_events = category별 (shift/event/leave/training)
- **코드베이스**:
  - schedule page 권한 흐름(`requireMenu`)·데이터 fetch(`listScheduleEvents`) 재사용
  - services fetch 추가 — `listServicesForCalendar(start, end)` 같은 헬퍼 신설
  - 캘린더 그리드 계산 로직은 별도 헬퍼 `_calendar-helpers.ts`로 추출 + unit test

## 대안 비교

| 항목 | A. list-variant 신규 | **B. schedule 페이지 + 토글 (추천)** | C. 새 페이지 분리 | Z. do nothing |
|---|---|---|---|---|
| 비용 | 큼 | 중간 (~8 파일) | 중간 + 사이드바 갱신 | 0 |
| 위험 | 그리드를 row 패턴에 강제 | client state ↔ SSR data prop drilling | 사이드바 2 entry 혼란 | 사용자 명시 요청 위반 |
| 가역성 | 어려움 (registry/dispatcher 의존) | **쉬움** (토글 1줄 + 컴포넌트 1개) | 쉬움 (페이지 삭제) | N/A |
| 학습 효과 | list-variants 한계 학습 | 새 view 패턴 (캘린더) 도입 — 향후 재사용 가능 | 라우팅 분리 패턴 | 없음 |

## 추천 + 근거

**선택: 대안 B**

- 사용자 답변 직접 매칭 ("달력 default + list 토글" + "services 데이터 가져오기")
- 기존 schedule 페이지 권한·fetch 재사용 → 신규 코드 최소화
- 가역성 높음 — 토글 + 신규 컴포넌트 1개 격리. 실패해도 view 분기만 제거하면 끝
- 사이드바 정합 추가 비용 없음 (이미 "운영부 달력"으로 라벨 갱신 완료)

**기각 — A**: 캘린더 그리드는 본질적으로 row 기반 ListPattern과 맞지 않음. variant 추가하면 dispatcher props 비대화 우려
**기각 — C**: 사이드바 2 entry 필요 → 사용자가 통합 view 원함. 데이터 fetch 중복도 발생
**기각 — Z**: 사용자 명시 요청 무시

## 다음 단계

- 변경 규모: **6~10 파일** → HARD-GATE **간략 설계** → `/plan` 권장
- 핵심 파일 예상:
  - `src/app/dashboard/schedule/page.tsx` — view 분기 + services fetch 추가
  - `src/app/dashboard/schedule/CalendarView.tsx` 신설 (client)
  - `src/app/dashboard/schedule/CalendarToolbar.tsx` 신설 (월 nav + view 토글)
  - `src/app/dashboard/schedule/_calendar-helpers.ts` 신설 (월 그리드 계산)
  - `src/app/dashboard/schedule/__tests__/CalendarView.test.tsx`
  - `src/app/dashboard/schedule/__tests__/_calendar-helpers.test.ts`
  - `src/features/services/queries.ts` — `listServicesForCalendar(start, end)` 추가
  - `src/features/services/__tests__/queries.test.ts` 보강
- 다음 스킬: `/plan "운영부 달력 (month grid view)"`
