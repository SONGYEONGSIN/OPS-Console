---
plan_id: 20260515-121140-university-contacts-domain
status: completed
created: 2026-05-15T03:11:40Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260515-120417-university-contacts-domain.md
---

# Plan: 대학 연락처 도메인 (slug `contacts`) — PR-1

## Goal

Folio `contacts` 도메인 신설 — DB 테이블 + RLS + list-variants slot + `/dashboard/contacts` 페이지. mockup 11 컬럼(활성화/고객명/직함/대학명/소속부서/직책/관리등급/관계등급/휴대폰/내선/이메일). admin/member 등록·수정·삭제, viewer read-only. backup EditForm 검색 source는 별도 PR-2.

## Approach

services 패턴 1:1 모방 (brainstorm 추천). schemas/queries/actions + 마이그레이션 2 + list-variants/contacts slot + page + Controls. 4 common UI 표준(ListSearch/ListSelect/ScopeChips/ListPagination) 적용. universityKey 자동 부여 같은 services 도메인 특수 로직은 *제외*.

## Out of Scope

- enum check 도입 — 1차 PR은 text 자유 입력 (services PR-1.5 패턴, 실 데이터 분포 후 follow-up)
- backup EditForm 검색 연결 — 별도 PR-2
- 대학명 datalist 자동완성 (services.universityName distinct) — follow-up
- 백업자 서비스별 분리 — 별도 epic
- 한국법 개인정보처리방침 갱신 — 별도 작업 (연락처 수집 컬럼 추가 시 검토 가치)
- **ScopeChips 미주입** — "내 연락처" 의미 불명 (담당자 컬럼 없음). 검색 + 4 셀렉트만

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260523_contacts_table.sql` | 신규 | 11 컬럼 (전부 text 자유 입력) + 인덱스 + trigger |
| `supabase/migrations/20260523b_contacts_rls.sql` | 신규 | services RLS 1:1 복제 |
| `src/features/contacts/schemas.ts` | 신규 | Row/Create/Update zod |
| `src/features/contacts/queries.ts` | 신규 | `listContacts` (search + 4 filter + pagination) |
| `src/features/contacts/actions.ts` | 신규 | create/update/delete + isOperator 가드 |
| `src/features/contacts/__tests__/schemas.test.ts` | 신규 | zod 분기 |
| `src/features/contacts/__tests__/queries.test.ts` | 신규 | filter 조합 (mock supabase) |
| `src/app/dashboard/_components/inspector/list-variants/contacts/View.tsx` | 신규 | 11 필드 표시 |
| `.../contacts/EditForm.tsx` | 신규 | 11 필드 입력 |
| `.../contacts/Table.tsx` | 신규 | 8 컬럼 (활성/고객명/직함/대학명/소속부서/직책/관리등급/관계등급) |
| `.../contacts/filters.ts` | 신규 | `CONTACTS_FILTERS = []` + `blankContactRow` factory |
| `.../contacts/__tests__/{View,EditForm,Table}.test.tsx` | 신규 | render 검증 |
| `src/app/dashboard/_components/inspector/list-variants/registry.ts` | 수정 | contacts entry 1 |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | 수정 | Variant union에 `"contacts"` 추가 |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 | ListRow에 contacts dim 추가 |
| `src/app/dashboard/contacts/page.tsx` | 신규 | requireMenu + listContacts + ListPattern dispatch + ListPagination |
| `src/app/dashboard/contacts/ContactsControls.tsx` | 신규 | ListSearch + 4 ListSelect (직책/관리등급/관계등급/대학명) |
| `src/app/dashboard/contacts/__tests__/ContactsControls.test.tsx` | 신규 | URL state |
| `e2e/contacts.spec.ts` | 신규 | smoke (등록·검색·삭제) |

총 ~18~19 파일. **HARD-GATE 간략 설계** (6~19 범위, DB schema + 공개 타입 확장으로 상한 근처).

## 단계

### T1: contacts 테이블 마이그레이션
- **상태**: pending
- **파일**: `supabase/migrations/20260523_contacts_table.sql`
- **변경**: 11 컬럼 + indexes + trigger (set_updated_at 재사용). 컬럼 명세:
  ```
  id uuid pk, customer_active text not null default '재직',
  customer_name text not null, job_title text,
  university_name text not null, department_name text,
  job_role text, management_grade text, relationship_grade text,
  contact_phone text, contact_ext text, contact_email text,
  created_at / updated_at timestamptz
  ```
- **DoD**: SQL Editor 적용 → `select count(*) from contacts` 0건 + `notify pgrst, 'reload schema'`
- **의존**: 없음

### T2: contacts RLS
- **상태**: pending
- **파일**: `supabase/migrations/20260523b_contacts_rls.sql`
- **변경**: services RLS 4 정책 + GRANT 1:1 복제 (table 이름만 contacts)
- **DoD**: SQL Editor 적용 + `select` 정책 4건 확인
- **의존**: T1

### T3: schemas.ts + test
- **상태**: pending
- **파일**: `src/features/contacts/schemas.ts`, `__tests__/schemas.test.ts`
- **변경**: contactRowSchema (11 필드 + id + timestamps), contactCreateSchema (Row 빼고 timestamps), contactUpdateSchema (모두 optional). text 자유 입력 (`z.string().min(1)` 필수 필드: customer_name / university_name / customer_active)
- **DoD**: vitest run — 3 schemas 분기 PASS
- **의존**: T1

### T4: queries.ts + test
- **상태**: pending
- **파일**: `src/features/contacts/queries.ts`, `__tests__/queries.test.ts`
- **변경**: `listContacts` — search(customer_name + university_name ilike OR) + filter(jobRole/managementGrade/relationshipGrade/universityName) + page/pageSize + sort
- **DoD**: vitest mock supabase — 검색·필터 조합 3 케이스 PASS
- **의존**: T3

### T5: actions.ts
- **상태**: pending
- **파일**: `src/features/contacts/actions.ts`
- **변경**: services actions 1:1 복제 (isOperator 가드 + zod parse + revalidatePath). create/update/delete
- **DoD**: typecheck + lint pass. 단위 테스트는 services 패턴 따라 별도
- **의존**: T3

### T6: ListRow contacts dim + Variant 확장
- **상태**: pending
- **파일**: `src/app/dashboard/_components/patterns/ListPattern.tsx`, `list-variants/types.ts`
- **변경**: ListRow에 contacts dim 추가 (`customerActive` / `customerName` 또는 name 재사용 / `jobTitle` / `departmentName` / `jobRole` / `managementGrade` / `relationshipGrade` / `contactPhone` / `contactExt` / `contactEmail`). Variant union에 `"contacts"` 추가
- **DoD**: typecheck pass
- **의존**: 없음 (T7-T10 차단 해제용 선행)

### T7: filters.ts
- **상태**: pending
- **파일**: `.../contacts/filters.ts`
- **변경**: `CONTACTS_FILTERS = []` + `blankContactRow()` factory (status="active", customerActive="재직" default)
- **DoD**: import 성공
- **의존**: T6

### T8: Table.tsx + test
- **상태**: pending
- **파일**: `.../contacts/Table.tsx`, `__tests__/Table.test.tsx`
- **변경**: 8 컬럼 헤더 + 활성화 뱃지 + 관리등급 chip(A~D) + 관계등급 chip + 빈 rows 안내
- **DoD**: vitest render — 빈 rows / 2 rows 케이스 PASS
- **의존**: T6, T7

### T9: View.tsx + EditForm.tsx + tests
- **상태**: pending
- **파일**: `.../contacts/View.tsx`, `EditForm.tsx`, 각 `__tests__`
- **변경**: View 11 필드 read-only. EditForm 11 필드 setRow spread 패턴. 활성화는 select(재직/타부서이동) 또는 toggle. 직책/관리등급/관계등급은 select. 나머지는 text input
- **DoD**: vitest render + setRow mock 호출 3+ 케이스 PASS
- **의존**: T6, T7

### T10: registry.ts entry
- **상태**: pending
- **파일**: `.../registry.ts`
- **변경**: contacts import + `contacts: { View, EditForm, Table, Filters, blank }` 1 entry
- **DoD**: typecheck (registry satisfies Record<Variant, ...> 강제)
- **의존**: T7, T8, T9

### T11: ContactsControls.tsx + test
- **상태**: pending
- **파일**: `src/app/dashboard/contacts/ContactsControls.tsx`, `__tests__/ContactsControls.test.tsx`
- **변경**: ListSearch(?q customer_name·university_name) + 4 ListSelect (직책/관리등급/관계등급/대학명). 옵션은 하드코딩 enum (1차)
- **DoD**: vitest — URL searchParams 갱신 3 케이스 PASS
- **의존**: 없음

### T12: page.tsx
- **상태**: pending
- **파일**: `src/app/dashboard/contacts/page.tsx`
- **변경**: services/page.tsx 모방 — requireMenu + listContacts(filter) + rowToListRow mapper + ListPattern variant="contacts" + ContactsControls + ListPagination. onPersist server action (create/update/delete). **ScopeChips 미주입**
- **DoD**: 로컬 `/dashboard/contacts` 200 OK + 빈 목록 노출 (DB 비어있을 때) + 등록 가능
- **의존**: T2, T4, T5, T10, T11

### T13: E2E smoke
- **상태**: pending
- **파일**: `e2e/contacts.spec.ts`
- **변경**: 로그인 → `/dashboard/contacts` 진입 → 신규 등록 → 검색 1건 → 인스펙터 View → 삭제
- **DoD**: `npm run test:e2e -- contacts` PASS
- **의존**: T12

### T14: /verify + PR
- **상태**: pending
- **변경**: `npm run lint && typecheck && test && build` 통과 → PR 생성 (제목 `feat: contacts 도메인 — 대학 연락처 카탈로그 (PR-1)`)
- **DoD**: PR URL 노출 + CI green
- **의존**: 전체

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| ListRow에 dim 10개+ 추가로 타입 부담 | 각 dim에 JSDoc `/** contacts 도메인 — ... */` 명시 (services/backup 패턴) |
| viewer mutation 시도 server error | services PERMISSION_ERROR 패턴 그대로. UI는 `readOnly={!isOperator}` 버튼 hide |
| 대학명 free text 일관성 (오타) | follow-up: services.universityName distinct datalist 자동완성 |
| 마이그레이션 prod 적용 누락 → 500 | T1·T2 SQL 적용 후 SQL Editor에서 `select count(*) from contacts` 검증 + PR 본문 Test plan 명시 |
| customer_active text(`재직`/`타부서이동`) — 일관성 | 1차 text 자유 입력. follow-up enum check 도입 |
| 한국법 개인정보처리방침 (연락처 수집) | 별도 작업 — privacy policy 갱신 가치 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-15T03:11:40Z | — | plan 생성 | brainstorm 20260515-120417 입력 |
