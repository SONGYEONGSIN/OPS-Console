# 견적서 양식 재구성 설계

> 기존 견적서 문서(Phase2 SP1~4)를 **표준 4섹션 양식**으로 재구성한다. 사용자 8개 요구 + 표준 샘플(Image #12) 반영.

## 확정 결정 (2026-06-25)

- **4종 유형 모두 4섹션 구조** 적용: ①시스템(인프라·장비)이용 ②인건비(직접인건비·제경비·기술료 적산) ③외주비/비용(장비·실비·수수료) ④총비용 및 단가산출. 각 섹션 **행 추가 + 섹션 하단 문구(note)**. 최종 **산출 근거 및 주의 안내사항(guide)**.
- 공통(전 유형): 상단 "견적서" 타이틀(볼드·대) + 구분선 / 공통 헤더(Image #12 레이아웃) + 구분선.
- **생성 흐름**: 목록 "+ 새 견적서" → **유형 선택 모달**(회의록 NewMeetingButton 동형) → 견적서 생성(유형) → 상세 에디터 이동. 인스펙터 유형 셀렉트(#708)도 유지.
- **발신자 상수 확정**(Image #12): 법인명 주식회사 진학어플라이 / 대표이사 신원근 / 등록번호 101-86-62676 / 주소 서울 종로구 경희궁길 34 진학기획빌딩. (담당자·전화·이메일은 견적별 가변 = header 필드.)

## 1. 데이터 모델

**sender.ts** — 상수 채움(bizNo `101-86-62676`, address `서울 종로구 경희궁길 34 진학기획빌딩`). tel/fax/email은 회사 대표번호 미상 → 빈/생략(담당자 연락처는 header).

**QuoteHeader 확장**: 기존(recipient/quoteName/quoteNo/quoteDate/validUntil/manager) + `recipientCount`(접수인원, 선택)·`paymentTerms`(결제조건, 기본 "계약서 항목에 따름")·`managerTel`·`managerEmail`(담당자 연락처). 견적비용(견적비용 표시)은 totals.total에서 파생(VAT포함).

**QuoteSection 확장**: `note?: z.string()` 추가(섹션 하단 문구).

**QuoteDocument 확장**: `guide: z.array(z.string()).default([])`(산출 근거·주의 안내사항). 기존 `terms`는 유지(약관)하되, guide와 역할 분리(guide=안내, terms=약관). 또는 terms를 guide로 통합 — **단순화 위해 guide 하나로 통합**(약관/안내 한 영역).

**4섹션 blankDocument(type)** — 전 유형 동일 4섹션:
```
①system  : 구분·항목·수량·기간(월)·단가·금액(amount) — 수량×기간×단가
②labor   : 구분·직무/등급·인원·노임단가(일)·투입기간(일)·참여율·직접인건비(amount, kind:labor) — 적산
③outsource: 구분·항목·수량/건수·단가·금액(amount) — 수량×단가
④summary : 구분·내역·금액(amount) — 원가단가/제안단가/3년계약 등(직접입력+일부 파생)
```
각 섹션 `note: ""`, document `guide: []`.

## 2. 계산 (calc 확장)

- ①system·③outsource: simple(amount 합) — 단, 행금액=수량×기간×단가(system)/수량×단가(outsource) 자동? → 행 금액 컬럼을 자동계산하려면 row 다컬럼 곱. SP3 laborRowDirect 패턴 확장: `rowComputed(section, row)` 유형별. **1차: amount 직접입력 허용 + (옵션) 자동계산**. 정확성 위해 system=qty×months×unit, outsource=qty×unit 자동, amount 읽기전용.
- ②labor: 기존 laborRollup 적산(kind:labor) 재사용.
- ④summary: 총비용 = ①+②+③ 소계 합(자동 표시) + 단가산출 행(직접입력). 또는 summary는 표시 위주.
- quoteTotals: 공급가=①+②+③(+④ 입력분) 소계 합, VAT, 합계. recomputeDocument가 행 자동계산 + 소계 + totals.

## 3. 생성 모달

`NewQuoteButton.tsx`(meetings `NewMeetingButton` 동형): 목록 헤더 "+ 새 견적서" → ModalShell "견적서 유형 선택" → QUOTE_TYPE_LABELS 4버튼 → 선택 시 `createQuoteWithType(type)` server action(빈 quote 생성, quote_type 세팅) → `/dashboard/quotes/[새 id]` 이동. 회의록 모달 마크업·토큰 재사용.

## 4. 에디터 레이아웃 (QuoteDocumentEditor 재구성)

- 최상단 **"견적서"** 타이틀(text-2xl font-bold text-ink, 가운데) + `border-b` 구분선.
- **공통 헤더**(Image #12 2열 grid): 좌(수신·견적명·접수인원·견적비용[파생,볼드]·견적일자·유효기간·결제조건) / 우(법인명·대표이사·등록번호·주소 = 상수 / 담당자·전화·이메일 = 입력). `border-b` 구분선.
- **4섹션** 각: 섹션 제목 + 표(columns 헤더 + rows 인라인 편집 + 행 추가/삭제 버튼) + **섹션 문구(note) textarea**. labor 섹션은 등급 드롭다운+적산 블록(SP3). 각 섹션 `border-b` 또는 간격 구분.
- 최하단 **안내사항(guide)**: 라인 추가/삭제 텍스트(산출 근거 및 주의).
- 합계(공급가·부가세·합계+한글금액)는 ④summary 또는 헤더 견적비용에 반영.
- 기존 유형 선택기(SP2)·저장·PDF 버튼 유지.

## 5. PDF 업데이트 (quote-pdf)

새 레이아웃 반영: 타이틀+구분선, 2열 헤더, 4섹션(note 포함), 안내사항(guide). 발신자 상수 채움값.

## 6. 구현 분해 (SDD)

- **T1**: sender 상수 채움 + 데이터 모델(header 확장·section note·document guide·4섹션 blankDocument) + calc(행 자동계산·summary) — TDD.
- **T2**: 생성 모달(NewQuoteButton + createQuoteWithType) + 목록 배선.
- **T3**: 에디터 레이아웃 재구성(타이틀·헤더 2열·4섹션 행추가/문구·안내사항).
- **T4**: PDF 새 레이아웃 반영.

## 7. 위험
- 4섹션 전환으로 기존 dev/fee/platform 단순 문서와 모델 변경 — 기존 저장 문서(SP1~4) 호환: document 구조 변경 시 마이그 불필요(jsonb), 단 기존 문서는 옛 섹션 구조 → 에디터가 누락 섹션 폴백 또는 blankDocument 재생성 안내. 1차는 신규 문서 기준, 기존 문서는 열 때 4섹션으로 정규화(빈 섹션 채움).
- 행 자동계산 정확성 → calc TDD.
