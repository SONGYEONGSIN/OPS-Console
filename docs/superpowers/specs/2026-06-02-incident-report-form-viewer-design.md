# 경위서 실제 양식 뷰어/편집 모달 — 설계 스펙

> 상태: **설계 확정** (사용자 승인 2026-06-02) — 구현 전.
> 선행 자산: `docs/refs/경위서-메뉴-설계노트.md`(경위서 도메인 1차 설계). 본 스펙은 그 위에 "화면에서 실제 양식 보기·편집" 레이어를 얹는다.

## 1. 목표

인스펙터 경위서 탭은 현재 4섹션(경위/원인/처리/대책)을 **단순 텍스트 블록**으로만 보여준다. 실제 출력물(공문 + 경위서 본문 2장)의 모양은 PDF(`incident-report-pdf.tsx`)로만 존재한다.

운영자가 **실제 양식 모양 그대로의 문서를 화면에서 보고, 내용을 수정하면 그 양식 미리보기에 실시간 반영**되도록 한다.

## 2. 핵심 원칙

**"보는 것 = 보내는 것"** — 화면 HTML 미리보기와 출력 PDF가 **같은 콘텐츠 소스**(`form-content.ts`)를 공유하여 절대 어긋나지 않는다. 레이아웃 렌더링은 매체별로 다르지만(HTML/Tailwind vs @react-pdf StyleSheet), 보일러플레이트 문구·파생 로직은 단일 소스.

## 3. 결정 사항 (사용자 승인)

| 항목 | 결정 |
|------|------|
| 화면 구성 | **전체화면 2-pane 모달** — 좌: 편집 필드 / 우: A4 양식 실시간 미리보기 |
| 양식 충실도 | **실제 Word 양식 완전 재현** — 미리보기 = 출력 PDF 동일. PDF 템플릿도 함께 업그레이드 |
| 3. 처리 | **text 유지** (시간/내용 2열 구조화 표는 의도적 보류 — 경위서-메뉴-설계노트 §4 준수) |
| 진입 | 인스펙터 경위서 탭(및 사고 탭 경위서) 내 **"양식으로 보기"** 버튼 |

## 4. 데이터

**새 DB 컬럼 없음.** 완전 재현에 필요한 요소가 전부 기존 필드이거나 고정 보일러플레이트:

| 양식 요소 | 출처 |
|---|---|
| 머리말(브랜드 슬로건) | 고정 상수 |
| 수신자 | `recipient_university` |
| 참조 | 고정(공란) |
| 제목 | `title` |
| 인사말 "○○대학교의 무궁한 발전을 기원합니다" | `recipient_university` 파생 |
| 사과 본문 | `apology` (null이면 기본 문구) |
| 붙임 | `title` 파생 |
| 회사명 "(주)진학어플라이 대표이사" + "전결 MM/DD" | 고정 + `draft_date` 파생 |
| 결재라인(담당자/팀장/본부장/사장) | `author_name`/`approver_name`/`director_name`/`ceo_name` |
| 시행번호 | `doc_number` |
| 주소/홈페이지/전화/전송/이메일/공개 블록 | 고정 보일러플레이트 + `author_email` |
| 경위서 본문 4섹션 | `gyeongwi`/`cause`/`handling`/`prevention` |
| 작성일자/작성자 | `draft_date`/`author_name` |
| 맺음말 사과 | 고정 상수 |

편집 가능 필드(좌측 pane): 제목 · 수신대학 · 경위 · 원인 · 처리 · 대책 · 사과 본문 — 기존 `EditForm` 필드셋과 동일.

## 5. 컴포넌트 (4 신규 + 2 수정)

### 5.1 `src/features/incident-reports/form-content.ts` (신규, pure / client-safe)
- 보일러플레이트 상수: `BRAND_HEADER`, `COMPANY_LINE`("(주)진학어플라이 대표이사"), `CONTACT_BLOCK`(주소/홈페이지/전화/전송/공개), `DEFAULT_APOLOGY`, `CLOSING`.
- `deriveFormModel(report): FormModel` — 전결일(MM/DD, `draft_date` 파생), 인사말(`recipient_university` 파생), 사과(입력 우선, 없으면 `DEFAULT_APOLOGY`), 섹션 라벨(1.경위 2.원인 3.처리 4.대책) 계산.
- **`server-only` import 금지** — HTML 미리보기(client)와 PDF 렌더러(server) 양쪽이 import.

### 5.2 `src/app/dashboard/_components/inspector/list-variants/incident-reports/FormPreview.tsx` (신규, client, 순수 표현)
- HTML/Tailwind로 A4 2장(① 공문 ② 경위서 본문) 재현. `deriveFormModel(row)` 소비.
- props만 받고 내부 상태 없음 → 라이브 갱신용. A4 비율은 고정 max-width + padding, 페이지 구분선. 색상은 디자인 토큰/Tailwind(ink/cream/washi)만 — 하드코딩 색상 금지.

### 5.3 `src/app/dashboard/_components/inspector/list-variants/incident-reports/FormModal.tsx` (신규, client, 오케스트레이션)
- 전체화면 오버레이. 좌 pane: 편집 필드(EditForm 필드셋 재사용/공유), 우 pane: `<FormPreview row={draft} />`.
- 로컬 `draft` 상태를 `row`로 시드 → onChange가 draft 갱신 → 미리보기 즉시 재렌더.
- 푸터 액션: **저장**(`updateIncidentReport` → `onChanged` 후 닫기) · **PDF**(`/api/reports/[id]/pdf` 새 탭) · **닫기**.
- 상태 가드: `status ∈ {draft, rejected}`만 좌측 편집 pane 노출; `approved`/`sent`는 미리보기 + PDF만(읽기 전용).

