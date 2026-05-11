---
plan_id: 20260511-045855-receivables-reminder-mail
status: in_progress
created: 2026-05-11T04:58:55Z
hard_gate: brief
source: .claude/memory/brainstorms/20260511-receivables-reminder-mail.md
branch: feat/receivables-reminder-mail
---

# Plan: 미수채권 학교담당자 독려 메일 발송

## Goal

경과일수 ≥ 10일인 미수채권 청구 건을 학교담당자별로 묶어 Microsoft Graph `sendMail`로 입금 독려 메일을 발송한다. admin 전용 수동 트리거 + 미리보기 모달 + dry-run 안전장치 + 발송 이력 적재까지 포함한다.

## Approach

- **인프라 재활용**: 기존 `getGraphToken` (client_credentials)을 그대로 사용. Azure AD 측 `Mail.Send` Application permission 추가는 운영 작업으로 분리 (코드 외).
- **도메인 추가**: `src/features/receivables/` 아래 mail-* 파일들을 신규 추가하여 기존 read/write 코드와 결합도 최소화.
- **DB 이력**: `receivables_mail_sends` 테이블 + RLS (select은 admin/member, insert는 server action에서 service_role 우회).
- **TDD 순서**: DB migration → schema → grouping → template → sendmail wrapper → action → preview query → UI → e2e.
- **첫 머지는 `MAIL_DRY_RUN=true` 고정** — 실제 발송은 운영 검증 후 토글.

## Out of Scope

- 자동 cron / 스케줄러
- admin → member 권한 확대
- 발송 이력 페이지 (`/dashboard/receivables/mail-history`)
- 템플릿 관리 UI
- 다국어 / multi-tenant
- 멱등키 기반 재시도 큐 (단순 throttle만)

## 영향 파일

| 파일 | 유형 | 변경 요약 |
| --- | --- | --- |
| `supabase/migrations/20260511_receivables_mail_sends_table.sql` | 신규 | 테이블 + 인덱스 + updated_at trigger |
| `supabase/migrations/20260511b_receivables_mail_sends_rls.sql` | 신규 | RLS (select: admin/member, modify: admin) + GRANT |
| `src/features/receivables/mail-schemas.ts` | 신규 | zod: recipient/group/sendInput/sendResult |
| `src/features/receivables/__tests__/mail-schemas.test.ts` | 신규 | 잘못된 email, 빈 그룹, 음수 금액 거부 |
| `src/features/receivables/mail-grouping.ts` | 신규 | Excel row → 학교담당자별 그룹화 + 경과일수 필터 |
| `src/features/receivables/__tests__/mail-grouping.test.ts` | 신규 | 경과일수 경계, 같은 담당자 묶음, 잘못된 이메일 제외 |
| `src/features/receivables/mail-template.ts` | 신규 | HTML 빌더 + escapeHtml/fmtDate/formatWon |
| `src/features/receivables/__tests__/mail-template.test.ts` | 신규 | XSS 이스케이프, 통화 포맷, 단/복수 거래처 텍스트 |
| `src/lib/microsoft/sendmail.ts` | 신규 | Graph `/users/{id}/sendMail` 래퍼 |
| `src/lib/microsoft/__tests__/sendmail.test.ts` | 신규 | 401/429/200 분기, body 페이로드 형식 |
| `src/features/receivables/mail-queries.ts` | 신규 | `previewReminderRecipients` server-only |
| `src/features/receivables/__tests__/mail-queries.test.ts` | 신규 | sheet 빈 경우, 임계값 통과 0개 |
| `src/features/receivables/mail-actions.ts` | 신규 | `sendReminderEmails` Server Action (admin only) |
| `src/features/receivables/__tests__/mail-actions.test.ts` | 신규 | viewer 거부, admin 통과, Graph 실패 시 status=failed |
| `src/components/receivables/SendRemindersButton.tsx` | 신규 | admin 분기 트리거 버튼 |
| `src/components/receivables/SendRemindersModal.tsx` | 신규 | 미리보기 모달 |
| `src/app/dashboard/receivables/page.tsx` | 수정 | admin 분기 후 버튼+모달 mount |
| `.env.example` | 수정 | 신규 4개 ENV 추가 |
| `CLAUDE.md` | 수정 | 메일 발송 흐름 + Azure AD permission 메모 |
| `e2e/dashboard-receivables-mail.spec.ts` | 신규 | admin → 모달 → preview → dry-run 발송 |

**합계**: 신규 17 + 수정 3 = **20 파일** (간략 설계 경계선)

## 단계 (T1 ~ T16)

### T1: DB 마이그레이션 — receivables_mail_sends 테이블
- **상태**: pending
- **파일**: `supabase/migrations/20260511_receivables_mail_sends_table.sql`
- **TDD**: 예외 (SQL 설정)
- **변경**: 테이블 + 인덱스 (sender_operator_id, recipient_email, sent_at desc) + `set_updated_at` trigger + `notify pgrst, 'reload schema'`
- **DoD**: `\d public.receivables_mail_sends` 9개 컬럼 존재
- **의존**: 없음

