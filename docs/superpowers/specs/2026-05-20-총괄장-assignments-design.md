# 총괄장 (담당자 배정 조회) — 설계

## 배경 / 목적

SharePoint Excel `2027학년도 담당자 배정 v1.0.xlsm`(`SHAREPOINT_ASSIGNMENTS_ITEM_ID`,
메인 드라이브 `General/업무배정/`)의 배정 데이터를 Folio에서 조회/확인할 수 있게 한다.

운영자가 답해야 할 질문:
- "OO대학교는 누가 운영/개발을 맡나?" (대학 → 담당자)
- "김슬기는 어떤 대학을 맡나?" (담당자 → 대학, 양방향)
- "어떤 업무를 누가 담당하나 / 가격정책은 어떻게 되나?" (참고)

읽기 전용. 배정·가격의 source-of-truth는 Excel이며 앱은 조회만 한다.

## 메뉴 / 라우트

- 사이드바 "서비스 그룹 > 서비스사이클" 그룹의 **"서비스" 항목 바로 위**에 `총괄장` 추가
  - slug `assignments`, `src/app/dashboard/_data.ts`의 `sidebarSections` 수정
- `/dashboard/assignments` 단일 페이지, 탭은 `?tab=univ|duties|pricing` (기본 `univ`)
- 탭 바: **[대학배정] [업무분장] [가격정책]** (하위 메뉴 아님 — 페이지 내 탭)
- 활성 탭의 시트만 Graph fetch:
  - `univ` → 5시트 (02 배정리스트 / 03 대학원 / 04 PIMS / 06 성적산출 / 07 상담앱)
  - `duties` → `(참고) 업무분장` 1시트
  - `pricing` → `(참고) 가격정책` 1시트

## 권한

- `features/auth/menu-guard`의 `allowed_menus`에 `assignments` 추가
- 전체 운영자가 메뉴권한 기반으로 조회 (settings처럼 admin 전용 아님)

## 데이터 소스

- 실시간 Graph fetch (receivables 패턴 그대로). 추가 인프라 없음, 항상 최신
- `features/assignments/queries.ts`에 `fetchAssignmentSheet(worksheetName)` — receivables의
  `fetchReceivablesSheet` 흐름 재사용(워크북 usedRange + display text). 단 드라이브/아이템은
  `SHAREPOINT_DRIVE_ID` + `SHAREPOINT_ASSIGNMENTS_ITEM_ID`
- **React `cache()`로 래핑** — 같은 요청 내 중복 시트 호출 dedupe
- 시트 fetch 실패/null → receivables식 안내 박스 표시

## 대학배정 탭 (메인)

### 파서 (`features/assignments/parse.ts`, 순수 함수)

시트별 매퍼가 `AssignmentRecord { university, service, operator, developer }`를 추출.
`service`는 `원서접수 | 대학원 | PIMS | 성적산출 | 상담앱`.

| 시트 | 대학명 | 운영자 | 개발자 | 비고 |
|---|---|---|---|---|
| 02. 배정리스트 | D열 | **수시 기준** (2027 운영자 블록의 수시 = N열) | 수시 (2027 개발자 블록의 수시 = T열) | 2줄 헤더. 데이터 r2부터. 인스펙터에 sub-type/연도 전체 |
| 03. 대학원 | B열 | H열 | I열 | 단일 헤더 r0 |
| 04. PIMS | D열 | G열(운영자 FULL) | (없음) | 인스펙터에 I열(운영자 환/충) 보조 표시 |
| 06. 성적산출 | B열 | E열 | F열 | |
| 07. 상담앱 | B열(학교명) | F열 | G열 | |

> 02.배정리스트 컬럼 인덱스(2027 블록): 운영자 M(재외)/N(수시)/O(정시)/P(편입)/Q(외국인)/R(백업),
> 개발자 S(재외)/T(수시)/U(정시)/V(편입)/W(외국인)/X(백업). 2026 블록 Y~d.
> 그리드 셀 대표값 = 수시(N 운영 / T 개발). 구현 시 헤더 텍스트로 컬럼 인덱스를 검출
> (하드코딩 letter 대신 헤더 매칭 — 컬럼 이동 견고성).

### 조인 / 그리드

- 대학명(trim 정규화) 기준 union → 행 = 대학
- 열: `대학 | 원서접수 | 대학원 | PIMS | 성적산출 | 상담앱`
  - 각 서비스 셀: `운영 OOO / 개발 OOO`, 해당 시트에 없으면 `—`
- ListPattern 새 variant `assignments`로 렌더 (list-variants 레지스트리 1줄 + types.ts Variant union 1줄)
- 식별자(UnivID)는 mono. 일자·금액 없음 (해당 규칙 무관)

### 검색 (양방향)

- ListSearch 재사용. 매칭 대상: 대학명 + 모든 서비스 셀의 운영자/개발자 이름
- 담당자명이 어느 셀에든 포함되면 그 대학 행 노출 → "김슬기" 검색 시 김슬기가 맡은 대학 전부

### 인스펙터 (행 클릭)

- 해당 대학의 5서비스 상세:
  - 원서접수: 재외/수시/정시/편입/외국인 운영·개발 + **2027/2026 연도** 모두
  - PIMS: 운영자 FULL + 운영자 환/충
  - 나머지: 운영/개발 + (있으면) 前 운영/개발, 비고

## 업무분장 · 가격정책 탭

- 각 시트 usedRange를 **read-only 그리드**로 그대로 렌더 (행/열 그대로, 빈 셀 공백)
- 별도 파싱/재구성 없음 — 병합셀·좌우 블록 등 원본 레이아웃 보존
- 공통 `SheetGrid` 컴포넌트 1개 (headers 없이 raw rows 렌더)

## 컴포넌트 / 파일 (예상)

- `features/assignments/queries.ts` — `fetchAssignmentSheet` (cache)
- `features/assignments/parse.ts` — 시트별 파서 + 조인 + 검색 매칭 (순수)
- `features/assignments/schemas.ts` — `AssignmentRecord`, `UnivAssignmentRow`, service union
- `app/dashboard/assignments/page.tsx` — 탭 분기 + 권한 가드 + fetch
- `app/dashboard/assignments/_components/AssignmentTabs.tsx` — 탭 바(?tab 링크)
- `app/dashboard/assignments/_components/SheetGrid.tsx` — raw 그리드 (업무분장/가격정책)
- list-variants/assignments/ (View/Table 등) — 대학배정 인스펙터/테이블

## 테스트 (TDD)

- 파서 순수함수 단위 테스트 — 시트별 고정 fixture:
  - 02 배정리스트: 2줄 헤더 스킵, 수시 운영/개발 추출, 2027/2026 블록 분리
  - 03/04/06/07: 운영/개발 컬럼 추출, PIMS 개발자 없음
- 조인: 대학명 union, 미존재 서비스 `—`
- 검색 매칭: 대학명 + 담당자명 양방향
- Graph fetch는 mock. 페이지는 시트 null 시 안내 표시
- RED → GREEN → REFACTOR 준수

## 범위 밖 (YAGNI)

- Excel 쓰기/편집 (조회 전용)
- operators 테이블과 이름 매핑/링크 (이름 문자열 표시만)
- 업무분장/가격정책 구조화 파싱 (그리드 렌더로 충분)
- 05.모의논술 / 08.채널 등 사용자가 지정하지 않은 시트
