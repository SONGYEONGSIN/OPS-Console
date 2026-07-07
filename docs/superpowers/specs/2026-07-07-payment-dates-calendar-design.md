# 비용지급일 → 운영부 달력 표시 (설계)

- 날짜: 2026-07-07
- 브랜치: `fix/sidebar-work-assignment-order` (신규 `feat/payment-dates-calendar` 권장)
- 설계 등급: 간략 설계 (약 12파일, HARD-GATE 6~19)

## 목적

별도 SharePoint 드라이브의 `비용지급일_재경_2021.xlsx` 안에서 **최대 기수** `NN기비용지급일` 시트를 조회해,
각 행(연/월/일 + 개인·공용)을 **운영부 달력**(`/dashboard/schedule` 캘린더 뷰)에 읽기전용 이벤트 칩으로 표시한다.

## 실측 데이터 (probe로 확인)

- drive: `SHAREPOINT_PAYMENT_DRIVE_ID` (name "문서"), item: `SHAREPOINT_PAYMENT_ITEM_ID` = `01JKZCGHHUN2SBLEVCMBAJ4UJLBJLM2F23`
- 워크시트: `19/21/23/24/25/26/27기비용지급일(...)` — 최대 기수 = **27기비용지급일(26.04~27.03)** (Visible)
- 시트 컬럼 (text 값, 한글 접미사 포함):
  - 1행 헤더: `연도 | 월 | 일 | 개인/공용`
  - 데이터: `2026년 | 4월 | 9일 | 개인` / `... | 공용`
- → 숫자만 추출 필요 (`2026년`→2026, `4월`→4, `9일`→9). D열 값은 `개인`/`공용`.

## 접근 (A — 실시간 Excel 오버레이)

DB 미도입. receivables와 동일한 Graph Excel 읽기 패턴 재사용. 달력에 한 겹 오버레이.

## 컴포넌트

### 1) `src/features/payment-dates/`
- `schemas.ts` — `PaymentDate = { ymd: "YYYY-MM-DD"; year; month; day; category: string; sheetName: string }`
- `sheet-select.ts` — 순수 `selectLatestPaymentSheet(names: string[]): string | null`
  - `/^(\d+)기비용지급일/` 매칭 중 **최대 기수** 시트명. 미매칭 → null. (visibility 무관)
- `row-map.ts` — 순수 `mapPaymentRows(rows: string[][], sheetName: string): PaymentDate[]`
  - 각 행 col0/1/2에서 `\d+` 추출 → year(1000~9999)/month(1~12)/day(1~31) 유효성 검사. col3 category 비면 skip.
  - 헤더행("연도"→숫자 없음)·빈 행 자동 skip. `ymd`는 zero-pad.
- `queries.ts` — `fetchPaymentDates(): Promise<PaymentDate[]>`
  - env(`SHAREPOINT_PAYMENT_DRIVE_ID/_ITEM_ID`) 누락 → `[]` + warn.
  - worksheets 목록 → sheet-select → 해당 시트 usedRange `text` → row-map.
  - **React cache**(요청 내 dedupe) + **모듈 TTL 캐시 10분**(월 이동마다 Graph 왕복 방지). 실패 → `[]`.

### 2) 달력 통합
- `schedule/page.tsx`: `view==="calendar"`일 때 `fetchPaymentDates()` → `CalendarView`에 `paymentDates` 전달 (mine 토글 무관, 항상).
- `schedule/_calendar-helpers.ts`:
  - `CalendarCategory`에 `"payment-personal" | "payment-shared"` 추가.
  - `CalendarSourceVariant`에 `"payment"` 추가. `CalendarItem.rowRef` 유니온에 `PaymentDate` 추가.
  - `groupItemsByDay(events, services, backupLeaves, paymentDates=[])` — payment 루프:
    `category = 개인 포함→personal / 공용 포함→shared`, `label = "${개인|공용}비용"`, `all_day=true`, `sourceVariant="payment"`.
- `schedule/CalendarView.tsx`:
  - `paymentDates` prop 추가.
  - `DOT_COLOR`에 두 색 추가(디자인 토큰 2종 — 구현 시 tokens 확인, 예: 개인=gold 계열 / 공용=sage 계열).
  - `handleItemClick` payment 분기 → `paymentRowToListRow(pd)`로 inspector open. inspector는 `sourceVariant!=="schedule"`라 자동 읽기전용.

### 3) inspector 읽기전용 variant (worklog/news 패턴)
- `list-variants/payment/View.tsx` — `PaymentView({row})`: 날짜(row.startDateYmd)·구분(row.paymentCategory)·시트명(row.paymentSheet) 표시.
- `list-variants/registry.ts`: `payment: { View: PaymentView }` 1줄 + import.
- `list-variants/types.ts`: `Variant`에 `"payment"` 1줄.
- `patterns/ListPattern.tsx` `ListRow`에 `paymentCategory?: string; paymentSheet?: string;` 추가 (date는 기존 `startDateYmd` 재사용).

## 테스트 (TDD RED→GREEN)
- `sheet-select.test.ts`: 실측 시트명 배열 → `"27기비용지급일(26.04~27.03)"`; `[]`/미매칭 → null; `"19기비용지급일"`(접미사 없음)도 파싱.
- `row-map.test.ts`: 헤더행 skip / `2026년·4월·9일·개인` → `2026-04-09` zero-pad / 개인·공용 분류 / 잘못된 월·빈 category skip.
- `queries.test.ts`: fetch mock(token+worksheets+usedRange)로 최신 시트 선택·매핑 검증 (receivables 테스트 방식).
- (선택) `_calendar-helpers` payment 그룹핑 단위 테스트.

## 비범위 (YAGNI)
- DB 동기화/cron, 편집(Excel이 원본), mine 필터, admin 권한 제한(전사 공개).

## 검증
- `npm test` (신규 unit) → `npm run typecheck`/`lint` → dev(3000)에서 27기 지급일이 달력 4월~에 개인/공용 칩으로 표시, 클릭 시 inspector 상세.