### T2: DB RLS + GRANT
- **상태**: pending
- **파일**: `supabase/migrations/20260511b_receivables_mail_sends_rls.sql`
- **TDD**: 예외 (SQL)
- **변경**: `enable row level security` + select(admin OR member) + modify(admin) + `grant ... to authenticated` + `grant all to service_role` + cache reload
- **DoD**: `pg_policies` 4건 확인, viewer로 select 시 0 rows
- **의존**: T1

### T3: zod 스키마 — RED
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/mail-schemas.test.ts`
- **TDD**: RED
- **변경**: 5개 케이스 (email 형식, 빈 customer_names, 음수 amount, threshold>0, days_overdue>=0)
- **DoD**: 5건 모두 RED (대상 모듈 없음)
- **의존**: T2

### T4: zod 스키마 — GREEN
- **상태**: pending
- **파일**: `src/features/receivables/mail-schemas.ts`
- **TDD**: GREEN
- **변경**: `recipientSchema`, `groupSchema`, `sendReminderInputSchema`, `sendReminderResultSchema` + 타입 export
- **DoD**: T3 5/5 PASS
- **의존**: T3

### T5: 그룹화 로직 — RED
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/mail-grouping.test.ts`
- **TDD**: RED
- **변경**: 4 케이스 (경과일수 ≥ 10 필터, 담당자 묶음, 잘못된 이메일 excluded, 컬럼 누락)
- **DoD**: 4건 RED
- **의존**: T4

### T6: 그룹화 로직 — GREEN
- **상태**: pending
- **파일**: `src/features/receivables/mail-grouping.ts`
- **TDD**: GREEN → REFACTOR
- **변경**: `groupRecipientsByOwner(sheet, thresholdDays)` → `{ groups, excluded }`. 헤더 매칭 정규식 (`/학교\s*담당자|담당자\s*이메일/`, `/경과\s*일수|경과/`) `pickColumns` 패턴 따름
- **DoD**: T5 4/4 PASS, 함수 ≤ 50줄, nesting ≤ 3
- **의존**: T5

### T7: HTML 템플릿 — RED
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/mail-template.test.ts`
- **TDD**: RED
- **변경**: 4 케이스 (XSS escape, 통화 포맷, 단/복수 거래처 텍스트, sender displayName 포함)
- **DoD**: 4건 RED
- **의존**: T4

### T8: HTML 템플릿 — GREEN
- **상태**: pending
- **파일**: `src/features/receivables/mail-template.ts`
- **TDD**: GREEN
- **변경**: `buildReminderHtml({ group, senderName, companyName })` + 헬퍼. brainstorm 참고 HTML 구조
- **DoD**: T7 4/4 PASS, ≤ 200줄
- **의존**: T7

### T9: Graph sendMail — RED
- **상태**: pending
- **파일**: `src/lib/microsoft/__tests__/sendmail.test.ts`
- **TDD**: RED
- **변경**: `global.fetch` 모킹. 4 케이스 (200/401/429/body 페이로드 형식)
- **DoD**: 4건 RED
- **의존**: T4

### T10: Graph sendMail — GREEN
- **상태**: pending
- **파일**: `src/lib/microsoft/sendmail.ts`
- **TDD**: GREEN
- **변경**: `sendGraphMail({ toEmail, toName?, subject, html, senderUserId })`. `getGraphToken()` → `/users/{senderUserId}/sendMail` POST. ENV 누락 시 throw
- **DoD**: T9 4/4 PASS
- **의존**: T9

### T11: preview query — RED+GREEN
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/mail-queries.test.ts` + `src/features/receivables/mail-queries.ts`
- **TDD**: RED → GREEN
- **변경**: `previewReminderRecipients()` — `fetchReceivablesSheet()` mock + 그룹화 호출 + threshold ENV 적용. 3 케이스 (sheet null, threshold 미설정 기본 10, 정상)
- **DoD**: 3/3 PASS
- **의존**: T6, T10

