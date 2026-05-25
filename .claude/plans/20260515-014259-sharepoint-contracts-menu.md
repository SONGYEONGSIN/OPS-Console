---
plan_id: 20260515-014259-sharepoint-contracts-menu
status: completed
created: 2026-05-14T16:42:59Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260515-013850-sharepoint-contracts-menu.md
---

# Plan: SharePoint 계약서 → /dashboard/contracts 메뉴 (PR-1)

## Goal

운영부가 SharePoint Excel(`SHAREPOINT_CONTRACTS_ITEM_ID`)에서 직접 편집하는 계약 데이터(4년제 / 2년제 / 대학원 / … / 기타 시트)를 Folio `/dashboard/contracts`에서 read-only 통합 조회. 목록은 최소 컬럼만 노출, 인스펙터에서 전체 컬럼 상세. 1차 PR은 view만 — 등록·수정·삭제 X.

## Approach

**대안 A** (brainstorm 추천): SharePoint 직접 read. receivables 도메인 단일 시트 fetch 패턴을 *다중 시트* 동시 fetch로 확장. DB 없음, source-of-truth = SharePoint. list-variants 12번째 `contracts` slot 신설.

`Promise.all`로 시트 N개 usedRange 동시 fetch + `revalidate = 60`으로 서버 캐시. 시트별 컬럼 차이는 T1 자동 분석 결과 기반 공통 최소 컬럼 정의 + 인스펙터에서 시트별 dim 노출.

## Out of Scope

- 등록·수정·삭제 액션 (read-only)
- DB 테이블 / RLS (SharePoint이 source)
- 다른 도메인(services / backup) FK 연동 — follow-up
- 양방향 sync (SharePoint ↔ Folio)
- 시트별 schema 정규화 — 공통 최소 컬럼만 표면화

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `scripts/inspect-contracts.mjs` | 신규 | T1 일회성 분석 (시트 list + 헤더 fetch) |
| `src/features/contracts/types.ts` | 신규 | `ContractRow` + sheet enum |
| `src/features/contracts/schemas.ts` | 신규 | zod (최소 검증, read-only) |
| `src/features/contracts/queries.ts` | 신규 | 다중 시트 fetch + 통합 row 매핑 |
| `src/app/dashboard/_components/inspector/list-variants/contracts/Table.tsx` | 신규 | 리스트 row (최소 컬럼 + sheet 뱃지) |
| `src/app/dashboard/_components/inspector/list-variants/contracts/View.tsx` | 신규 | 인스펙터 상세 (전체 컬럼 read-only) |
| `src/app/dashboard/_components/inspector/list-variants/contracts/filters.ts` | 신규 | 시트(학제) 필터 옵션 |
| `src/app/dashboard/_components/inspector/list-variants/registry.ts` | 수정 | contracts 1줄 등록 |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | 수정 | Variant union에 `contracts` 추가 |
| `src/app/dashboard/contracts/page.tsx` | 신규 | SSR fetch + ListPattern 연결 |
| `.env.example` | 수정 | `SHAREPOINT_CONTRACTS_ITEM_ID` 문서화 |
| `e2e/dashboard-contracts.spec.ts` | 신규 (선택) | T8 smoke |

총 11~12 파일 (선택 1 포함). **HARD-GATE 간략 설계** (6~19 범위).

## 단계

### T1: 시트 구조 자동 분석 스크립트
- **상태**: done
- **파일**: `scripts/inspect-contracts.mjs`
- **변경**: Microsoft Graph `GET /workbook/worksheets`로 시트 이름 list + 각 시트 `usedRange?$select=text` 첫 5행 fetch. 결과를 `시트명 / 헤더 array / 샘플 row` 형태로 stdout 로깅
- **DoD**: `node scripts/inspect-contracts.mjs` 실행 시 모든 시트의 헤더 + 샘플 3건이 한눈에 출력 → 최소 노출 컬럼 후보 N개 + 시트별 정합/차이 식별. 결과를 이 plan의 별도 섹션 또는 노트에 옮겨 후속 단계 입력
- **의존**: 없음
- **완료일**: 2026-05-14

#### T1 분석 결과

**8 시트 발견** — 노출 5 / 제외 3:

| Index | 시트명 | rowCount | 처리 |
|-------|--------|----------|------|
| 0 | ★학부 계약현황★ | 11 | **제외** (요약/통계, DIV/0!) |
| 1 | 4년제 | 177 | **노출** |
| 2 | 전문대 | 129 | **노출** |
| 3 | 초중고 | 51 | **노출** |
| 4 | 대학원 | 53 | **노출** |
| 5 | 기타(전문학교,모의논술,공공 등) | 19 | **노출** |
| 6 | 진학프로 | 103 | **PR-N follow-up** (형태 다름: 계약기간/계약금액/URL) |
| 7 | 통합DB 연동용(수정X) | 295 | **제외** (lookup 시스템 시트) |

**노출 시트 5개** (시트 enum): `"4년제" | "전문대" | "초중고" | "대학원" | "기타"`

