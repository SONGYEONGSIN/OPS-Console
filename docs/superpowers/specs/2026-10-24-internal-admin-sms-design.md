---
share: true
status: 초안
updated: 2026-10-24
revision: 1
---

# 프로젝트 > 내부관리자 — SMS 발신번호 사전등록 현황을 웹에서 본다

> 근거: Report 세션 인계 문서(`design-ref/internal-admin-sms/handoff.md`, gitignore) · 1차 시안(`design-ref/internal-admin-sms/mockup-v1.html`, https://claude.ai/artifact/UWRiiLmwVbFK8Hq5dFcZFw)

**질문**: 101개 학교·592회선의 사전등록 현황(SharePoint xlsm + 학교별 통합 PDF)을 엑셀을 열지 않고 웹에서 찾아보고, 나중에는 추가 제출 서류까지 웹에서 처리할 수 있게 하려면 무엇을 어떤 순서로 만드나.
**날짜**: 2026-10-24

## 1. 한 줄 결론

`/dashboard/internal-admin` 에 전용 페이지를 만들고, 페이지 안 탭 한 줄(개요·학교·발신번호·추가 제출·확인 필요)을 둔다. **1단계(이번 PR)는 읽기 전용** — xlsm 숨김 시트 4개와 `03. 학교별 제출 서류` 폴더 목록을 Graph 로 읽어 10분 캐시하고, 학교·발신번호·확인 필요 탭을 보여 준다. 추가 제출 처리(쓰기)와 책갈피는 별도 PR.

## 2. 지금

- 사이드바 `프로젝트 > 내부관리자`(slug `internal-admin`)는 `[slug]` catch-all 이 `ProjectPattern` 목업(`_data/patterns.ts` makeProject)을 그린다. 실제 데이터가 없다.
- 현황은 SharePoint `ApplyService2 / 문서 / 내부관리자/01. SMS 발신번호 사전등록/` 의 xlsm(VBA, 하이퍼링크로 시트 간 이동)으로만 본다. 담당자가 엑셀을 열어 검색칸에 학교명을 넣어야 한다.

## 3. 확정 입력 (조사 대상 아님)

- 탭은 한 줄: `[개요] [학교] [발신번호] [추가 제출] [확인 필요]`. 사이드바 계층은 늘리지 않는다.
- 데이터 원본은 당분간 xlsm. 웹이 쓰는 건 추가 제출 처리 때뿐(2단계).
- 추가 제출 처리 순서: 가림 → 사람 확인 → 통합 PDF 정해진 자리에 끼우기/교체 → 원본 99 보관 → xlsm 갱신.
- xlsm 은 몇 분 단위 캐시 + 화면에 기준 시각 표시. 이번 PR 은 1단계까지.

## 4. 실측으로 확인한 것 (2026-10-24, Graph app-only)

| 항목 | 실측 | 설계 영향 |
|---|---|---|
| 드라이브 | `ApplyService2` 의 `문서` = 기존 `SHAREPOINT_DRIVE_ID` | 새 env 불필요 |
| 현황 파일 | 루트에 `현황_261015.xlsm`·`현황_261017.xlsm` **두 개** | 이름 고정 금지 — `현황_YYMMDD.xlsm` 중 **최신 날짜**를 고른다 |
| 숨김 시트 | `_학교`(101행) `_서류`(101) `_번호`(592) `_확인`(22), 1행이 헤더 | 보이는 시트(INDEX 수식 화면)는 안 읽는다. 맨 끝 `고를 값` 열(U)과 P/T 보조열은 버린다 |
| 읽기 속도 | `_번호` usedRange 1회 ≈ 0.5초 | 4시트 + 폴더 = 약 2초 → 캐시 필요 |
| 통합 PDF | 131개, 이름 규칙 위반 0 | 학교명 = 파일명 `(…)` |
| **한 학교 한 단계?** | **아니다.** 고유 학교 88곳, 그중 **43곳이 `검토완료` 와 `제출완료/*` 두 폴더에 다 있다** | 단계 = 가장 앞선 폴더(제출완료 > 검토완료 > 진행 중). 다른 폴더 사본은 상세에 함께 표시 (§14-1) |
| 이름 대조 | PDF 6개가 xlsm 이름과 다르다(`연세대학교`↔`연세대학교(서울)`, `건국대학교 서울캠퍼스`↔`건국대학교(서울)`, `동국대학교WISE`↔`동국대학교(WISE)` 등) | 코드 별칭표(사람이 확인한 줄만). 매칭 안 되면 'PDF 없음'이 아니라 '이름 미대조'로 드러낸다 |
| PDF 없는 학교 | xlsm 101곳 중 별칭 반영 후에도 약 13곳 | 'PDF 없음' 표시 (xlsm `_서류` 의 '서류 확인 안 됨'과 일치하는지 테스트로 대조) |
| `_학교` 중복 | `을지대학교` 2행 | 키를 학교명이 아닌 `No` 로 둔다 |
| `_확인` 상태 열 | **없다**(No·유형·대상·내용·근거·할 일) | 시안의 '열림/완료' 필터는 1단계에서 뺀다. 대상은 `학교명\n번호` 자유 텍스트 → 첫 줄로 학교 연결 |
| xlsm PDF 하이퍼링크 | 261017 판에는 없다 | 링크는 폴더 목록에서 만든다 |
| 쪽 번호 | xlsm 에 없음 | '서류 → PDF 해당 쪽'은 책갈피 PR 이후. 1단계는 통합 PDF 열기까지 |

코드 측:
- 전용 폴더 `src/app/dashboard/internal-admin/page.tsx` 를 두면 `[slug]` 보다 우선한다(선례 #1205 work-assignment). 헤드라인을 위해 `_data/page-meta-config.ts` 1줄 필요.
- `ProjectPattern` 의 패널은 export 되지 않음 → 개요 탭은 컴포넌트 통째로 재사용.
- 캐시 선례: `features/payment-dates/queries.ts` (react `cache()` + 모듈 TTL 10분, Graph fetch `no-store`).
- 권한: `requireMenu` → `canViewMenu`. **`allowed_menus` 는 로드만 되고 판정에 안 쓰인다** — 메뉴별 보기 제한은 지금 구조로 불가능.

## 5. 라우트·탭·권한 경계

- 라우트 `/dashboard/internal-admin?tab=overview|schools|numbers|submissions|checks`, 기본 `schools`(모르는 값도 기본). `components/common/PageTabs` 사용(work-assignment 와 같은 방식).
- 1단계 탭: 개요·학교·발신번호·확인 필요. `추가 제출` 탭은 2단계에서 붙인다(1단계에선 탭을 안 보인다 — 비어 있는 탭을 두지 않는다).
- **보기**: 로그인 사용자 전원(`requireMenu("internal-admin")`). 화면 데이터는 학교명·대표번호·서류 O/✕ 수준이고, PDF 는 SharePoint 링크라 열람은 SharePoint 권한이 다시 막는다. (보기 제한이 필요하면 `allowed_menus` 판정부터 살려야 해서 별도 작업 — §14-3)
- **처리(2단계)**: admin 또는 `operator.department === "운영부"`. 서버 action 이 다시 판정한다.

## 6. 화면

### 6.0 공통
- 헤더 부제: `현황 파일 _261017.xlsm · 기준 HH:mm` + `새로고침`(캐시 무효화 server action) + `서류 기준` 버튼(05 시트 내용 → `ModalShell`).
- 05 시트는 자주 안 바뀌는 기준표라 1단계는 **읽어서 그대로** 표로 보인다(가공하지 않음).
- 날짜는 `kstFormat`, 숫자는 `tabular-nums`, 행 호버·선택은 표준(`hover:bg-line-soft`, vermilion 선택).

### 6.1 개요
- 기존 `ProjectPattern`(목업 데이터) 그대로.

### 6.2 학교
- 구분 카드 4장(`KpiCard`: 4년제·전문대학·대학원·초중고 — 곳/회선/서류 미비/확인). 카드 클릭 = 구분 필터(`?gubun=`), 00 요약 시트 대체.
- 필터 줄: 학교 검색(`ListSearch`) · 단계 · 서류(완비/미비/확인 안 됨) · 확인 필요만.
- 표: 학교명 · 구분 · 단계 · 회선 · 서류 8칸 점(O/✕/대체/빈칸) · 확인 · PDF.
- 행 클릭 → `InspectorPanel`: 서류 8종 상태 + 미제출 사유 · 통합 PDF 열기(사본 폴더가 둘이면 둘 다) · 발신번호(최대 10줄 + '발신번호 탭에서 전체 보기' = `?tab=numbers&q=학교명`) · 이 학교 확인 필요 항목.
- 필터·선택은 URL 파라미터(새로고침·링크 공유에 살아남게).

### 6.3 발신번호
- 큰 검색창: **하이픈·공백 무시** 부분 일치(`0221644000` 으로 `02-2164-4000` 찾기), 학교명도 같은 칸.
- 필터: 상태(일괄 등록/추가 등록/서류 미비) · 구분.
- 표: 발신번호 · 학교 · 상태 · 등록일 · 제출 서류 · 비고. Moa 열은 3단계(권한 문제로 목록 미확보).
- 592행 — 페이지네이션(`ListPagination`, 50행).

### 6.4 확인 필요
- 표: 유형 · 대상 · 내용 · 근거 · 할 일. 유형 필터.
- 대상 첫 줄이 학교와 맞으면 링크 → `?tab=schools&school=No`.

## 7. 데이터 계층 (`src/features/sms-sender/`)

- `source.ts` (server-only): 최신 xlsm 고르기 → 4시트 usedRange(valuesOnly) + `03` 폴더 재귀 목록. 결과에 파일명·`lastModifiedDateTime`·읽은 시각.
- `parse.ts` (순수 함수, 테스트 대상): 헤더 이름으로 열 찾기(위치 고정 금지 — 열이 끼면 조용히 틀린다), 행 → `School` / `SenderNumber` / `CheckItem` / `DocStatus`, PDF 목록 → 학교별 단계·링크, 별칭 적용, 하이픈 제거 정규화.
- `aliases.ts`: PDF 이름 → xlsm 이름 6줄(사람이 확인한 것만).
- `queries.ts`: react `cache()` + 모듈 TTL 10분(`payment-dates` 와 같은 모양) + `refreshSmsSenderCache` action.
- 헤더가 바뀌어 필수 열을 못 찾으면 **빈 표가 아니라 오류 화면**(어느 시트의 어느 열인지). xlsm 은 사람이 손으로 고치는 파일이라 이게 가장 흔한 고장이다.
- DB 테이블·마이그레이션 없음.

## 8. 잡
- 없음(1단계). 2단계에서 `00. 추가 제출 접수` 폴더 감시 여부를 정한다.

## 9. 영향 파일 (1단계, 약 14개 → 간략 설계 등급)

신규
- `src/app/dashboard/internal-admin/page.tsx`
- `src/app/dashboard/internal-admin/_components/` — `SchoolsTab.tsx` · `SchoolInspector.tsx` · `NumbersTab.tsx` · `ChecksTab.tsx` · `CriteriaModal.tsx` · `SourceBar.tsx`(기준 시각·새로고침)
- `src/features/sms-sender/` — `source.ts` · `parse.ts` · `aliases.ts` · `queries.ts` · `actions.ts` · `types.ts`
- `src/features/sms-sender/__tests__/parse.test.ts` (실측 헤더 그대로의 픽스처)

수정
- `src/app/dashboard/_data/page-meta-config.ts` (+1 항목)

## 10. PR 분해

| PR | 내용 | 파일 |
|---|---|---|
| **PR-1 (이번)** | 읽기 전용: 페이지·탭 4개·데이터 계층·캐시 | ~14 |
| PR-2 | 통합본 131개 책갈피 스크립트(`scripts/sms-sender/`, `pdf-lib`) — 쪽 번호로 서류 경계 판정, 사람 확인 후 덮어쓰기 | ~4 |
| PR-3 | 학교 상세의 '서류 → PDF 해당 쪽'(책갈피 읽기) | ~3 |
| PR-4 | 추가 제출 탭: 업로드·미리보기·가림 확인·끼워 넣기·99 보관·xlsm 갱신(423 대기·재시도)·이력 테이블 | 별도 설계 |
| PR-5 | OCR 자동 가림(Azure AI Vision Read) · Moa 비교 열 | 별도 설계 |

## 11. 코드 밖 등록 체크리스트
- 없음(1단계). Azure AD 앱의 기존 `Sites`/`Files` 읽기 권한으로 실측 완료.

## 12. 리스크
- **사람이 xlsm 구조를 바꾼다** → 헤더 이름 기반 + 못 찾으면 오류 화면(§7).
- **새 현황 파일 이름이 규칙을 벗어난다**(`현황_261017(수정).xlsm` 등) → 규칙 밖이면 무시하지 말고 기준 바에 '규칙 밖 파일 N개' 표시.
- **캐시 10분 동안 옛 값** → 기준 시각 + 새로고침 버튼.
- **`고를 값` 열(U)은 행 데이터가 아니다** — 드롭다운 목록이라 행과 무관한 값이 같은 줄에 있다(`_학교` 2행 `구분=4년제`, U=`전문대학`). 열을 위치로 읽다 U를 집으면 구분이 틀린다 → 헤더 이름 기반 + 테스트로 고정.

## 13. 비범위
- xlsm 쓰기, PDF 수정, 추가 제출(PR-4), Supabase 이전, Moa 비교, 사이드바 구조 변경.

## 14. 열린 질문
1. **두 폴더에 다 있는 43곳**: `검토완료` 사본과 `제출완료` 사본이 같은 파일인가, 단계별로 다른 판인가? (추가 제출 때 어느 쪽에 끼울지가 여기서 갈린다 — PR-4 전에 확정 필요. 1단계는 둘 다 보여 준다)
2. **PDF 이름 6건 별칭**: §4 표의 짝이 맞는지(특히 `연세대학교` → `(서울)`, `한양대학교` → `(서울)`/`(ERICA)` 중 어느 쪽인지).
3. **보기 권한**: 로그인 사용자 전원으로 충분한가, 운영부만으로 좁힐 것인가.
4. `00 요약` 의 '확인 필요 23건' vs `_확인` 22행 — 차이 1건이 무엇인지(요약이 정적 숫자라 낡았을 가능성).
