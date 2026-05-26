---
plan_id: 20260526-015532-receivables-operator-mail
status: in_progress
created: 2026-05-26T01:55:32+09:00
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260526-015532-receivables-automation-migration.md
---

# Plan: PR-1 운영자 미수채권 알림 메일 + 자동화 잡

## Goal

GAS의 `sendAllInvoicesMail` (운영자 본인용 미수채권 알림 메일, 평일 10시) 기능을 OPS-Console로 이전. 자동화 실행 메뉴(`/dashboard/automations`)에 등록하여 admin 수동 트리거 + GitHub Actions schedule cron으로 자동 실행. GAS의 학교담당자 메일은 이미 `receivables/mail-actions.ts`에 있으므로 PR-1 범위 밖.

## Approach

brainstorm 대안 A (단계 분할 4 PR)의 PR-1. 기존 OPS-Console 인프라 최대 재사용:
- `lib/microsoft/sendmail` — Graph sendMail (운영자 본인 메일박스로 발송, Application permission)
- `features/automations/registry` — `AUTOMATION_JOBS` 1줄 등록으로 자동화 메뉴 노출
- `.github/workflows/insights-fetch.yml` 패턴 — schedule cron + workflow_dispatch
- `receivables/mail-actions.ts` 패턴 — 이력 테이블 + dry_run/sent/failed status + 1초 sleep throttle

GAS 코드의 `getInvoiceGroupedByOperator_` → SharePoint Excel usedRange fetch (OPS-Console에 이미 Graph fetch 패턴 있음, 향후 `receivables` 도메인이 SharePoint 시트 → Supabase ingest 구조면 Supabase 쿼리로 대체)

## Out of Scope

- 입금 내역 자동 매칭 (PR-2 — `autoMatchDeposits`)
- 입금완료 버튼 (PR-3 — GAS `doGet` Web App 대체)
- GAS 트리거·Web App 회수 (PR-4)
- 학교담당자 메일 (이미 `mail-actions.ts`에 있음, GAS `sendSchoolInvoicesMail` 폐기는 PR-4)

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/NNNN_receivables_operator_mail_sends.sql` | 신규 | 이력 테이블 + RLS |
| `src/features/receivables/operator-mail-queries.ts` | 신규 | 운영자별 미수 그룹 조회 |
| `src/features/receivables/mail-template-operator.ts` | 신규 | HTML + subject 빌더 |
| `src/features/receivables/operator-mail-actions.ts` | 신규 | server action + admin 가드 |
| `src/features/receivables/__tests__/mail-template-operator.test.ts` | 신규 | RED |
| `src/features/receivables/__tests__/operator-mail-actions.test.ts` | 신규 | RED |
| `src/features/automations/jobs/receivables-mail-operator.ts` | 신규 | AutomationJob.run |
| `src/features/automations/registry.ts` | 수정 | 1줄 |
| `scripts/receivables-mail-operator.mjs` | 신규 | GH Actions 진입점 |
| `.github/workflows/receivables-mail-operator.yml` | 신규 | cron `0 1 * * 1-5` (UTC, KST 10시) |

## 단계

### T1: 이력 테이블 마이그레이션
- **상태**: pending
- **파일**: `supabase/migrations/NNNN_receivables_operator_mail_sends.sql`
- **변경**: `receivables_operator_mail_sends` 테이블 + RLS (read=ops, insert=service_role) + 인덱스 (sent_at desc, sender_operator_id). `receivables_mail_sends`와 동일한 컬럼 스키마 (sent_at/sender/recipient/customer_names/receivable_count/total_amount/graph_message_id/status/error_message)
- **DoD**: 로컬 migration apply 성공 + `pg_policies` 2건 + 인덱스 2개
- **의존**: 없음
- **완료일**: 
- **노트**: 

### T2: 운영자 그룹 조회 쿼리
- **상태**: pending
- **파일**: `src/features/receivables/operator-mail-queries.ts`
- **변경**: `findReceivablesForOperator(operatorEmail, thresholdDays)` — 운영자별 미수채권 (경과일수 ≥ threshold + 적요 비어있음) 반환. 기존 `mail-queries.ts` 패턴 재사용
- **DoD**: 함수 export, Supabase에서 본인 row만 SELECT 동작 확인 (수동 테스트 또는 unit)
- **의존**: T1
- **완료일**: 
- **노트**: GAS의 `TARGET_DAYS` 배열(10,15,20...) 대신 단순 threshold (≥10일) 사용. GAS는 정확히 해당 일자만 발송이지만 OPS-Console은 cron이 매일 도는 게 자연스러움 — brainstorm 단계 결정사항으로 기록

### T3: RED — 메일 템플릿 테스트
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/mail-template-operator.test.ts`
- **변경**: HTML body에 운영자 이름 + 미수채권 표 + 입금완료 버튼 placeholder + FUN_QUOTES 1개 포함 검증. subject는 "[운영부 상황실] 미수채권 확인 알림" 형식
- **DoD**: `vitest run` 실패 확인 (RED)
- **의존**: 없음 (T4보다 먼저)
- **완료일**: 
- **노트**: GAS의 FUN_QUOTES는 신규 파일에서 module 상수로 재사용

