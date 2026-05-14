---
plan_id: 20260514-133437-backup-services-fk
status: in_progress
created: 2026-05-14T04:34:38Z
hard_gate: brief
source: .claude/memory/brainstorms/20260514-132106-backup-services-fk.md
---

# Plan: backup_requests.services chips → services FK N:M (PR-2)

## Goal

`backup_requests.services text[]` 자유 텍스트 chips를 `services` 테이블의 `id (uuid)` PK를 참조하는 N:M join table(`backup_request_services`)로 전환한다. EditForm은 PR-1.6의 ServicesControls 검색 패턴을 재사용한 multi-select, View는 chip 클릭 → `/dashboard/services?q=...` deep-link, 메일·PDF 본문은 "대학명 — 서비스명" 정규화 표기.

## Approach

대안 A — 별도 join table (brainstorm 확정). `services.id` uuid 내부 PK 참조 (외부 PIMS bigint `service_id` 자연키 대신 — 외부 시스템 변동 격리). ON DELETE CASCADE로 services row 삭제 시 join row 자동 정리. RLS는 backup_requests 부모 정책 mirror (admin OR requester_email mutation, authenticated read all).

prod backup_requests 0행 윈도우 활용 — `services text[]` 컬럼은 본 PR에서 즉시 drop (fallback shim 금지 / donts.md).

## Out of Scope

