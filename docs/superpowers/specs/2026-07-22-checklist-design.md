# 원서접수 점검사항 체크리스트 — 설계 문서

- 작성일: 2026-07-22
- 상태: 설계 확정 (구현 대기)
- 참고: SharePoint `General/원서접수 점검사항 체크리스트.xlsx` (구조 참고용 — **연동하지 않음**)

## 1. 배경 · 목적

원서접수 회차(수시/정시)마다 각 부서가 점검 항목을 채우던 SharePoint 엑셀 협업을 OPS-Console 웹 기능으로 대체한다.

- 각 부서가 **공유 링크**로 자기 섹션을 작성 (로그인 불필요)
- 작성 내용 **자동 저장**
- 임원에게 **페이지 형태 보고** + **PDF 저장**

기존 `운영리포트(reports)` 메뉴·리포트 화면 골격을 그대로 이식한다 (신규 룩 만들지 않음).

## 2. 비목표 (Non-goals)

- SharePoint/엑셀 연동(임포트·양방향 동기) **안 함**. 엑셀은 항목 구조 설계의 참고 자료일 뿐이다.
- 부서 사용자용 OPS-Console 계정 발급 안 함 (링크 토큰이 곧 인증).
- 실시간 동시편집(CRDT/OT) 안 함 (항목 단위 last-write-wins 자동저장).

## 3. 엑셀 구조 분석 결과 (설계 근거)

- 시트 = **접수 회차** (예: 2027 수시모집 / 2026 정시모집 / 2026 수시모집)
- 4열 계층: **부서(작성자)** → **분야** → **항목** → **점검 결과**
  - 부서: 기획파트 · 운영부 · 고객지원팀 · 개발부 · 영업부 (5)
  - 분야: 접수서비스 · 결제사 · 매출 · 정산 · 대교협 · 사이트 · 스마트경쟁률 · 마케팅 · 고객센터운영 · 서버/시스템 · 모니터링 · 입학홈페이지 등
  - 점검 결과: 자유 텍스트(완료/작업중/작업전 + 날짜·메모 혼합)
- 설계 반영: 자유텍스트 결과를 **상태(enum) + 메모(자유텍스트)** 로 구조화 → 완료율·부서 진행률 자동 산출.

## 4. 메뉴

`src/app/dashboard/_data.ts`의 `분석 · AI > 분석 & 보고` 그룹, `운영리포트` 항목 옆에 1줄 추가:

```ts
{ ico: "·", label: "체크리스트", slug: "checklist", pattern: "list" }
```

`page-meta-config.ts`에 `checklist` 메타 1개 추가 (headline `분석 · 보고 / 원서접수 점검`). 권한: 일반 메뉴(로그인 사용자 조회), 회차 생성·관리는 admin.

## 5. 라우트 (reports 골격 이식)

| 경로 | 역할 | 접근 | 이식 골격 |
|---|---|---|---|
| `/dashboard/checklist` | 회차 목록 + '새 회차' 버튼 | 로그인 | `reports/page.tsx` (PageHeader + 목록) |
| `/dashboard/checklist/[id]` | 회차 상세·관리(제목·메타·부서별 링크 발급·PDF·전체 현황) | 로그인 | `reports/[id]` + `ReportDetail` |
| `/r/checklist/[token]` | 공유 링크 — 토큰 종류로 분기 | **비로그인(토큰)** | `/r/[token]/page.tsx` |
| `/api/checklist/[id]/pdf` | PDF 스트림 | 로그인 | `/api/reports/[id]/pdf` |

`/r/checklist/[token]` 분기:
- 토큰 `kind='dept-fill'` → 해당 **부서 작성 폼**(쓰기): 자기 부서 섹션만, 상태 칩 + 메모 + 항목 추가/수정/삭제 + 자동저장
- 토큰 `kind='report'` → **임원 보고/공유 뷰**(읽기 전용): 전체 회차 리포트

토큰 스코프 쓰기는 별도 API 없이 공개 페이지의 **server action**(`fill-actions.ts`)으로 처리 — 액션 내부에서 토큰을 검증한다. `proxy.ts` `PUBLIC_PATHS`는 `pathname === p || startsWith(`${p}/`)` 매칭이고 `/r` 이 등록돼 있어 `/r/checklist/...` 및 그 페이지의 server action이 자동 공개된다 (확인 완료).

## 6. 데이터 모델 (Supabase 신규)

### `checklist_rounds`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| title | text | 예: "2027학년도 수시모집" |
| period_start / period_end | date | 점검 기간 |
| status | text | `draft` / `active` / `closed` |
| created_by | text | operators.email |
| created_at | timestamptz | |

### `checklist_items`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| round_id | uuid FK → rounds (on delete cascade) | |
| department | text | 5개 부서 enum(체크제약) |
| category | text | 분야 |
| title | text | 항목 |
| status | text nullable | `done`/`in_progress`/`todo`/`na` (null=미지정) |
| note | text | 메모 |
| sort_order | int | 부서·분야 내 정렬 |
| updated_at | timestamptz | |
| updated_by | text nullable | 부서 작성자 표기(선택) |

### `checklist_share_tokens`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| round_id | uuid FK → rounds (cascade) | |
| kind | text | `dept-fill` / `report` |
| department | text nullable | kind=dept-fill일 때 필수 |
| token | text unique | crypto 랜덤(추측불가) |
| enabled | boolean default true | admin 비활성/재발급 |
| created_at | timestamptz | |

RLS: 서버(service_role)만 쓰기. 공개 라우트는 server action/route가 토큰 검증 후 service_role로 처리 (`reports` share 패턴 동일).

## 7. 상태 모델

