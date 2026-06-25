# 견적서 문서 양식 (Phase 2) 설계

> Phase 1(목록·CRUD, 머지 완료)에 이어 견적서 **문서 양식**(상세 페이지 에디터 + 자동계산 + PDF)을 구현한다.
> 표준 샘플 5종(`design-ref/quotes/`, gitignore 로컬) 분석 기반. 회의록(meetings) HTML 양식 + list-variants registry 패턴 재사용.

## 0. 확정 결정 (2026-06-25 brainstorm)

- 저장: 기존 `quotes` 행에 `quote_type`(유형) + `document`(jsonb) 컬럼 추가. 유형별 가변 구조를 jsonb로 수용.
- 유형(variant) 4종: `dev`(시스템개발비) · `fee`(시스템수수료) · `platform`(플랫폼 기능나열) · `labor`(노임단가 적산).
- 노임단가형도 동일 견적서 흐름(variant 하나). 적산 결과를 고객제출가로 이어쓰기 용이.
- 상세 페이지 `/dashboard/quotes/[id]` = 문서 에디터. Phase 1 목록 인스펙터(요약: 고객·일자·금액·상태)는 유지, **금액(amount)은 문서 총계에서 자동 동기화**.

## 1. 아키텍처 — 하이브리드 셸 + 유형별 섹션 variant

```
견적서 문서(QuoteDocument)
├─ header   : 수신·견적명·견적번호·견적일·유효기간·담당자 (가변) + 발신자(상수)
├─ type     : dev | fee | platform | labor
├─ sections : QuoteSection[]   ← 유형별 항목 표(variant가 렌더·계산)
├─ totals   : 공급가·부가세·합계 (자동계산, 읽기전용 파생)
└─ terms    : 가나다 약관 자유 텍스트 라인[]
```

- **공통 셸**(머리말·발신자·약관·총계/VAT): 단일 컴포넌트. 회의록 마스트헤드(라벨·값 그리드)·약관(안건 추가/삭제) UI 재사용.
- **유형별 섹션**: `quote-variants/{dev,fee,platform,labor}/` registry. 각 폴더 = 섹션 스키마 + 렌더·편집 컴포넌트 + 계산 함수. 신규 유형 = 폴더 1 + registry 1줄(list-variants 패턴 동형).
- **계산 엔진**: 순수 함수(`features/quotes/calc/`). 변경 시 cascade 재계산.

## 2. 데이터 모델

**마이그 `quotes` 확장**:
```sql
alter table public.quotes
  add column if not exists quote_type text not null default 'dev',  -- dev|fee|platform|labor
  add column if not exists document jsonb;                           -- QuoteDocument
```
- `amount`(Phase 1)은 유지 — 문서 저장 시 `totals.total`(VAT포함)로 자동 갱신.
- `customer`/`quote_date`는 header에서도 보유하나, 목록 표시는 기존 컬럼 사용(저장 시 동기화).

**QuoteDocument (zod, `features/quotes/document-schema.ts`)**:
```
QuoteHeader = { recipient, quoteName, quoteNo, quoteDate, validUntil, manager }
QuoteSender = 상수 (회사명/대표이사/등록번호/주소/전화/팩스/이메일) — features/quotes/sender.ts
QuoteRow    = Record<string, string|number|null>  (variant 컬럼셋에 따라)
QuoteSection= { id, title, columns: ColumnDef[], rows: QuoteRow[], subtotal: number }
QuoteTotals = { supply: number, vat: number, total: number, vatIncluded: boolean }
QuoteDocument = { type, header, sections, totals, terms: string[], extraNotes?: string[] }
```
유형별 섹션 컬럼셋·계산식은 variant가 정의(아래 §4).

## 3. 계산 엔진 (`features/quotes/calc/`, 순수·TDD)