- `contacts text[]` 처리 — 별도 PR-3 (대학 마스터 도메인 epic)
- 삭제된 service 참조 UI 표시 (소프트 인디케이션 등) — 별도
- 백업 영향 분석 대시보드 — 데이터 적재 후 별도 epic
- to_tsvector/gin 검색 정확도 개선 — ilike 유지 (PR-1 정책 일관)
- `services.service_id` bigint를 FK로 쓰는 대안 — uuid 채택 확정

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260521_backup_request_services_table.sql` | 신규 | join table (uuid FK 양쪽 ON DELETE CASCADE) + service_id 인덱스 |
| `supabase/migrations/20260521b_backup_request_services_rls.sql` | 신규 | RLS: select all auth / mutate via parent backup_requests 정책 |
| `supabase/migrations/20260521c_backup_requests_drop_services_col.sql` | 신규 | `services text[]` 컬럼 drop (prod 0행) |
| `src/features/backup-requests/schemas.ts` | 수정 | `services: z.array(z.string().uuid()).max(20)` + Row에서 services 제거, `services_detail` 추가 |
| `src/features/backup-requests/queries.ts` | 수정 | select 중첩 join `backup_request_services(service_id, services!inner(...))` → services_detail 매핑 |
| `src/features/backup-requests/actions.ts` | 수정 | create/update 트랜잭션 (parent upsert + join rows diff insert/delete) |
| `src/features/backup-requests/__tests__/{schemas,queries,actions}.test.ts` | 수정 | RED → GREEN 회귀 |
| `src/features/backup-requests/mail-template.ts` | 수정 | services_detail → "대학명 — 서비스명" 렌더, escapeHtml 양쪽 |
| `src/features/backup-requests/mail-actions.ts` | 수정 | mail input 구성 시 services_detail 전달 |
| `src/features/backup-requests/__tests__/mail-template.test.ts` | 수정 | 정규화 표기 snapshot |
| `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` | 수정 | comma chips text 제거 → ServicesControls 패턴 multi-select |
| `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx` | 수정 | chip 클릭 → `/dashboard/services?q=<service_name>` Link |
| `src/app/dashboard/_components/inspector/list-variants/backup/Table.tsx` | 수정 | services_detail 표시 (text fallback 제거) |
| `src/app/dashboard/_components/inspector/list-variants/backup/filters.ts` | 수정 | blankBackupRow services [] |
| `src/app/dashboard/_components/inspector/list-variants/backup/__tests__/*` | 수정 | join 형상 + multi-select 회귀 |
| `src/app/dashboard/backup/page.tsx` | 수정 | listServices 결과를 EditForm prop으로 주입 |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | 수정 | BackupRow services 형상 uuid[] + services_detail[] |

## 단계

### T1: join table 마이그레이션

- **상태**: done (코드)
- **파일**: `supabase/migrations/20260521_backup_request_services_table.sql`
- **변경**: 신설. `(backup_request_id uuid REFERENCES backup_requests(id) ON DELETE CASCADE, service_id uuid REFERENCES services(id) ON DELETE CASCADE, PRIMARY KEY (backup_request_id, service_id))` + `create index on (service_id)` + `notify pgrst, 'reload schema';`
- **DoD**: `npx supabase db push` 성공. `\d backup_request_services` → 2 FK + composite PK + 1 idx
- **의존**: 없음

### T2: join table RLS

- **상태**: done (코드)
- **파일**: `supabase/migrations/20260521b_backup_request_services_rls.sql`
- **변경**: enable RLS. select policy `to authenticated using (true)`. insert/update/delete policy via `EXISTS (SELECT 1 FROM backup_requests br WHERE br.id = backup_request_id AND (br.requester_email = auth.email() OR is_admin()))`. GRANT authenticated/service_role.
- **DoD**: `select policyname, cmd from pg_policies where tablename='backup_request_services';` 3행 (select/insert/delete) + service_role privilege t
- **의존**: T1

### T3: services 컬럼 drop

- **상태**: done (코드)
- **파일**: `supabase/migrations/20260521c_backup_requests_drop_services_col.sql`
- **변경**: `alter table public.backup_requests drop column services; notify pgrst, 'reload schema';`
- **DoD**: `\d backup_requests` services 컬럼 부재. prod 0행이므로 데이터 손실 없음
- **의존**: T1, T2

### T4: schemas RED 테스트

- **상태**: done (코드)
- **파일**: `src/features/backup-requests/schemas.ts`, `__tests__/schemas.test.ts`
- **변경**: 테스트 — `servicesCreateSchema.services`가 uuid 배열 검증, text 입력 거부, max(20) 제한. Row에 services_detail 검증. `npm test` 실행 → 모듈 스키마 미반영으로 RED 확인
- **DoD**: schemas.test.ts 실행 결과 신규 케이스 fail 출력 캡처
- **의존**: T3

### T5: schemas GREEN

- **상태**: done (코드)
- **파일**: `src/features/backup-requests/schemas.ts`
- **변경**: `services: z.array(z.string().uuid()).max(20).default([])`. Row에서 `services` 제거 + `services_detail: z.array(serviceDetailSchema).default([])` 추가. `serviceDetailSchema` 신설 (id/service_id/service_name/university_name)
- **DoD**: `npm test src/features/backup-requests/__tests__/schemas.test.ts` 0 fail + `npm run typecheck` 0 error
- **의존**: T4

### T6: queries 중첩 join

- **상태**: done (코드)
- **파일**: `src/features/backup-requests/queries.ts`, `__tests__/queries.test.ts`
- **변경**: select 문자열에 `backup_request_services(service_id, services!inner(id, service_id, service_name, university_name))` 중첩 + row 후처리에서 `services_detail` 배열로 평탄화. test에서 supabase mock 응답 shape를 fixture로 고정
- **DoD**: queries.test 신규 join shape 검증 케이스 pass + `npm run typecheck` 0 error
- **의존**: T5

### T7: actions 트랜잭션 write

- **상태**: done (코드)
- **파일**: `src/features/backup-requests/actions.ts`, `__tests__/actions.test.ts`
- **변경**: createBackupRequest/updateBackupRequest에서 (a) backup_requests upsert (b) 기존 join rows delete (update 시) (c) `row.services` uuid[] → join rows insert. supabase 트랜잭션은 RPC 또는 순차 (실패 시 부모 그대로 두고 error 반환). zod 입력 검증 통과 가정
- **DoD**: actions.test — 2 services 생성 시 join rows 2건 / update 시 (1 remove + 1 add) 정확 반영 검증 + lint 0 new warn
- **의존**: T6

### T8: mail-template 갱신

- **상태**: done (코드)
- **파일**: `src/features/backup-requests/mail-template.ts`, `__tests__/mail-template.test.ts`
- **변경**: 입력 타입 `services: ServiceDetail[]` 로 변경. chips HTML 렌더에서 `${escapeHtml(univ)} — ${escapeHtml(name)}` 출력. 빈 배열은 "(없음)" placeholder
- **DoD**: mail-template.test snapshot 신규 형식 — 3 services 예시 + 빈 배열 케이스 pass
- **의존**: T7

### T9: mail-actions 통합

- **상태**: done (코드)
- **파일**: `src/features/backup-requests/mail-actions.ts`, `__tests__/mail-actions.test.ts`
- **변경**: rowToBackupMailInput에서 services_detail 그대로 통과. 기존 text[] 변환 제거
- **DoD**: mail-actions.test — services_detail 패스스루 + dry-run 모드 회귀 통과
- **의존**: T8

### T10: EditForm multi-select

- **상태**: done (코드)
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx`, `__tests__/EditForm.test.tsx`, `src/app/dashboard/backup/page.tsx`
- **변경**: comma textarea 제거. 신설 sub-UI: (1) 검색 input (300ms debounce, ilike) — `useSearchServices(q)` hook (2) 검색 결과 list — chip click → row.services에 toggle 추가/제거 (3) 선택 chip 영역 — services_detail 렌더. backup/page.tsx에서 `listServices({ pageSize: 50 })` 호출 후 prop drilling. ServicesControls 재사용 가능 여부는 T10 진입 시 grep으로 확정 — 불가하면 backup 전용 hook으로 최소 추출 (drive-by 금지)
- **DoD**: EditForm.test — 검색 input 입력 → 결과 chip → 클릭 시 선택 chip 추가, max 20 enforce. 디자인 토큰 사용 (하드코딩 색상 0)
- **의존**: T7

### T11: View + Table + filters + types 갱신

- **상태**: done (코드)
- **파일**: `View.tsx`, `Table.tsx`, `filters.ts`, `list-variants/types.ts`, 해당 `__tests__/*`
- **변경**: View — services_detail chips를 `<Link href="/dashboard/services?q=...">` 로 렌더. Table — services_detail.length + 첫 1~2 service_name 미리보기. filters.ts blankBackupRow services [] 갱신. types.ts BackupRow 형상 `services: string[]` (uuid) + `services_detail: ServiceDetail[]`
- **DoD**: 4 spec pass + Variant 일관성 (registry 무변경) + design-lint hook 통과
- **의존**: T7, T10

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| ServicesControls (PR-1.6) 재사용 가능성 미확정 | T10 진입 시 `src/app/dashboard/services/ServicesControls.tsx` grep → 검색 input 부분만 사용 가능하면 export 또는 backup 전용 hook으로 최소 추출. drive-by 리팩토링 금지 (rules/donts.md Surgical Change) |
| supabase 중첩 select 응답 shape ↔ zod 불일치 | T6에서 실 API 응답을 unit test fixture로 고정. queries.ts에서 zod parse 실패 시 console.error 후 빈 services_detail (기존 listServices 패턴 일관) |
| 기존 backup 메일 발송 시나리오 (PR #90/#91) 회귀 | T8/T9 snapshot test + 통합 smoke: dev server `/dashboard/backup` 진입 → 신규 요청 → 미리보기 모달 검증 |
| `services text[]` drop을 동일 PR에 포함 — 롤백 시 컬럼 복구 비용 | prod 0행 확인 (brainstorm 단계 검증). 마이그레이션 파일 timestamp 순서로 T1/T2 후 T3 보장. 롤백 SQL을 T3 코멘트에 명시 |
| Variant union/BackupRow 형상 변경이 타 도메인 영향 | types.ts 단일 정의 패턴 (CLAUDE.md 명시) — 1곳 갱신으로 InspectorListBody/ListPattern 자동 호환. typecheck 0 error로 보장 |
| join table RLS 정책 오작동 (member가 타인 backup_request 수정 가능 등) | T2 적용 후 SQL 검증 — `SET ROLE authenticated; SELECT count(*) FROM backup_request_services;` 통과 / mutation은 본인/admin만 허용 확인 |
| zod uuid 검증이 사용자 UX 저하 (잘못된 uuid 직접 타이핑 불가) | 검색 결과 chip click만 services 추가 가능하도록 UI 제약. 사용자가 uuid 직접 입력 시나리오 X |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-14T04:34Z | plan | created | brainstorm 20260514-132106 채택 + planner 분석 (11 단계) |
| 2026-05-14T05:20Z | T1~T11 | done (코드) | 모든 코드 단계 완료. typecheck 0, lint 변동 없음. 마이그레이션 prod 적용 + 통합 smoke 남음 |
