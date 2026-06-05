---
plan_id: 20260526-071409-receivables-deposit-match
status: completed
created: 2026-05-26T07:14:09+09:00
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260526-070922-receivables-deposit-match.md
---

# Plan: PR-2 입금 매칭 자동화 (GAS autoMatchDeposits → OPS-Console)

## Goal

GAS의 `autoMatchDeposits` + 7 매칭 함수 (`normalizeName_` / `similarity_` / `isNameMatchStrong_` / `collectUnpaidMisuByCustomer_` / `collectUnpaidDepositsByCustomer_` / `matchNM_` / `sumAmounts_` / `notifyAmountMismatch_`)를 TypeScript로 **1:1 포팅**하여 OPS-Console automation job으로 통합. SharePoint 입금내역 시트 ↔ 미수채권 시트 매칭 → K열(적요) 자동 "입금완료" 표기 + J열(입금예정일) 업데이트 + 입금내역 시트 K열(미결제표시) "처리완료" 표기. 매시간 cron 실행 + admin 수동 트리거. `MAIL_MATCH_DRY_RUN=true` default — 1주 dry-run 운영 후 live 전환.

## Approach

brainstorm 대안 A (단일 PR, GAS 1:1 포팅 + dry-run 기본). PR-1 인프라(automations registry / API route / workflow yml 패턴) 그대로 재사용. Pure function 4 모듈로 분리하여 SharePoint 의존 없이 단독 unit test 가능 → fixture 30+ 케이스로 회귀 보호.

## Out of Scope

- 입금완료 버튼 inline UI (PR-3 — GAS `doGet` Web App 대체)
- GAS 트리거·Web App 일괄 회수 (PR-4)
- chunk paging (GAS는 30개씩 처리 — OPS-Console은 초기 전수 + 1초 throttle, 100건+ 늘면 후속 PR)
- 매칭 알고리즘 개선 (Levenshtein → 더 정교한 한글 토크나이저 등) — PR-2는 1:1 포팅만

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `src/features/receivables-match/types.ts` | 신규 | `MisuRow`/`DepositRow`/`MatchResult`/`MatchRun` |
| `src/features/receivables-match/normalize.ts` | 신규 | GAS `normalizeName_` 1:1 |
| `src/features/receivables-match/similarity.ts` | 신규 | Levenshtein + `isNameMatchStrong_` |
| `src/features/receivables-match/collect.ts` | 신규 | 거래처별 미수/입금 수집 |
| `src/features/receivables-match/algorithm.ts` | 신규 | `matchNM_` + 3단계 디스패처 |
| `src/features/receivables-match/deposit-queries.ts` | 신규 | SharePoint deposit 시트 fetch |
| `src/features/receivables-match/patch.ts` | 신규 | K/J 셀 PATCH + dry-run 분기 |
| `src/features/receivables-match/mismatch-mail.ts` | 신규 | admin 알림 메일 (`notifyAmountMismatch_`) |
| `src/features/receivables-match/__tests__/normalize.test.ts` | 신규 | 30+ dict 케이스 |
| `src/features/receivables-match/__tests__/similarity.test.ts` | 신규 | Levenshtein + 강매칭 |
| `src/features/receivables-match/__tests__/collect.test.ts` | 신규 | 그룹핑 6 case |
| `src/features/receivables-match/__tests__/algorithm.test.ts` | 신규 | 단건/N:1/N:M 우선순위 |
| `src/features/receivables-match/__tests__/fixtures/gas-cases.json` | 신규 | 30+ 회귀 fixture |
| `src/features/automations/jobs/receivables-deposit-match.ts` | 신규 | AutomationJob wrapper |
| `src/features/automations/registry.ts` | 수정 | 1줄 추가 |
| `src/features/automations/queries.ts` | 수정 | LAST_RUN_RESOLVERS 1줄 |
| `supabase/migrations/20260526c_receivables_match_runs.sql` | 신규 | 이력 테이블 + RLS |
| `scripts/receivables-deposit-match.mjs` | 신규 | GH Actions trigger |
| `.github/workflows/receivables-deposit-match.yml` | 신규 | cron 매시간 |

## 단계

### T0: GAS 7 함수 fixture 30+ 케이스 수집
- **상태**: pending
- **파일**: `src/features/receivables-match/__tests__/fixtures/gas-cases.json` 신규
- **변경**: GAS 원본 코드의 정규화 dict (~30 항목), Levenshtein 비교 케이스, N:1/N:M 합산 시나리오를 JSON fixture로. 카테고리: 단건 일치 5 / 정규화 매핑 8 / 부분포함 4 / Levenshtein 3 / N:1 합산 5 / N:M 합산 3 / mismatch 2 / edge 4
- **DoD**: 30+ 케이스, 각각 `{ input, expected }` 구조
- **의존**: 없음
- **노트**: 