- `rowAmount(section, row)`: 유형별 행 금액 — `수량×단가`, `수량×기간×단가`, `인원×노임단가×투입일×참여율`, `ROUND(건당×요율)×건수`.
- `sectionSubtotal(section)`: `SUM(rowAmount)`.
- `laborRollup({직접인건비, 제경비율, 기술료율})`: 제경비=직접×율 → 기술료=(직접+제경비)×율 → 합계. (노임단가형)
- `quoteTotals(document)`: 공급가=Σ소계, 부가세=공급가×0.1(또는 vatIncluded 분리), 합계.
- `koreanAmount(n)`: 숫자→한글금액(`일금 …정`). 플랫폼형 머리말용.
- KOSA 노임단가표: `features/quotes/kosa-2026.ts` — 17등급 일평균임금 상수 + `kosaDaily(grade)` lookup. (출처·연도 주석)

## 4. 유형별 섹션 variant (`quote-variants/`)

| variant | 섹션 | 컬럼 | 계산 |
|---|---|---|---|
| `dev` | 단일 | 구분·상세내역·비고·비용 | 비용 직접입력, 소계=Σ비용 |
| `fee` | 단일 | 구분·상세내역·비고·비용 (dev와 동일 컬럼이나 별 유형 유지) | 동일 |
| `platform` | 단일 | 구분·세부서비스·기능명세·기간·수량·금액(1식) | 금액 직접/1식, 별도청구 라인 |
| `labor` | 다중(인프라·인건비·외주·집계·수수료) | 각 표별 상이(§분석) | 행계산 + laborRollup 적산 |

registry: `quote-variants/registry.ts`(유형→{Sections, calc, blankDocument}), `types.ts` QuoteType union. dispatcher 무변경.

## 5. 상세 페이지 `/dashboard/quotes/[id]`

- 목록에서 행 클릭/“문서 작성” → 상세 진입. 신규 견적서는 유형 선택(dev/fee/platform/labor) 후 빈 문서.
- 레이아웃: 회의록 양식과 동형 — 상단 마스트헤드(머리말: 수신·견적명·번호·일자·유효기간·담당 + 발신자 상수), 본문 섹션 표(유형 variant, 행 추가/삭제·인라인 편집), 하단 합계(자동)·약관.
- 저장: `saveQuoteDocument(id, document)` server action → `quotes.document` jsonb + `amount=totals.total` + `quote_type` 갱신. revalidate.
- 자동계산: 클라이언트에서 입력 변경 시 calc 순수함수로 즉시 재계산(소계·적산·합계·한글금액). 저장 시 서버에서도 재계산해 신뢰값 적재(클라이언트 값 불신).

## 6. PDF (`lib/pdf/quote-pdf.tsx`)

- handover-pdf 패턴: Pretendard Regular+Bold, 고정 header(브랜드 `[운영부 상황실]` 또는 진학어플라이 발신자)·footer(자동발송·페이지). 다중 섹션 표 `minPresenceAhead`로 헤더 외로움 방지.
- 노임단가 참조표(KOSA)는 별지 부록(2페이지).
- 다운로드 라우트 또는 상세 페이지 “PDF” 버튼.

## 7. 구현 분해 (foundation-first, SDD 서브프로젝트)

전체를 한 PR로 하기엔 큼 → 순차 서브프로젝트(각자 동작하는 증분):

- **SP1 — 기반**: 마이그(quote_type+document) + document-schema + calc 엔진 core(rowAmount/subtotal/totals/koreanAmount) + sender 상수 + 상세페이지 셸(머리말·약관·합계) + **dev/fee variant** + amount 동기화. → dev/fee 견적서 작성·저장 가능.
- **SP2 — platform**: platform variant(기능나열·1식·별도청구) + 한글금액 머리말.
- **SP3 — labor**: labor 다중표 + laborRollup 적산 + KOSA 2026 상수·lookup.
- **SP4 — PDF**: quote-pdf 4유형 렌더 + 다운로드.

각 SP는 별도 plan + SDD. SP1부터 착수.

## 8. 영향 / 위험

- jsonb 가변 구조 → zod 스키마로 경계 검증. 서버 재계산으로 클라이언트 조작 방지.
- 적산·KOSA 계산은 정확성 핵심 → calc 순수함수 TDD 집중(샘플 수식 대조).
- Phase 1 목록과 amount 동기화 정합(저장 단일 경로).

## 9. 운영 선행

- 마이그(quote_type/document) 프로덕션 적용(컨트롤러). KOSA 단가표 연도 갱신은 상수 수정.
