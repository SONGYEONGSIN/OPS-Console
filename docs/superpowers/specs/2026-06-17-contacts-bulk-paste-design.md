# 대학연락처 붙여넣기 일괄 등록 — 설계

## 목적

운영자가 보유한 학교 담당자 연락처(엑셀/스프레드시트)를 **클립보드 복사 → 붙여넣기(TSV)** 로 다건 일괄 등록한다. 엑셀 파일 업로드가 아니라 텍스트 붙여넣기 방식.

## 결정 사항 (브레인스토밍)

1. **열 매핑**: 헤더 행 기반 유연 매핑 — 첫 행의 한글/영문 헤더를 필드로 매핑(열 순서 무관, 모르는 열 무시)
2. **중복 처리**: 기존 DB와 (대학명+고객명) 일치 행은 제외하고, 무엇이 중복인지 결과에 표시
3. **오류 행**: 필수값(대학명·고객명) 누락 행은 제외 + 보고. 유효 행만 등록
4. **진입 UX**: 연락처 리스트의 "+ 신규 연락처" **왼쪽**에 "연락처 일괄등록" 버튼 → 모달

## 접근법

- **A (채택)**: 클라이언트 순수 파서로 실시간 미리보기 + 서버 일괄 액션이 중복판정·insert. 즉시 미리보기 + 파서 단위테스트 용이, DB 접근(중복판정)만 서버.
- B(기각): 서버 파싱 — 붙여넣기→제출→서버 파싱. 라운드트립↑, 미리보기 UX 저하.
- C(기각): 인스펙터 슬라이드 재사용 — 단건 편집 인스펙터와 공간 경합.

## 컴포넌트 / 단위

### 1) 파서 — `src/features/contacts/paste-parse.ts` (순수 함수)

```ts
export type ParsedContactRow = {
  rowIndex: number;                 // 데이터 행 번호(헤더 제외, 1-based)
  values: Partial<ContactCreate>;   // 매핑된 필드 값
  errors: string[];                 // 행 검증 오류(필수 누락 등)
};
export type ParseResult = {
  rows: ParsedContactRow[];
  unmappedHeaders: string[];        // 매핑 안 된 헤더(참고용, 무시)
  headerError?: string;             // 필수 헤더(대학명/고객명) 누락 시
};
export function parsePastedContacts(text: string): ParseResult;
```

- 줄바꿈으로 행 분리(빈 줄 무시), 탭으로 셀 분리. 첫 비어있지 않은 행 = 헤더.
- 헤더 별칭(trim + 소문자 비교):
  - `university_name`: 대학명/학교명/대학/학교/university
  - `customer_name`: 고객명/담당자명/담당자/이름/성명/name
  - `contact_email`: 이메일/메일/email/e-mail
  - `contact_phone`: 전화/전화번호/연락처/휴대폰/핸드폰/phone/tel
  - `contact_ext`: 내선/내선번호/ext
  - `job_title`: 직위/직급/title
  - `department_name`: 부서/부서명/department/dept
  - `job_role`: 직무/역할/role
  - `management_grade`: 관리등급
  - `relationship_grade`: 관계등급
  - `customer_active`: 재직/재직여부/상태/active
- 필수 헤더(university_name, customer_name) 둘 다 없으면 `headerError` 설정 + `rows` 빈 배열.
- 각 데이터 행: 셀 trim, 빈 문자열은 미설정. customer_active 미입력 시 "재직". 대학명/고객명 빈 값이면 `errors`.

### 2) 일괄 액션 — `src/features/contacts/actions.ts: createContactsBulk`

```ts
export async function createContactsBulk(rows: ContactCreate[]): Promise<{
  ok: boolean;
  inserted: number;
  duplicates: { university_name: string; customer_name: string }[];
  error?: string;
}>;
```

- 권한: 기존 `createContact`과 동일(admin/member 아니면 ok:false).
- 각 row `contactCreateSchema.safeParse` 재검증(실패 제외 — 클라 검증의 서버측 방어).
- 중복판정: 기존 contacts의 (university_name, customer_name) 페어 조회 → Set → 일치 행 제외(duplicates에 기록). 배치 내 자체 중복도 1건만.
- 신규 행만 `.from("contacts").insert(newRows)`. `revalidatePath("/dashboard/contacts")`.

### 3) UI — `src/app/dashboard/contacts/BulkPasteContacts.tsx` ("use client")

- "연락처 일괄등록" 버튼 + 모달. 모달: textarea(붙여넣기) + 실시간 미리보기 + 등록 + 결과.
- textarea onChange → `parsePastedContacts` 실시간 파싱. 미리보기: 매핑 결과(매핑 필드 / unmappedHeaders 안내), 유효 행 수, 오류 행(rowIndex+errors), headerError 안내.
- "N건 등록" → 유효 행(errors 없는)만 ContactCreate로 `createContactsBulk` 호출. 결과: 등록 N / 중복 제외 M(대학명·고객명 목록) / 오류 K.
- 디자인 토큰 사용(bg-cream/bg-paper, border-line, focus:bg-white 등). viewer는 버튼 미노출/비활성(서버 액션이 최종 차단).

### 4) 진입 슬롯 — `ListPattern`

- `ListPattern`에 `extraActionsLeft?: React.ReactNode` prop 추가 → 생성 버튼 **왼쪽**에 렌더(기존 `extraActions`는 오른쪽 유지, 다른 페이지 영향 없음).
- `contacts/page.tsx`: `extraActionsLeft={<BulkPasteContacts />}`.

## 데이터 흐름

붙여넣기 → (클라) `parsePastedContacts` → 미리보기 → "등록" → (서버) `createContactsBulk`(중복판정·insert) → 결과 표시 → revalidate로 리스트 갱신.

## 오류 처리

- `headerError`(필수 헤더 없음) → 안내 + 등록 비활성.
- 오류 행(필수 누락) 제외 + 미리보기에 표시.
- 중복 행 제외 + 결과에 (대학명·고객명) 목록 표시.
- 액션 실패 시 에러 메시지.

## 테스트

- `paste-parse.test.ts`: 헤더 유연 매핑(열 순서 무관·별칭), 필수 누락 errors, unmappedHeaders, headerError, customer_active 기본값, 빈 줄 무시.
- `actions` (createContactsBulk): 중복 제외 + inserted/duplicates 반환(Supabase mock).
- `BulkPasteContacts`: 붙여넣기 미리보기/오류 표시, 등록 버튼이 액션 호출(액션 mock).
- `ListPattern`: `extraActionsLeft` 렌더 확인.

## 범위 밖 (YAGNI)

- 엑셀 파일(.xlsx) 업로드 / 컬럼 수동 매핑 UI / 기존 연락처 일괄 수정(merge) — 이번 범위 아님.