### T1: types.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/types.ts`
- **변경**: `MisuRow`/`DepositRow`/`MatchPair`/`MatchRun`/`MatchMode` 타입
- **DoD**: tsc green
- **의존**: T0
- **노트**: 

### T2: RED — normalize.test.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/__tests__/normalize.test.ts`
- **변경**: fixture의 정규화 dict + 한글 정규화(대학교→대) 케이스 30+
- **DoD**: vitest 실패 확인
- **의존**: T1
- **노트**: 

### T3: GREEN — normalize.ts (GAS `normalizeName_` 1:1)
- **상태**: pending
- **파일**: `src/features/receivables-match/normalize.ts`
- **변경**: 특수 매핑 dict + 한글 정규화 (여자대학교→여대, 대학교→대 등). 상단에 `// GAS normalizeName_ 1:1 port — 변경 시 fixture 동기` 주석
- **DoD**: T2 통과
- **의존**: T2
- **노트**: 

### T4: RED — similarity.test.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/__tests__/similarity.test.ts`
- **변경**: Levenshtein distance + `isNameMatchStrong_` (완전일치/포함 양방향, 최소 3자) 케이스
- **DoD**: vitest 실패
- **의존**: T3
- **노트**: 

### T5: GREEN — similarity.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/similarity.ts`
- **변경**: `similarity()` + `isNameMatchStrong()`. 입력 길이 cap 100자 가드
- **DoD**: T4 통과
- **의존**: T4
- **노트**: 

### T6: RED — collect.test.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/__tests__/collect.test.ts`
- **변경**: 거래처별 미수 미처리 수집 / 입금 미처리 수집 6 case
- **DoD**: vitest 실패
- **의존**: T1
- **노트**: 

### T7: GREEN — collect.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/collect.ts`
- **변경**: `collectUnpaidMisuByCustomer()` + `collectUnpaidDepositsByCustomer()`. matchedRows Set으로 중복 방지
- **DoD**: T6 통과
- **의존**: T6
- **노트**: 

### T8: RED — algorithm.test.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/__tests__/algorithm.test.ts`
- **변경**: 단건 1:1 → N:1 합산 → N:M 합산 우선순위 fixture 전수. mismatch (금액일치/이름불일치) detect 케이스
- **DoD**: vitest 실패
- **의존**: T5, T7
- **노트**: 

### T9: GREEN — algorithm.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/algorithm.ts`
- **변경**: `matchOneToOne` / `matchNToOne` / `matchNToMByCustomer` / `detectMismatches`. 메인 `runMatch(misuRows, depRows)` 디스패처 → `{ matched: MatchPair[], mismatches, errors }`. **순수 함수** (SharePoint 의존 0)
- **DoD**: 30+ fixture GREEN
- **의존**: T8
- **노트**: REFACTOR — 3 단계 디스패처 함수 분리

### T10: deposit-queries.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/deposit-queries.ts`
- **변경**: `fetchDepositSheet()` — `SHAREPOINT_DEPOSIT_ITEM_ID` 환경변수, 미설정 시 throw. `receivables/queries.ts` 패턴 복사
- **DoD**: env 누락 시 throw + 빈 시트 케이스 단위 테스트 1건
- **의존**: T1
- **노트**: 

### T11: patch.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/patch.ts`
- **변경**: `patchMatchResult(pair, { dryRun })` — 미수 K열 "입금완료" + J열 입금일 + 입금 K열 "처리완료". `MAIL_MATCH_DRY_RUN` 분기. **PATCH 전 K열 재read하여 "미처리" 확인** (K열 race 방어)
- **DoD**: dry-run mock 테스트 (fetch mock) 1건
- **의존**: T10
- **노트**: 

### T12: mismatch-mail.ts
- **상태**: pending
- **파일**: `src/features/receivables-match/mismatch-mail.ts`
- **변경**: `sendMismatchReport(mismatches)` — admin(ys1114@jinhakapply.com)으로 표 형식 HTML 메일. `sendGraphMail` wrap
- **DoD**: dry-run snapshot 테스트
- **의존**: T9
- **노트**: 

### T13: 이력 테이블 마이그
- **상태**: pending
- **파일**: `supabase/migrations/20260526c_receivables_match_runs.sql`
- **변경**: `receivables_match_runs` (id/started_at/finished_at/mode check(dry_run|live)/matched_count/mismatch_count/error_count/payload jsonb/notes/created_at) + RLS (select admin/member, insert service_role) + 인덱스 (started_at desc)
- **DoD**: supabase db push green, `pg_policies` 2건 + 인덱스
- **의존**: 없음
- **노트**: 

