# 인수인계 편집기 — 회의록식 흰 시트 레이아웃

작성일: 2026-07-09
대상: `/dashboard/handover/[serviceId]`

## 문제

PR #829에서 섹션마다 흰 카드(`border border-line bg-white` + `px-4 py-3`)를 씌웠다. 그 결과:

1. **박스 안의 박스** — 흰 카드 안에 테두리 있는 흰 textarea가 들어가 경계가 이중으로 그려진다.
2. **흰 카드 위 흰 입력** — 입력 필드가 배경으로 구분되지 않고 테두리에만 의존한다.
3. **카드 폭이 넓다** — `max-w-3xl`(768px)이지만 카드가 각각 떠 있어 시각적으로 산만하다.
4. **빈 공간** — `min-h-32`(128px) 탓에 `생성툴`처럼 4줄짜리 필드도 큰 빈 상자를 차지한다.

## 참고 대상 정정

요청은 "사고보고·회의록처럼"이었으나 두 화면은 서로 다르다.

| 화면 | 흰 배경의 실체 | 파일 |
|---|---|---|
| 사고보고 | `bg-paper` 토큰(`#fbf7f0`). 대시보드 콘텐츠 영역 기본값과 동일 → 참고 대상 아님 | `ReportEditorWorkspace.tsx:222` |
| 회의록 | 스코프드 CSS `.paper` — `--paper:#ffffff` 로컬 재정의, `max-width:210mm`, 그림자 | `meeting-form.css:26` |

**회의록을 따른다.** 단, 회의록의 A4 장식(격자 배경, 코너마크, `min-height:297mm`)은 가져오지 않는다. 인쇄 문서용이며, `min-height`는 내용이 짧을 때 빈 시트를 화면 두 개 분량으로 늘린다.

## 설계

### 1. 한 장의 흰 시트

섹션별 카드를 버리고 우측 본문 전체를 흰 시트 하나로 만든다. 카드 경계가 사라지므로 박스-안-박스가 해소된다.

| 항목 | 값 | 근거 |
|---|---|---|
| 시트 폭 | `max-w-[210mm]` (≈794px) | `meeting-form.css:26` |
| 시트 배경 | 흰색 | `--paper:#ffffff` |
| 시트 여백 | `px-10 pt-8 pb-14` | `.sheet { padding:34px 40px 60px }` |
| 바깥 배경 | `bg-paper` (상속, 배경 클래스 없음) | `MeetingEditorWorkspace.tsx:111` |
| 정렬 | `mx-auto` | `.paper { margin:0 auto }` |

`max-w-3xl`(768px)을 `max-w-[210mm]`로 대체한다.

### 2. 섹션은 평면으로

`CollapsibleField`를 #829 이전 형태로 되돌린다 — 카드 없이 `border-b border-line-soft` 구분선만. 접기 기능과 `defaultOpen={filled}`는 유지한다.

### 3. 입력 필드

흰 시트 위이므로 `bg-cream`으로 되돌린다. 흰 시트에 흰 입력은 테두리로만 구분되어 같은 문제가 반복된다. 읽기 전용 표시 박스·칩도 #829 이전(`bg-cream`)으로 환원한다.

### 4. 빈 공간

`min-h-32` → `min-h-[6rem]`. `field-sizing-content`가 이미 있어 긴 내용은 자동 확장된다.

### 5. 손대지 않는 것

- **상단 툴바** — 회의록 편집기(`MeetingEditorWorkspace.tsx:87~104`)와 버튼 클래스가 이미 동일하다. `복제`의 vermilion 호버도 양쪽 같다.
- **좌측 rail** — 본문이 흰 시트가 되면 `bg-washi-raised` 활성 표시가 자연히 대비를 얻는다.

## 영향 범위

7개 파일. 전부 인수인계 편집기 전용이며 다른 화면에서 import 하지 않는다.

`HandoverEditorWorkspace` / `HandoverCategoryFields` / `CollapsibleField` / `ContractChecklist` / `ContractInfoForm` / `SchoolContactPicker` / `StructuredInfoForm`

실질적으로 #829의 카드 처리를 되돌리고, 그 자리에 시트 컨테이너를 넣는 변경이다.

## 검증

- 기존 테스트 22파일 99건이 그대로 통과 (스타일 전용, 새 테스트 없음)
- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`
- Vercel 프리뷰에서 6개 카테고리(계약·작업·정산·컨텍·서류·기타) 육안 확인

## 후속 (2026-07-09, 프리뷰 확인 후)

시트를 본문에만 적용하니 rail과 시트 사이에 큰 빈 공간이 생기고, 편집기 전체 폭이 여전히 넓었다. 시트를 바깥으로 끌어올려 **rail까지 감싸는 한 장**으로 바꾼다.

- 시트 = `mx-auto flex w-full max-w-5xl border border-line bg-white shadow-offset` (rail + 본문을 함께 감쌈)
- 스크롤은 본문에만 (`overflow-y-auto`) — rail은 항상 보인다
- 본문 여백 `px-10 pt-8 pb-14` 는 시트 내부로 이동
- rail은 배경 클래스가 없어 시트의 흰색을 상속. 활성 항목 `bg-washi-raised` 가 흰 바탕에서 대비를 얻는다
- 상단 툴바도 `mx-auto w-full max-w-5xl` 로 시트와 폭을 맞춘다

폭은 `max-w-5xl`(1024px). rail 176px을 빼면 본문이 약 846px로, 회의록 `.paper`(210mm ≈ 794px)와 근접한다. `max-w-[210mm]` 를 직접 쓰면 rail 폭만큼 본문이 좁아지므로 총폭 기준으로 잡았다.