- 상태 enum: `done`(완료) · `in_progress`(진행중) · `todo`(작업전) · `na`(해당없음) · null(미지정)
- 색: 완료=초록, 진행중=amber, 작업전=회색, 해당없음=자주 (design-tokens 등록)
- 완료율 = done / (전체 − na). 부서 진행률·전체 요약 KPI에 사용.

## 8. 자동 저장

- **상태 칩 클릭** → 즉시 저장 (server action, 낙관적 UI)
- **메모 입력** → 디바운스 ~800ms 후 저장 (blur 시 flush)
- **항목 추가/수정/삭제** → 즉시 저장
- 공개(토큰) 쓰기 경로: `{token, itemId?, department, patch}` → 서버가 (1) 토큰 유효·enabled·kind=dept-fill 확인 (2) 대상 항목이 **토큰의 (round, department)에 속하는지** 확인 (3) zod 검증 후 반영. 다른 부서/회차 쓰기 차단.
- 각 항목 행에 저장 상태 표시(✓ 저장됨 / 저장 중 / 미저장).

## 9. 회차 생성 · 항목 시딩 (엑셀 비의존)

`새 회차` 모달에서 3가지 시작 방식:
1. **기본 템플릿에서 시작** — 코드 내장 `CHECKLIST_TEMPLATE`(엑셀 분석 기반 부서/분야/항목 기본안)로 items 시딩
2. **이전 회차 복제** — 기존 회차 items 복사 + 상태/메모 비움
3. **빈 회차** — items 없이 생성 (부서가 링크에서 직접 추가)

`CHECKLIST_TEMPLATE` (초안 — 구현 시 확정):
- 기획파트: 사이트(PC/M)[광고배너 노출, 주요 화면·기능, M 인기경쟁률 로직, M 대학별 프로그램 로직, 페이지 리얼배포·오류 모니터링]
- 운영부: 접수서비스[테스트오픈·당직배정], 결제사[비상연락망·세팅], 매출[접수건수 예측], 정산[진학캐쉬 환불], 대교협[검증계획서·비상연락망·서비스목록·고교DB], 스마트경쟁률, 사이트/마케팅
- 고객지원팀: 콘텐츠 제작·배포, 고객센터 운영[인력·장비·상담원 교육·계정]
- 개발부: 서버/시스템[고교데이터·PG세팅·인증서·경쟁률·웹서버·배포], 모니터링
- 영업부: 원서접수, 입학홈페이지[일정정리·인트로·팝업·메인이미지]

항목 추가/수정/삭제는 **모든 부서**가 자기 섹션에서 가능(dept-fill 토큰 범위).

## 10. 임원 보고 뷰 · PDF

- 보고 뷰(`kind=report` 공유 + `/dashboard/checklist/[id]` 본문): 상단 요약 KPI(전체/완료/진행중/작업전) + 부서 → 분야 → 항목·상태·메모. `KpiCard`·플랫 `bg-situation-bg` 골격.
- PDF: `src/lib/pdf/checklist-pdf.tsx` 신규 — 보고 뷰와 동일 그룹 레이아웃, 모든 페이지 고정 헤더(회차·`[운영부 상황실]`)+푸터(자동생성·페이지), 상태 배지. `@react-pdf/renderer` + Pretendard(기존 `report-pdf` 패턴).

## 11. 컴포넌트 구성 (reports 구조 미러)

```
src/app/dashboard/checklist/
  page.tsx                     # 회차 목록
  _components/
    RoundsList.tsx             # 회차 카드 목록 (ReportsList 골격)
    NewRoundButton.tsx / NewRoundModal.tsx   # 시작 방식 선택
    ChecklistSummary.tsx       # 요약 KPI 스트립 (KpiGrid 재사용/골격)
    DeptSection.tsx / CategoryGroup.tsx / ItemRow.tsx  # 그룹 렌더
  [id]/
    page.tsx                   # 회차 상세
    _components/ RoundDetail.tsx / ShareLinks.tsx (부서별 링크 발급·활성)
src/app/r/checklist/[token]/page.tsx  # 공개 분기 (fill/report)
  _components/ FillForm.tsx (쓰기) / ReportView.tsx (읽기)
src/features/checklist/
  schemas.ts (zod: 상태 enum·부서 enum·patch)
  queries.ts (회차·항목·토큰 조회, 완료율 계산)
  actions.ts (회차 생성/복제, 항목 CRUD, 토큰 발급/토글)
  fill-actions.ts (토큰 스코프 공개 쓰기)
  template.ts (CHECKLIST_TEMPLATE)
  completion.ts (완료율 순수 계산)
src/lib/pdf/checklist-pdf.tsx
supabase/migrations/2026xxxx_checklist.sql (3테이블 + RLS + GRANT)
```

## 12. 검증(테스트) 계획

- **순수함수(unit)**: 완료율 계산(na 제외), 템플릿→items 매핑, 상태 enum/zod, 정렬.
- **토큰 스코핑(핵심 보안)**: dept-fill 토큰으로 (a)자기 부서 항목 쓰기 성공 (b)타 부서 항목 쓰기 거부 (c)비활성 토큰 404 (d)report 토큰으로 쓰기 거부.
- **회차 복제**: 항목 복사 + 상태/메모 초기화 확인.
- **integration**: 공개 쓰기 route valid/invalid 토큰.
- **E2E(Playwright)**: 부서 링크 열기 → 상태 변경 → 자동저장 → 보고 뷰 반영. RED→GREEN 준수(tdd.md).

## 13. 가정 · 미결

- 부서 목록은 5개 고정(체크제약). 추가 필요 시 제약·템플릿 갱신.
- 토큰 만료/암호 없음(추측불가 토큰 + admin 토글로 충분 — 사용자 결정).
- 회차 생성·토큰 발급은 admin(운영부). 부서는 링크로 작성만.