**공통 최소 컬럼 (Table)**:
- `sheet` (학제 뱃지)
- `numbering` (넘버링 — D-1-01, E-1-01 등)
- `name` (대학명/학교명 — 시트별 컬럼명 다르나 의미 동일하므로 통합)
- `operator` (운영자)
- `status` (계약진행현황 — 계약완료 / 공란)
- `serviceActive` (서비스여부 — Y / 공란)
- `feeAmount` (수수료(VAT포함))

**시트별 헤더 행 정합**:
- 4년제 / 초중고 / 대학원 / 기타: row 0이 헤더
- 전문대: row 0 헤더 + row 2 sub-header
- ⇒ `detectHeaderIndex` 휴리스틱 사용 (receivables 패턴). 후속 단계에서 검증 필요. 잘못 감지 시 시트별 명시 매핑 추가

### T2: contracts types + schemas
- **상태**: pending
- **파일**: `src/features/contracts/types.ts`, `src/features/contracts/schemas.ts`
- **변경**: T1 결과 기반 `ContractRow` 타입 + sheet enum (`'4년제' | '2년제' | …`) 정의. zod schema는 최소 (read-only)
- **DoD**: `npm run typecheck` 0 에러
- **의존**: T1
- **완료일**: 

### T3: queries 다중 시트 fetch
- **상태**: pending
- **파일**: `src/features/contracts/queries.ts`
- **변경**: receivables `queries.ts` 패턴 복제 + `Promise.all`로 모든 시트 usedRange 동시 fetch. row에 `sheet` dimension 주입. `detectHeaderIndex` 재사용. 응답: `{ rows: ContractRow[], total: number, sheetsCount: number }`
- **DoD**: 임시 dev 로그 또는 unit test에서 row 총개수 + sheet별 분리 확인
- **의존**: T2
- **완료일**: 

### T4: list-variants `contracts` slot 신설
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/contracts/{Table,View,filters}.tsx`
- **변경**: Table=최소 컬럼 + sheet 뱃지. View=전체 컬럼 read-only display. filters=시트(학제) 옵션. **EditForm 생략** (read-only)
- **DoD**: 컴포넌트 typecheck + lint 통과. 빈 rows일 때 "데이터 없음" 안내 노출
- **의존**: T2
- **완료일**: 

### T5: registry + Variant union 등록
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/registry.ts`, `src/app/dashboard/_components/inspector/list-variants/types.ts`
- **변경**: `contracts` 1줄 추가 (View + Table + Filters만, EditForm 없음) + Variant union에 추가
- **DoD**: typecheck — InspectorListBody / ListPattern dispatcher 컴파일 OK
- **의존**: T4
- **완료일**: 

### T6: page.tsx SSR 연결
- **상태**: pending
- **파일**: `src/app/dashboard/contracts/page.tsx`
- **변경**: services/page.tsx 형식 따라 SSR fetch + ListPattern variant=`contracts` 렌더. 시트 필터 searchParams 지원. `revalidate = 60` 또는 segment cache 결정 (Graph fetch 응답 시간 측정 후)
- **DoD**: 로컬 `/dashboard/contracts` 진입 200 OK + 시트 통합 list 노출 + 인스펙터 클릭 시 상세 view. 콘솔 hydration warning 0 (PageTabs 백로그 무관)
- **의존**: T3, T5
- **완료일**: 

### T7: `.env.example` 보강
- **상태**: pending
- **파일**: `.env.example`
- **변경**: `SHAREPOINT_CONTRACTS_ITEM_ID=<your-item-id>` 한 줄 추가 (이미 있으면 skip)
- **DoD**: `grep SHAREPOINT_CONTRACTS_ITEM_ID .env.example` 1 행
- **의존**: 없음 (T1~T6과 병렬)
- **완료일**: 

### T8: E2E smoke (선택)
- **상태**: pending
- **파일**: `e2e/dashboard-contracts.spec.ts`
- **변경**: `/dashboard/contracts` 진입 + 행 ≥1 + 인스펙터 클릭 smoke
- **DoD**: `npm run test:e2e -- --workers=1 -g contracts` 통과
- **의존**: T6
- **완료일**: 

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| Graph 8회 fetch → 응답 3초 초과 | `Promise.all` 동시 + Next.js `revalidate = 60` 서버 캐시. T6에서 응답 시간 측정 |
| 시트별 헤더 불일치 (4년제 vs 기타) | T1 분석에서 *공통 최소 컬럼* 식별. 시트별 차이는 인스펙터 view에서만 |
| JS Number 정밀도 (계약 ID 큰 정수) | `usedRange?$select=text`로 문자열 fetch (receivables와 동일) |
| Graph 일시 실패 → 빈 화면 | error boundary로 명확한 상태 표시. `/login` redirect 금지 |
| viewer 권한 분리 | menu 권한(`allowed_menus`)에 `contracts` 등록 확인 (DB 작업) |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-14T16:42:59Z | — | plan 생성 | brainstorm 20260515-013850 입력 |
| 2026-05-14T16:50:00Z | T1 | pending → done | 8 시트 분석, 노출 5 / 제외 3 / follow-up 1. 공통 최소 컬럼 7개 식별 |