### T4: GREEN — 운영자 메일 템플릿 구현
- **상태**: pending
- **파일**: `src/features/receivables/mail-template-operator.ts`
- **변경**: `buildOperatorReminderHtml(operatorName, rows)` + `buildOperatorReminderSubject()`. GAS의 `buildMailHtml_` 톤 유지 (Pretendard, vermilion 강조). 입금완료 버튼은 PR-3에서 OPS-Console URL로 교체 — PR-1에서는 placeholder URL (`/dashboard/receivables?id=...`)
- **DoD**: T3 통과 (GREEN)
- **의존**: T3
- **완료일**: 
- **노트**: 

### T5: RED — server action 테스트
- **상태**: pending
- **파일**: `src/features/receivables/__tests__/operator-mail-actions.test.ts`
- **변경**: `sendOperatorReminder({ dryRun: true })` 시 `sendGraphMail` mock 미호출 + 이력 테이블에 `status=dry_run` insert. admin 외 호출 시 throw
- **DoD**: vitest 실패 확인
- **의존**: T4
- **완료일**: 
- **노트**: 

### T6: GREEN — server action 구현
- **상태**: pending
- **파일**: `src/features/receivables/operator-mail-actions.ts`
- **변경**: `sendOperatorReminder({ dryRun, operatorEmail? })` server action. admin 가드 → 운영자별 그룹 조회 → 1초 sleep → Graph sendMail → 이력 적재. dryRun 시 Graph 호출 skip
- **DoD**: T5 통과
- **의존**: T2, T4, T5
- **완료일**: 
- **노트**: `lib/microsoft/sendmail.ts`의 `sendGraphMail` 시그니처 확인 후 sender 지정 방식 일치

### T7: AutomationJob run wrapper
- **상태**: pending
- **파일**: `src/features/automations/jobs/receivables-mail-operator.ts`
- **변경**: `runReceivablesMailOperator()` — 모든 운영자 loop → `sendOperatorReminder` 호출 → 합계 `AutomationRunResult` 반환 (sent/failed/dryRun 카운트). `MAIL_DRY_RUN=true` env 시 dryRun 강제
- **DoD**: 함수 export + `AutomationRunResult` 타입 일치
- **의존**: T6
- **완료일**: 
- **노트**: 

### T8: registry 등록
- **상태**: pending
- **파일**: `src/features/automations/registry.ts`
- **변경**: `AUTOMATION_JOBS` 배열에 1줄 추가 (`receivables-mail-operator`, label "운영자 미수채권 알림", scheduleInfo "평일 10:00 자동 (GitHub Actions)", cooldownMinutes 60)
- **DoD**: `/dashboard/automations` 페이지에 잡 노출 (브라우저 수동 확인)
- **의존**: T7
- **완료일**: 
- **노트**: `queries.ts`의 `LAST_RUN_RESOLVERS`에도 `receivables_operator_mail_sends.sent_at desc` 쿼리 추가

