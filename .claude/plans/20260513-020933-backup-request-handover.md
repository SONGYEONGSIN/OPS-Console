---
plan_id: 20260513-020933-backup-request-handover
status: in_progress
created: 2026-05-13T02:09:33Z
hard_gate: brief
source: .claude/memory/brainstorms/20260513-003405-backup-request-handover.md
---

# Plan: 백업 요청 메뉴 — 휴가·외근 인수인계 + 자동 메일

> Source: `.claude/memory/brainstorms/20260513-003405-backup-request-handover.md` (대안 B 채택)

## Goal

운영자가 휴가·외근 직전 본인 담당 서비스/연락처를 동료(백업자)에게 인계하는 `/dashboard/backup` 페이지를 구축한다. 등록 즉시 백업자에게 HTML 메일 + PDF 첨부 자동 발송, 요청자 팀원(`operators.team` 같은 사용자)을 CC로 묶는다. 첫 한 달 내 5건 등록 / 메일 전송 성공률 > 95% / 모바일 PDF 텍스트 깨짐 0 을 성공 기준으로 한다.

## Approach

대안 B(백업 메뉴만 우선, services/contacts는 자유 텍스트 chips). 코드베이스 컨벤션 일관 적용:

- **list-variants 아키텍처** (#86): `_components/inspector/list-variants/backup/{View,EditForm,Table,filters}.tsx` 4슬롯 + `registry.ts` 1줄 추가 (`ListPattern.tsx`/`InspectorListBody.tsx` 무변경)
- **정적 라우트 오버라이드**: `/dashboard/backup/page.tsx`로 사이드바 placeholder 대체 (ai-insight·my-ai-work 패턴 일관)
- **features 패턴**: `src/features/backup-requests/{schemas,queries,actions}.ts` (read = queries, mutation = server action + `useActionState` + zod + `revalidatePath`)
- **메일 인프라 재사용**: `src/lib/microsoft/sendmail.ts`의 `sendGraphMail` 호출. receivables `mail-actions.ts` 패턴 + `MAIL_DRY_RUN` 안전장치 + 발송 이력 테이블 (`backup_request_mail_sends`)
- **PDF**: `@react-pdf/renderer` 의존성 추가. Pretendard/Noto Sans KR 폰트 등록 — server-side에서 `renderToBuffer`로 Uint8Array 생성 → Graph attachments에 base64 첨부
- **PR 분할**: PR-1 (DB + features + list-variants + page) → PR-2 (PDF + 메일 server action + dry_run 검증)

## Out of Scope

- services / contacts 정식 도메인 schema — 자유 텍스트 chips (운영부 실 입력 누적 후 follow-up epic으로 schema 결정)
- 승인 워크플로우, 백업자 수락/거절 응답, 반복 백업, 첨부 파일 업로드, Slack 알림, 사이드바 count 동적 동기화 (count "1" 하드코드 유지)
- viewer 권한 등록 차단 — brainstorm "전원 접근 가능" 명시 따라 zod에서 별도 차단 X (RLS는 단순 authenticated)
- services / contacts 백엔드 자동완성 (클라이언트 distinct suggest만 후속에서 추가)

## 영향 파일

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `supabase/migrations/20260519_backup_requests_table.sql` | 신규 | `backup_requests` 14필드 + 인덱스 + `set_updated_at` 트리거 + `notify pgrst` |
| `supabase/migrations/20260519b_backup_requests_rls.sql` | 신규 | RLS select all / insert·update·delete = admin OR requester + GRANT |
| `supabase/migrations/20260519c_backup_request_mail_sends_table.sql` | 신규 | 메일 발송 이력 (receivables_mail_sends 패턴) |
| `supabase/migrations/20260519d_backup_request_mail_sends_rls.sql` | 신규 | RLS + GRANT |
| `src/features/backup-requests/schemas.ts` | 신규 | zod: create/update/sendMail 입력 + cross-field + self 차단 |
| `src/features/backup-requests/queries.ts` | 신규 | `listBackupRequests`, `getBackupRequestById`, `listOperatorsForBackup` |
| `src/features/backup-requests/actions.ts` | 신규 | `createBackupRequest` server action |
| `src/features/backup-requests/__tests__/schemas.test.ts` | 신규 | self 차단 / end<start / 빈 chips |
| `src/features/backup-requests/__tests__/queries.test.ts` | 신규 | list/get/filter |
| `src/features/backup-requests/__tests__/actions.test.ts` | 신규 | create happy / zod fail / auth fail |
| `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx` | 신규 | 인스펙터 read 모드 |
| `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx` | 신규 | 등록·편집 폼 (chips + 백업자 select + date range + markdown) |
| `src/app/dashboard/_components/inspector/list-variants/backup/Table.tsx` | 신규 | 리스트 행 4컬럼 |
| `src/app/dashboard/_components/inspector/list-variants/backup/filters.ts` | 신규 | filters + blankBackupRow factory |
| `src/app/dashboard/_components/inspector/list-variants/registry.ts` | 수정 | backup 1블록 추가 (import 4줄) |
| `src/app/dashboard/_components/inspector/list-variants/types.ts` | 수정 | Variant union에 "backup" 추가 |
| `src/app/dashboard/backup/page.tsx` | 신규 | 정적 라우트 RSC |
| `src/lib/pdf/backup-request-pdf.tsx` | 신규 (PR-2) | react-pdf 컴포넌트 + Pretendard 폰트 + `renderToBuffer` |
| `src/lib/pdf/__tests__/backup-request-pdf.test.ts` | 신규 (PR-2) | Buffer + 한글 케이스 |
| `src/features/backup-requests/mail-template.ts` | 신규 (PR-2) | 제목 + HTML 본문 빌더 |
| `src/features/backup-requests/mail-actions.ts` | 신규 (PR-2) | sendBackupRequestMail server action |
| `src/features/backup-requests/__tests__/mail-template.test.ts` | 신규 (PR-2) | HTML 빌더 |
| `src/features/backup-requests/__tests__/mail-actions.test.ts` | 신규 (PR-2) | dry_run / CC 산출 / 실패 적재 |
| `package.json` | 수정 (PR-2) | `@react-pdf/renderer` 추가 |
| `public/fonts/Pretendard-Regular.ttf` | 신규 (PR-2) | 한글 폰트 (SIL OFL) |
| `src/lib/microsoft/sendmail.ts` | 수정 분기 (PR-2) | attachments 시그니처 (필요 시) |

**총**: PR-1 ~17파일, PR-2 ~9파일.

## 단계

### PR-1 — DB + UI 등록·조회 (T1~T15)

### T1: backup_requests 테이블 마이그레이션
- 상태: pending
- 파일: `supabase/migrations/20260519_backup_requests_table.sql`
- 변경: 14필드 + 인덱스(requester_email / substitute_email / created_at desc / mail_status) + `set_updated_at` 트리거 + `notify pgrst` + check 제약(mail_status enum, leave_end_date >= leave_start_date)
- DoD: `supabase db push` 성공 + `\d public.backup_requests` 14컬럼 + `select count(*)` 0 OK
- 의존: 없음

### T2: backup_requests RLS + GRANT
- 상태: pending
- 파일: `supabase/migrations/20260519b_backup_requests_rls.sql`
- 변경: RLS enable + select all (authenticated) + insert·update·delete (admin OR requester_email = jwt email) + GRANT + `notify pgrst`
- DoD: db push 성공 + `select policyname from pg_policies where tablename='backup_requests'` 4건
- 의존: T1

### T3: backup_request_mail_sends 이력 테이블
- 상태: pending
- 파일: `supabase/migrations/20260519c_backup_request_mail_sends_table.sql`
- 변경: receivables_mail_sends 동형 + `backup_request_id uuid references backup_requests(id) on delete cascade` + 인덱스
- DoD: db push 성공 + `\d` 컬럼 확인
- 의존: T1

### T4: backup_request_mail_sends RLS + GRANT
- 상태: pending
- 파일: `supabase/migrations/20260519d_backup_request_mail_sends_rls.sql`
- 변경: select all + insert/update/delete admin only (server action은 service_role bypass)
- DoD: db push + policy 확인
- 의존: T3

### T5: zod 스키마
- 상태: pending
- 파일: `src/features/backup-requests/schemas.ts`
- 변경: `createInputSchema` (services/contacts array max(20), summary_md min(1).max(5000), leave end>=start refine, substitute != requester refine), `updateInputSchema` partial, `sendMailInputSchema`, `BackupRequestRow` type, `MAIL_STATUS` 상수
- DoD: typecheck 통과 + 모든 export 존재
- 의존: 없음 (T1과 병렬 가능)

### T6: schemas 단위 테스트 (RED→GREEN)
- 상태: pending
- 파일: `src/features/backup-requests/__tests__/schemas.test.ts`
- 변경: 유효 / 빈 summary 거부 / end<start 거부 / self 거부 / 빈 services 허용
- DoD: RED 1회 확인 → GREEN. `npm test schemas.test.ts` >=5 cases 통과
- 의존: T5

### T7: queries
- 상태: pending
- 파일: `src/features/backup-requests/queries.ts`
- 변경: `listBackupRequests()` (created_at desc), `getBackupRequestById(id)`, `listOperatorsForBackup(excludeEmail)` (active 운영자 본인 제외)
- DoD: typecheck + export 확인. 실행은 T8
- 의존: T1, T2

### T8: queries 단위 테스트
- 상태: pending
- 파일: `src/features/backup-requests/__tests__/queries.test.ts`
- 변경: Supabase client mock — list / getById / listOperators 정렬·제외
- DoD: `npm test queries.test.ts` >=3 cases 통과
- 의존: T7

### T9: createBackupRequest server action (RED→GREEN)
- 상태: pending
- 파일: `src/features/backup-requests/actions.ts`, `src/features/backup-requests/__tests__/actions.test.ts`
- 변경: `"use server"` + zod + 현재 operator 조회 + requester_team 스냅샷 → DB insert → revalidatePath
- DoD: RED → GREEN. `npm test actions.test.ts` >=3 cases (happy / zod fail / auth fail)
- 의존: T5, T6

### T10: list-variants/backup/filters + Variant 확장
- 상태: pending
- 파일: `src/app/dashboard/_components/inspector/list-variants/backup/filters.ts`, `.../list-variants/types.ts`
- 변경: `BACKUP_FILTERS = [전체 / 내가 등록 / 메일 실패]` + `blankBackupRow({currentUserName})` factory. `Variant` union에 `"backup"` 추가
- DoD: typecheck 통과 (registry 미완료 상태에서는 부분 통과 — T13까지 묶음 검증)
- 의존: 없음

### T11: list-variants/backup/Table
- 상태: pending
- 파일: `src/app/dashboard/_components/inspector/list-variants/backup/Table.tsx`
- 변경: 4컬럼(요청자/백업자/시작일/메일상태) + ai-work/Table 디자인 토큰 일관
- DoD: typecheck + design-lint hook 통과
- 의존: T10

### T12: list-variants/backup/View + EditForm
- 상태: pending
- 파일: `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx`, `.../EditForm.tsx`
- 변경: View(요청자/백업자/기간/chips/markdown/메일 상태). EditForm(useActionState + date range + 백업자 select + chips input + markdown textarea)
- DoD: typecheck. RTL fireEvent 테스트는 T15 수동 검증에 포함
- 의존: T7, T9, T11

### T13: registry.ts 1줄 추가
- 상태: pending
- 파일: `src/app/dashboard/_components/inspector/list-variants/registry.ts`
- 변경: Backup View/EditForm/Table/filters import + `backup: { View, EditForm, Table, Filters: BACKUP_FILTERS, blank: blankBackupRow }`
- DoD: `npm run typecheck` 0 errors. satisfies 통과
- 의존: T10, T11, T12

### T14: 정적 라우트 page.tsx
- 상태: pending
- 파일: `src/app/dashboard/backup/page.tsx`
- 변경: RSC + `listBackupRequests()` + `getCurrentOperator()` + ai-insight/page.tsx 구조 참고. Inspector 표시는 list-variants가 처리
- DoD: `npm run build` 성공 + `ƒ /dashboard/backup` 라우트 등록 확인
- 의존: T7, T13

### T15: PR-1 통합 검증
- 상태: pending
- 파일: 없음
- 변경: 없음
- DoD: `npm run lint` 0 errors / `npm run typecheck` 0 errors / `npm test` 전체 통과 / `npm run build` 성공 / 로컬 dev: 로그인 → /dashboard/backup → 등록 폼 1건 insert → 리스트 갱신 + DB select 1건
- 의존: T14

---

### PR-2 — PDF + 메일 발송 (T16~T22)

### T16: @react-pdf/renderer + Pretendard 한글 폰트
- 상태: pending
- 파일: `package.json`, `package-lock.json`, `public/fonts/Pretendard-Regular.ttf`
- 변경: `npm i @react-pdf/renderer` + 폰트 파일 배치 (SIL OFL) + LICENSE 메모
- DoD: `npm i` 성공 + 폰트 파일 >=100KB + 라이선스 명시
- 의존: T15

### T17: PDF 컴포넌트 + renderToBuffer (RED→GREEN)
- 상태: pending
- 파일: `src/lib/pdf/backup-request-pdf.tsx`, `src/lib/pdf/__tests__/backup-request-pdf.test.ts`
- 변경: `Font.register({family:'Pretendard'})` + `<Document><Page>` (요청자/백업자/기간/chips/summary) + `renderBackupRequestPdf(input): Promise<Buffer>`
- DoD: RED → GREEN. Buffer.byteLength > 1000 + 한글 입력 throw X
- 의존: T16

### T18: mail-template (제목 + HTML)
- 상태: pending
- 파일: `src/features/backup-requests/mail-template.ts`, `src/features/backup-requests/__tests__/mail-template.test.ts`
- 변경: `buildBackupMailSubject` + `buildBackupMailHtml` (receivables/mail-template.ts 디자인 일관, 인라인 스타일 메일 HTML 예외)
- DoD: RED → GREEN. 제목/본문 키워드 포함 검증
- 의존: T15

### T19: sendBackupRequestMail server action (RED→GREEN)
- 상태: pending
- 파일: `src/features/backup-requests/mail-actions.ts`, `src/features/backup-requests/__tests__/mail-actions.test.ts`
- 변경: zod + requester 조회 + CC=operators(team=requester_team, != requester, != substitute) 스냅샷 + PDF base64 + `sendGraphMail({attachments})` + 이력 적재 + mail_status update + `MAIL_DRY_RUN` 분기
- DoD: RED → GREEN. >=4 cases (dry_run / 권한 / CC 산출 / 실패 시 mail_failed 적재)
- 의존: T17, T18

### T20: sendGraphMail attachments 시그니처 확장 (필요 시)
- 상태: pending
- 파일: `src/lib/microsoft/sendmail.ts`
- 변경: 현재 sendGraphMail이 attachments 미지원이면 optional 파라미터 추가 + Graph body 매핑. 기존 receivables 회귀 0 확인
- DoD: typecheck + 기존 receivables 메일 단위 테스트 회귀 0
- 의존: 분기 — 현 시그니처 확인 후 attachments 이미 지원이면 SKIP
- 노트: T17 시작 전 sendmail.ts 시그니처 검토

### T21: EditForm 메일 hook + 재발송 버튼
- 상태: pending
- 파일: `src/app/dashboard/_components/inspector/list-variants/backup/EditForm.tsx`, `.../View.tsx`
- 변경: 등록 액션 성공 시 `sendBackupRequestMail(id)` 후속 호출 (atomic 아닌 점 명시 — 분리). View에서 `mail_status='mail_failed'` 시 재발송 버튼 노출
- DoD: typecheck + 수동: dry_run 모드 폼 제출 후 `backup_request_mail_sends.status='dry_run'` row 1건 적재 확인
- 의존: T19, T20

### T22: PR-2 통합 검증 (dry_run 실증)
- 상태: pending
- 파일: 없음
- 변경: 없음
- DoD: `MAIL_DRY_RUN=true npm run dev` → /dashboard/backup 등록 → mail_status='dry_run' row 생성 + Buffer→임시파일 저장 → Acrobat에서 한글 깨짐 없이 열림 확인 + `npm test` 전체 통과 + `npm run build` 성공 + `npm run lint` 0 warnings
- 의존: T21

## 리스크

- **PDF 한글 폰트**: react-pdf 기본 폰트 한글 미지원. Pretendard(SIL OFL) 등록 필수. T17 DoD에서 한글 케이스 실측
- **Graph sendMail 첨부 한계**: 4MB. 백업 PDF는 보통 <100KB로 안전. T17에서 Buffer length 측정, 1MB 초과 시 알림
- **CC 시점성**: 발송 시점 operators 쿼리 (휴가 직전 팀원 변동 가능). `backup_request_mail_sends.cc_emails`에 결과 저장으로 추적 가능
- **mail_failed 재발송**: 마지막 시도 상태만 mail_status에 반영. 재발송 성공 시 'sent'로 update. 이력은 별도 테이블 누적
- **services/contacts 자유 텍스트 누적 오타**: 동일 대학 다른 표기 — 대안 B 채택 사유로 의도된 trade-off. 클라이언트 distinct suggest는 follow-up
- **self 차단 / 휴가 기간 검증**: zod refine. T6 테스트 필수
- **viewer 권한 등록**: brainstorm "전원 접근" 명시. RLS authenticated true, zod 별도 차단 X
- **사이드바 count "1" 하드코드**: Out of Scope. 실제 등록 수와 어긋나는 점 알려진 채로 유지
- **sendGraphMail attachments 미지원 시 시그니처 확장**: T20. 기존 receivables 회귀 0 확인 필수
- **list-variants 약속 검증**: ListPattern.tsx / InspectorListBody.tsx 변경 0줄 — PR-1 diff에서 확인

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-13T02:09:33Z | plan | created | vibe-flow 동기화 직후 |
