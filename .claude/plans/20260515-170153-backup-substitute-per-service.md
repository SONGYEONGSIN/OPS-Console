---
plan_id: 20260515-170153-backup-substitute-per-service
status: in_progress
created: 2026-05-15T08:01:53Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260515-165751-backup-substitute-per-service.md
---

# Plan: 백업자 서비스별 분리 (PR-3)

## Goal

backup_request_services 행에 substitute_email/substitute_name nullable 컬럼 추가 → 서비스별 백업자 지정 가능. 메일은 백업자별 group by → 백업자 N명에게 각각 자기 담당 서비스만 포함된 메일 1통씩 발송. 기존 backup_requests.substitute_email/name은 *default fallback*로 유지 (back-compat).

## Approach

brainstorm 대안 A — 기존 N:M 테이블 확장. 새 테이블/RLS 변경 없음. mail-template의 `groupServicesBySubstitute()` 헬퍼로 그룹화 + mail-actions의 백업자별 loop 발송. EditForm은 chip 옆 select dropdown. 1명 일괄 케이스 동일 동작.

## Out of Scope

- backup_requests.substitute_email deprecate (back-compat 유지)
- 백업자별 재발송 UI (전체 재시도만 1차)
- 한 서비스에 백업자 N명 (서비스별 1명만)
- 마이그레이션 prod 적용 — PR 코드와 별도 (사용자 SQL Editor 적용)

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260524_backup_request_services_substitute.sql` | 신규 | 컬럼 2 + backfill UPDATE + reload |
| `src/features/backup-requests/schemas.ts` | 수정 | serviceDetailSchema/createSchema.services 확장 |
| `src/features/backup-requests/queries.ts` | 수정 | SELECT_WITH_SERVICES + flatten 매핑 |
| `src/features/backup-requests/actions.ts` | 수정 | joinRows에 substitute fallback |
| `src/features/backup-requests/mail-template.ts` | 수정 | groupServicesBySubstitute + 백업자별 본문 |
| `src/features/backup-requests/mail-actions.ts` | 수정 | 백업자별 loop sendGraphMail |
| `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` | 수정 | chip 옆 백업자 select |
| `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx` | 수정 | chip 라벨에 백업자 표시 |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 | backupServicesDetail 원소 타입 확장 |
| `src/app/dashboard/backup/page.tsx` | 수정 | onPersist에서 새 services shape 전달 |
| `src/features/backup-requests/__tests__/*` | 수정 | 백업자 2명 + 1명 일괄 케이스 |

## 단계

### T1: 마이그레이션 + backfill SQL
- **상태**: pending
- **파일**: `supabase/migrations/20260524_backup_request_services_substitute.sql`
- **변경**: nullable 컬럼 2 추가 + 기존 row를 backup_requests.substitute_*로 backfill + notify pgrst
- **DoD**: SQL Editor 적용 후 `select count(*) filter (where substitute_email is null) from backup_request_services` → 0
- **의존**: 없음

### T2: schemas.ts 확장
- **상태**: pending
- **파일**: `src/features/backup-requests/schemas.ts`
- **변경**: serviceDetailSchema에 substitute_email/name nullable optional. backupRequestCreateSchema.services를 `{service_id, substitute_email?, substitute_name?}[]` 튜플
- **DoD**: vitest schemas test — tuple 입력 parse 성공·실패 케이스 PASS
- **의존**: 없음

### T3: queries.ts SELECT 확장
- **상태**: pending
- **파일**: `src/features/backup-requests/queries.ts`
- **변경**: SELECT_WITH_SERVICES에 `backup_request_services.substitute_email,substitute_name` + flatten map
- **DoD**: typecheck pass + queries.test.ts mock으로 substitute_* 보존 확인
- **의존**: T2

### T4: actions.ts fallback
- **상태**: pending
- **파일**: `src/features/backup-requests/actions.ts`
- **변경**: joinRows에서 `substitute_email: s.substitute_email ?? parsed.data.substitute_email` (default fallback)
- **DoD**: actions.test.ts — 미지정 시 default / 명시 시 그 값 검증 케이스
- **의존**: T2, T3

### T5: mail-template 그룹화
- **상태**: pending
- **파일**: `src/features/backup-requests/mail-template.ts`
- **변경**: `groupServicesBySubstitute()` 신규 export + `buildBackupMailHtmlFor(substitute, services, ...)` 빌더 (기존 buildBackupMailHtml 보존)
- **DoD**: mail-template.test.ts — 2명 그룹 + 1명 일괄 case 본문 검증
- **의존**: T2

### T6: mail-actions 백업자별 loop
- **상태**: pending
- **파일**: `src/features/backup-requests/mail-actions.ts`
- **변경**: groupServicesBySubstitute 결과 for-of loop. 그룹마다 sendGraphMail + backup_request_mail_sends insert. 1개라도 실패면 mail_failed
- **DoD**: mail-actions.test.ts — sendGraphMail 2회 호출 + dry_run N row insert 검증
- **의존**: T5

### T7: ListRow.backupServicesDetail 타입 확장
- **상태**: pending
- **파일**: `src/app/dashboard/_components/patterns/ListPattern.tsx`
- **변경**: backupServicesDetail 원소에 substitute_email/name optional 추가
- **DoD**: typecheck pass
- **의존**: T3

### T8: EditForm chip 옆 select
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx`
- **변경**: selectedDetail chip 안에 작은 `<select>` (backupOperators 옵션, default "전체 백업자 사용" 빈값). onChange 시 selectedDetail[i].substitute_email/name 갱신
- **DoD**: EditForm.test.tsx — chip 안 select 노출 + onChange 시 setRow 호출 검증
- **의존**: T7

### T9: View chip 라벨에 백업자 표시
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx`
- **변경**: chip 내부에 `{s.substitute_name && <span>/ 백업자: {s.substitute_name}</span>}` (default fallback과 다를 때만)
- **DoD**: View.test.tsx에 substitute_name 케이스 추가
- **의존**: T7

### T10: page.tsx onPersist 새 services shape
- **상태**: pending
- **파일**: `src/app/dashboard/backup/page.tsx`
- **변경**: onPersist에서 services를 `{service_id, substitute_email, substitute_name}[]`로 전달. backupRequestToListRow에서 substitute_* 전달
- **DoD**: 로컬 /dashboard/backup 신규 등록 → listBackupRequests에서 substitute_* 보존
- **의존**: T4, T7, T8

### T11: 회귀 테스트 + verify
- **상태**: pending
- **파일**: backup-requests __tests__ 영역
- **변경**: 백업자 2명 시나리오 + 1명 일괄 케이스 (back-compat). mail-template / schemas / actions
- **DoD**: `npm test && lint && typecheck` 모두 통과
- **의존**: T2~T10

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| backfill 누락 → 메일 발송 그룹 NULL key → 0통 발송 | T1 SQL에 backfill UPDATE 포함 + null count 0 검증. T6에서 NULL 그룹은 default로 한 번 더 fallback |
| services_detail zod parse fail → listBackupRequests 0건 | T2 nullable optional 선언 + T1 backfill 먼저 적용 |
| 1명 일괄 회귀 (동일 인물에게 N통) | T5 group by가 동일 email 단일 그룹 보장. T11에 명시 case |
| mail loop 중 부분 실패 → partial state | 1개라도 실패면 mail_failed로 표기. 이력은 백업자별 status 보존 |
| EditForm select에서 미지정 chip 양산 | default option `value=""` = "전체 default 사용" 명시. 저장 시 actions에서 default로 채움 |
| chip 가로폭 깨짐 (모바일) | flex-wrap 유지로 long chip 한 줄 더 차지 허용 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-15T08:01:53Z | — | plan 생성 | brainstorm 20260515-165751 입력 |