### T12: Server Action — RED
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/mail-actions.test.ts`
- **TDD**: RED
- **변경**: `getCurrentOperator`/`sendGraphMail`/`createAdminClient` mock. 4 케이스 (viewer/member 거부 sendGraphMail 0회, admin+dry-run 0회 호출 dry_run 이력, admin+200 그룹 수만큼 호출 sent 이력, admin 실패 시 failed 이력 + error_message)
- **DoD**: 4건 RED
- **의존**: T11

### T13: Server Action — GREEN
- **상태**: pending
- **파일**: `src/features/receivables/mail-actions.ts`
- **TDD**: GREEN → REFACTOR
- **변경**: `"use server"`. `sendReminderEmails(input)`: zod parse → admin 검사 → dry-run 분기 → 그룹별 buildReminderHtml + sendGraphMail (1초 throttle) → service_role admin client로 `receivables_mail_sends.insert` → `revalidatePath`
- **DoD**: T12 4/4 PASS, 함수 ≤ 50줄
- **의존**: T12

### T14: 환경 변수 + 문서
- **상태**: pending
- **파일**: `.env.example`, `CLAUDE.md`
- **TDD**: 예외 (설정/문서)
- **변경**: `.env.example`에 `MICROSOFT_MAIL_SENDER_USER_ID=`, `MAIL_COMPANY_NAME=Folio`, `MAIL_REMINDER_THRESHOLD_DAYS=10`, `MAIL_DRY_RUN=true`. `CLAUDE.md`에 "미수채권 독려 메일" 한 단락 (Azure AD `Mail.Send` Application permission 필요 + dry-run 기본 true)
- **DoD**: `npm run build` 통과
- **의존**: T13

### T15: UI 버튼 + 모달 + page mount
- **상태**: pending
- **파일**: `src/components/receivables/SendRemindersButton.tsx`, `src/components/receivables/SendRemindersModal.tsx`, `src/app/dashboard/receivables/page.tsx`
- **TDD**: 예외 (UI — e2e로 커버)
- **변경**:
  - Button: admin일 때만 렌더, 클릭 시 모달 토글
  - Modal: preview 결과를 카드 리스트 + 담당자별 체크박스 + `useActionState` 송신
  - page.tsx: admin 분기에서 preview 호출 + `<SendRemindersButton preview={...} />` mount
- **DoD**: `npm run lint` 통과, `npm run build` 통과, `npx tsc --noEmit` 0 errors. 파일당 ≤ 200줄
- **의존**: T13, T14

### T16: E2E dry-run
- **상태**: pending
- **파일**: `e2e/dashboard-receivables-mail.spec.ts`
- **TDD**: RED → GREEN
- **변경**: `MAIL_DRY_RUN=true` 환경에서 viewer 로그인 → 버튼 비가시, admin 로그인 → 클릭 → 모달 → 그룹 1+ 노출 → 송신 → 토스트 + `receivables_mail_sends` insert (status=`dry_run`) 확인
- **DoD**: `npm run e2e -- dashboard-receivables-mail` PASS, 회귀 0건
- **의존**: T15

## 단계 의존 그래프

```
T1 → T2 → T3 → T4 ─┬─ T5 → T6 ─┐
                   ├─ T7 → T8 ─┼─ T11 → T12 → T13 → T14 → T15 → T16
                   └─ T9 → T10 ┘
```

병렬 가능: T5/T6, T7/T8, T9/T10 (T4 이후 독립).
직렬 강제: T11 → T12 → T13 → T15 → T16.

## 리스크

| # | 리스크 | 영향 | 완화 |
| - | --- | --- | --- |
| R1 | Azure AD `Mail.Send` Application permission 누락 | 401, 전 발송 실패 | T14 문서 명시, 첫 머지는 `MAIL_DRY_RUN=true` 고정 |
| R2 | Graph rate limit 429 | 일부 그룹 누락 | T10 throttle 1초 + T13 그룹별 status 개별 기록 |
| R3 | 발송 후 롤백 불가 | 잘못된 본문/대상 송신 회수 불가 | preview 모달에서 담당자별 체크박스 + 총 건수/금액 표시 + 명시적 확인 클릭 |
| R4 | dry-run 미동작 → 실수로 실발송 | 데이터 사고 | T13에서 dry-run 분기 가장 먼저 평가, T12 단위 테스트에서 fetch 0회 호출 검증 |
| R5 | 학교담당자 컬럼 누락/리네임 | 그룹 0건, 사용자 혼란 | T6에서 헤더 매칭 실패 시 빈 결과 + `excluded: ['column_not_found']`, 모달에 경고 표시 |
| R6 | 이메일 형식 오류 셀 | silent 누락 | T6에서 zod email() 통과 못한 셀 `excluded[]` 노출 (silent drop 금지) |
| R7 | service_role 키 노출 | 보안 사고 | 이력 insert 한정, 기존 `src/lib/supabase/admin.ts` 패턴 재사용 (server-only) |
| R8 | 운영자 displayName 누락 | 본문 발신자 폴백 | T13에서 `me.displayName ?? '관리자'`, 단위 테스트 검증 |
| R9 | 20파일 경계선 | HARD-GATE 등급 모호 | 진행 중 추가 파일로 22+ 되면 worktree 격리 |
| R10 | 테이블 이름 충돌 | 마이그레이션 실패 | T1 SQL은 `create table if not exists`, `\dt` 확인 후 적용 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-11T04:58:55Z | plan | created | source: 20260511-receivables-reminder-mail brainstorm |