### T14: AutomationJob wrapper
- **상태**: pending
- **파일**: `src/features/automations/jobs/receivables-deposit-match.ts`
- **변경**: `runReceivablesDepositMatch()` — fetch 미수 시트 + deposit 시트 → algorithm.runMatch → patch loop (1초 throttle) → mismatch mail → `receivables_match_runs` insert → AutomationRunResult 반환
- **DoD**: 통합 dry-run 1회 수동 실행 (`node scripts/receivables-deposit-match.mjs` with dry-run env)
- **의존**: T9~T13
- **노트**: 

### T15: registry/queries + workflow yml + mjs
- **상태**: pending
- **파일**: `registry.ts` + `queries.ts` + `scripts/receivables-deposit-match.mjs` + `.github/workflows/receivables-deposit-match.yml`
- **변경**: 잡 등록 1줄 + LAST_RUN 매핑(receivables_match_runs.started_at) + mjs(POST trigger PR-1 패턴) + workflow yml(cron `0 * * * *` = 매시간)
- **DoD**: GH Actions UI에서 workflow_dispatch 수동 실행 200
- **의존**: T14
- **노트**: 

### T16: env 등록 안내 + .env.example
- **상태**: pending
- **파일**: `.env.example` (해당 항목 추가) + 사용자 안내 (Vercel + GH Secrets)
- **변경**: `SHAREPOINT_DEPOSIT_ITEM_ID` + `MAIL_MATCH_DRY_RUN=true` default
- **DoD**: settings/_env.ts head/tail preview에 노출
- **의존**: T10
- **노트**: 

### T17: /verify
- **상태**: pending
- **파일**: —
- **변경**: lint + typecheck + vitest + 통합 dry-run 1회 (자동화 메뉴 manual trigger → `status=dry_run` row 적재)
- **DoD**: 전부 green
- **의존**: all
- **노트**: 

## 리스크

| 리스크 | 완화 |
|---|---|
| K열 race (PR-3까지 GAS doGet 살아있음) | T11에서 PATCH 전 K열 재read → "미처리" 확인 후 write. dry-run 1주 우선 + PR-3 머지 시 GAS doGet 완전 폐기 |
| 포팅 회귀 (정규화 dict 누락) | T0 fixture 30+ + GAS 원본 코멘트 인용 (normalize.ts 상단) |
| `SHAREPOINT_DEPOSIT_ITEM_ID` 누락 | T10에서 startup throw, T16 .env.example + settings/_env.ts head/tail preview |
| Levenshtein 큰 문자열 O(n*m) | T5에서 입력 길이 cap 100자 (GAS 동일) |
| dry-run → live 첫 batch 폭주 | `MAIL_MATCH_DRY_RUN=false` 전환 직후 첫 수동 트리거 결과 확인 후 cron 활성 |
| chunk paging 미구현 부하 | 초기 전수 + 1초 throttle (현재 미수 ~100건 수준 안전), 100+ 증가 시 후속 PR |

## dry-run → live 게이트

1. PR-2 머지 + Supabase 마이그 apply
2. Vercel env: `MAIL_MATCH_DRY_RUN=true` + `SHAREPOINT_DEPOSIT_ITEM_ID` + `CRON_SECRET`
3. cron 1주 dry-run 운영 (매시간 24×7 = 168회)
4. `receivables_match_runs` 조회 → matched/mismatch 카운트 → **GAS 결과와 ≥ 95% 일치** 수동 확인
5. live 전환: `MAIL_MATCH_DRY_RUN=false` + GAS `autoMatchDeposits` 트리거 즉시 비활성
6. 1주 모니터링 → K열 race 0건 + 매칭 정확도 GAS 수준

## GAS autoMatchDeposits 비활성 절차 (PR-2 머지 시)

1. Google Apps Script 콘솔 접속
2. 트리거 메뉴 → `autoMatchDeposits` 트리거 삭제 (매시간 1개)
3. `createSingleAutoMatchTrigger()` 함수도 호출 안 되도록 코드 주석 또는 PR-4에서 일괄 회수
4. doGet Web App은 유지 (메일 속 입금완료 버튼 → PR-3에서 OPS-Console URL로 교체)

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-26T07:14:09+09:00 | — | plan 생성 | brainstorm spec 기반 |
| 2026-05-26T07:27:53+09:00 | T0~T9 | pending → done | fixture 47 + pure function 4 모듈 GREEN |
| 2026-05-26T07:35:48+09:00 | T10~T16 | pending → done | deposit fetch + patch + mismatch-mail + 마이그 + job + registry + workflow yml |
| — | T17 (사용자) | pending | 마이그 apply + secrets + dry-run/실 매칭 검증 |