### T9: GitHub Actions 진입 스크립트
- **상태**: pending
- **파일**: `scripts/receivables-mail-operator.mjs`
- **변경**: `node` 진입점 — Supabase admin client 직접 사용하여 잡 호출 (Next.js server 부팅 없이 실행). `scripts/insights-fetch.mjs` 패턴 따름
- **DoD**: 로컬에서 `node scripts/receivables-mail-operator.mjs` 실행 시 dry-run 모드로 통과 (env `MAIL_DRY_RUN=true`)
- **의존**: T7
- **완료일**: 
- **노트**: 

### T10: GitHub Actions workflow yml
- **상태**: pending
- **파일**: `.github/workflows/receivables-mail-operator.yml`
- **변경**: `insights-fetch.yml` 복제. cron `0 1 * * 1-5` (UTC) = KST 평일 10시. secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AZURE_AD_*`, `SHAREPOINT_*`, `MAIL_*`. `workflow_dispatch` 포함
- **DoD**: GitHub Actions UI에서 workflow_dispatch 수동 실행 시 정상 종료
- **의존**: T9
- **완료일**: 
- **노트**: 

### T11: 수동 dry-run 검증
- **상태**: pending
- **파일**: —
- **변경**: `/dashboard/automations`에서 `receivables-mail-operator` 잡 dry-run 트리거 → `receivables_operator_mail_sends` 테이블에 `status=dry_run` row 적재 확인
- **DoD**: row N건 (운영자 수만큼) 적재, Graph 발송 0건
- **의존**: T8
- **완료일**: 
- **노트**: 

### T12: 실 발송 검증 (본인 메일)
- **상태**: pending
- **파일**: —
- **변경**: TARGET_EMAIL 본인으로 실 발송 (`MAIL_DRY_RUN=false` + 운영자 1명으로 제한). 본인 메일 수신 확인 + `status=sent` 이력
- **DoD**: 본인 메일 수신 + 이력 status sent
- **의존**: T11
- **완료일**: 
- **노트**: 

## 리스크

| 리스크 | 완화 |
|---|---|
| GAS와 중복 발송 (PR-1 머지 ~ GAS 트리거 삭제 사이) | PR description checklist로 머지 직전 GAS `createWeekday10amTriggers` 트리거 삭제 강제 |
| 운영자 메일박스 권한 누락 (`Mail.Send` Application + admin consent) | T12에서 본인 메일 실 발송으로 사전 확인 |
| 대량 운영자 발송 throttling | T7에서 1초 sleep (기존 `mail-actions.ts` 패턴) |
| 이력 테이블 schema drift | T1에서 `receivables_mail_sends`와 컬럼 정합 |
| 입금완료 버튼 URL (PR-3 미완 상태에서 PR-1 발송 시) | PR-1에서는 placeholder URL (`/dashboard/receivables`)로 발송, PR-3에서 inline action URL로 교체 |
| TARGET_DAYS 정책 변경 (GAS의 정확 일자 발송 → OPS-Console 매일 threshold) | brainstorm 단계 결정사항으로 PR description 명기 |

## Plan revision 노트

- **2026-05-26**: T9/T10에서 mjs 직접 로직 inline 대신 **API route + CRON_SECRET 패턴** 채택. `/api/automations/run` route 신규 (POST + Bearer secret 인증), mjs는 단순 trigger. 이유: SharePoint fetch + grouping + sendMail 로직을 mjs에 복제하면 ts 테스트 커버리지 무효화 + 유지보수 부담 큼. 향후 잡 추가 시 같은 route 재사용 가능. insights-fetch의 mjs 직접 패턴과는 다름 — 별도 마이그레이션 가능.

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-26T01:55:32+09:00 | — | plan 생성 | brainstorm spec 기반 |
| 2026-05-26T02:30:35+09:00 | T1~T6 | pending → done | 마이그·grouping·template·action 완성, 19 test GREEN |
| 2026-05-26T06:55:04+09:00 | T7~T10 | pending → done | job wrapper + registry + API route + mjs + workflow yml, 92 test GREEN |
| — | T11, T12 | pending | 마이그 apply + secrets 설정 + dry-run/실 발송 검증 (사용자) |