### 5.4 `src/lib/pdf/incident-report-pdf.tsx` (수정)
- 실제 양식의 누락 요소 추가: 인사말 라인, 회사명 + 전결, 주소/연락처 블록, 참조란.
- `form-content.ts`의 상수·`deriveFormModel` 소비(중복 제거). 3.처리는 text 유지.

### 5.5 wiring (수정)
- `incident-reports/View.tsx`(`IncidentReportView`)에 **"양식으로 보기"** 버튼 → `FormModal` 오픈.
- 사고 탭 `incidents/View.tsx`의 `ReportTab`도 동일 진입(`IncidentReportView` 경유이므로 자동 반영). 기존 인스펙터 4섹션 요약 뷰는 유지.

## 6. 데이터 흐름

```
row → (모달) draft state → deriveFormModel → FormPreview (HTML, 라이브)
                                          ↘ 저장 → updateIncidentReport → onChanged
PDF/메일 (server) → 같은 deriveFormModel → incident-report-pdf → Buffer
```

## 7. 컴포넌트 경계 (isolation)

- `form-content.ts`: 무엇=문구·파생 단일 소스. 의존=없음(pure). 내부 변경이 소비자 깨지 않음(함수 시그니처 고정).
- `FormPreview`: 무엇=양식 HTML 렌더. 의존=`form-content`. 순수 표현 → 단독 렌더 테스트 가능.
- `FormModal`: 무엇=편집↔미리보기 오케스트레이션·저장. 의존=`FormPreview`, `actions.updateIncidentReport`, PDF 라우트.
- PDF 렌더러: 무엇=서버 PDF. 의존=`form-content`. 미리보기와 콘텐츠 동기화 보장.

## 8. 테스트 (TDD: RED → GREEN → REFACTOR)

- `form-content.test.ts`: 전결일 포맷(`2026-06-02` → `06/02`), 인사말(대학명 삽입), 사과 기본값(null→`DEFAULT_APOLOGY`, 입력 시 우선).
- `FormPreview.test.tsx`: row 주입 시 대학·제목·4섹션 텍스트 렌더; 사과 null일 때 기본 문구 표시; 빈 섹션 처리.
- `FormModal.test.tsx`: 필드 편집 → 미리보기 텍스트 갱신; 저장 시 편집값으로 `updateIncidentReport` 호출; `approved` 상태일 때 편집 pane 미노출.
- `incident-report-pdf.test.ts`(기존 확장): 신규 보일러플레이트 라인(인사말/회사명/연락처) 포함 검증.

## 9. 규모 / HARD-GATE

~8 파일(신규 6: 3 컴포넌트 + 3 테스트, 수정 2 + PDF 테스트 확장). **간략 설계** 등급(6–19 파일). 영향=인스펙터/PDF 한정, DB·공개 API 무변경 → 등급 상향 불요.

## 10. 스코프 밖 (YAGNI)

- 3.처리 시간/내용 2열 구조화 표 (별도 작업 — 데이터 모델 변경 수반)
- 섹션 라벨 사용자 편집 (경위서-메뉴-설계노트 "추후")
- Word(.docx) 다운로드 (PDF로 충분 — docx는 2차)
- SharePoint 업로드 (경위서-메뉴-설계노트 2차)

## 11. 다음 단계

1. 본 스펙 사용자 검토
2. writing-plans로 구현 계획 분해(TDD)
3. 구현: form-content → FormPreview → PDF 동기화 → FormModal → wiring → 검증

---

## 개정 (2026-06-02, 사용자 승인) — 모달 → 전용 편집 워크스페이스

1차 구현(모달)이 화면이 좁아 실제 문서처럼 안 보인다는 피드백. 결정 변경:

| 항목 | 변경 |
|------|------|
| 배치 | **인스펙터 모달 폐기** → 신규 라우트 `/dashboard/incident-reports/[id]` **전용 편집 워크스페이스** (메인 = 큰 Word 뷰어 + 페이지 넘기기 / 우측 = 편집 인스펙터, 라이브 반영) |
| Word 표현 | **Word처럼 보이는 HTML 화면**(A4 면) — 실제 `.docx` 다운로드는 범위 밖 |
| 페이지 넘기기 | 공문(1) / 경위서(2) 2면을 한 면씩 표시 + ◀ prev/next ▶ |
| 진입 | `IncidentReportView` "양식으로 보기" → `router.push('/dashboard/incident-reports/${reportId}')` |
| 인사말 중복 버그 | 1차 Task 2가 `m.greeting` 별도 줄을 추가했으나 기존 `defaultApology(university)`가 인사말을 apology에 이미 내장 → **중복**. 수정: 별도 greeting 줄 제거, apology 기본값을 `defaultApology`로 통일(단일 소스). 발송 PDF 중복도 함께 해결 |
| 컴포넌트 | **제거** `FormModal.tsx`(+test). **신규** route `page.tsx` + `ReportEditorWorkspace.tsx` + `FormPage`(FormPreview 페이지 분할). **수정** form-content / FormPreview / incident-report-pdf / View |
| 재사용 | `form-content` · PDF 템플릿 · PDF 라우트 · ListRow docNumber 그대로 |
