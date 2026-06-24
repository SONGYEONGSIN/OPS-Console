# 견적서 목록 (자료 보관 > 견적서) — Phase 1 설계

> 사이드바 '자료 보관' 그룹에 **견적서**(slug `quotes`) 추가. 표준 list+인스펙터 도메인.
> Phase 2(견적서 문서 양식 + PDF)는 사용자가 표준 견적서 샘플을 제공한 뒤 별도 진행.

## 1. 목표 / 범위

운영부가 견적서를 **목록으로 관리**(고객·견적일·금액·담당·상태·유효기간·비고)하고, 인스펙터에서 **생성·편집·삭제**한다. `incidents`/`contacts`와 동형의 표준 list 도메인.

**Phase 1 범위**: 메뉴 + 목록 + 인스펙터 CRUD + 상태 필터 + 사이드바 카운트.
**비범위(Phase 2)**: 견적서 문서 양식(항목 표·단가·수량 라인아이템), 금액 자동합계, PDF 출력. Phase 1의 `amount`는 수동 입력(합계 단일값), Phase 2에서 양식 합계로 자동 채움.

확정 결정(2026-06-24 brainstorm):
- 성격 = 목록 관리 + (Phase 2)문서 편집. Phase 1은 목록·CRUD까지.
- 필드 = 고객/거래처명 · 견적일자 · 금액(합계) · 담당자 · 상태 · 유효기간 · 비고.
- 상태 = 작성중(draft) · 발송(sent) · 수주(won) · 실주(lost).

## 2. 데이터 — `quotes` 테이블

```sql
create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  customer    text not null,                 -- 고객/거래처명
  quote_date  date not null,                 -- 견적일자
  valid_until date,                           -- 유효기간(선택)
  amount      bigint,                         -- 금액 합계(KRW, 선택 — Phase 2 양식서 자동계산)
  owner_email text,                           -- 담당자(operators.email)
  status      text not null default 'draft',  -- draft|sent|won|lost
  note        text,                           -- 비고
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index quotes_quote_date_idx on public.quotes (quote_date desc);
```

RLS (incidents 패턴 동일):
- read: authenticated 전원 `using(true)`
- insert·update: admin·member (viewer 차단) — incidents `write_admin_member`/`update_admin_member` 복제
- delete: admin only
- GRANT select/insert/update/delete 적절히(42501 회피). 마이그 `2026XXXX_quotes.sql` + `_rls.sql`, 컨트롤러 적용.

## 3. features/quotes/

- `schemas.ts`: `quoteStatusSchema = z.enum(["draft","sent","won","lost"])`, `quoteRowSchema`(전 컬럼), `type QuoteRow`. create/update 입력 스키마.
- `queries.ts`: `listQuotes({page, pageSize, status?, search?}) → {rows: QuoteRow[], total}` — `quote_date desc` 정렬, status eq 필터, customer ilike 검색, range 페이지네이션. (news `listNews` 패턴)
- `actions.ts`(`"use server"`): `createQuote`/`updateQuote`/`deleteQuote` — `createClient`(RLS) + zod + `revalidatePath("/dashboard/quotes")`. (incidents `actions.ts` 패턴)

## 4. list-variant `quotes/`

`src/app/dashboard/_components/inspector/list-variants/quotes/`:
- `View.tsx`: Section "견적 정보" DefList(고객·견적일·금액(콤마)·담당(operatorNameByEmail)·상태·유효기간·비고).
- `EditForm.tsx`: 입력 필드(고객 text, 견적일 date, 금액 number, 담당 operator select 또는 본인 default, 상태 select, 유효기간 date, 비고 textarea) + `onSave(row)`/`onCancel`. (incidents EditForm 구조)
- `Table.tsx`: 목록 행 — 고객 · 견적일 · 금액(콤마) · 담당 · 상태 뱃지.
- `filters.ts`: `QUOTE_FILTERS`(상태 칩: 작성중/발송/수주/실주) + `blankQuoteRow()` factory(신규 행).
- `registry.ts`에 import + 매핑 1줄, `types.ts` Variant union에 `| "quotes"` 1줄. dispatcher 무변경.

## 5. 상태 라벨/색상

`status.ts`(공통) 또는 variant 로컬 override:
- draft → "작성중", sent → "발송", won → "수주", lost → "실주". 색상은 기존 STATUS_COLOR 팔레트 재사용(예: draft 회색 / sent 파랑 / won 초록 / lost 적색 계열 토큰).

## 6. 페이지 `/dashboard/quotes/page.tsx`

- `requireMenu("quotes")`. `listQuotes({page, status, search})`.
- `ListPattern` variant="quotes" + `controlsRow`(ScopeChips 상태 필터 + ListSearch 고객검색) + `footer`(ListPagination) — news/contracts 페이지 패턴.
- `_row-mapper.ts`: QuoteRow → ListRow (`quote*` 옵셔널 필드). ListRow에 `quoteCustomer/quoteDate/quoteAmount/quoteOwner/quoteStatus/quoteValidUntil/quoteNote` 등 추가.
- 금액 KRW 천단위 콤마 포맷 유틸.
- 신규 작성: EditForm blank row → createQuote.

## 7. 메뉴 / 카운트

- `_data.ts` '자료 보관' 그룹 items에 `{ ico:"·", label:"견적서", slug:"quotes", pattern:"list" }` 추가(회의록 다음).
- `getMenuCounts`에 `countOf("quotes", supabase.from("quotes").select("*", head))` 추가.

## 8. 테스트

- `listQuotes`(status/search/페이지네이션) 또는 순수 변환은 단위 테스트. actions create/update zod 검증 테스트(incidents 테스트 패턴).
- `blankQuoteRow`/금액 포맷 순수 함수 테스트.
- EditForm/Table thin UI는 기존 list-variant 관례(테스트 있으면 따르고, 없으면 면제 — contacts/incidents variant 테스트 유무 확인 후 정합).

## 9. 영향 범위 / 변경 등급

신규: 마이그 2 + `features/quotes/`(schemas/queries/actions+test) + `list-variants/quotes/`(4파일) + `dashboard/quotes/`(page + _row-mapper). 수정: `_data.ts`(메뉴 1), `menu-counts/queries.ts`(1), `list-variants/registry.ts`(1), `types.ts`(Variant union 1 + ListRow quote* 필드).
→ ~12 파일, **간략 설계** 등급. 기존 표준 패턴 답습이라 위험 낮음.

## 10. 운영 선행

- 마이그(`quotes` + RLS) 프로덕션 적용(컨트롤러). 메뉴 권한(`allowed_menus`/role)에 `quotes` 노출 필요 시 설정.
