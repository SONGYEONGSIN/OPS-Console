# Brainstorm: PR-2 입금 매칭 자동화 (GAS autoMatchDeposits → OPS-Console)

## 의도

- **산출물**:
  - GAS 매칭 알고리즘 7 함수 TypeScript 1:1 포팅 — `normalizeName_` · `similarity_` · `isNameMatchStrong_` · `collectUnpaidMisuByCustomer_` · `collectUnpaidDepositsByCustomer_` · `matchNM_` · `sumAmounts_` · `notifyAmountMismatch_`
  - SharePoint 입금내역 시트 (`SHAREPOINT_DEPOSIT_*`) fetch
  - 단건 / N:1 합산 / N:M 합산 3단계 순차 매칭 (GAS 동일 우선순위)
  - 매칭 성공 시 미수채권 시트 K열(적요)="입금완료" + J열(입금예정일) PATCH + 입금내역 시트 K열(미결제표시)="처리완료" PATCH
  - 금액일치/이름불일치 케이스 → admin 알림 메일 (`notifyAmountMismatch_` 대응)
  - automation job `receivables-deposit-match` 등록 — 매시간 cron + 자동화 메뉴 수동 트리거
  - run 이력 테이블 `receivables_match_runs` — matched_count / mismatch_count / errors / started_at / finished_at
- **사용자**:
  - 운영부 admin (자동화 메뉴에서 매시간 잡 결과 확인 + 수동 트리거)
  - 시스템 (매시간 cron)
- **트리거 (왜 지금)**: PR-1과 동일 — OPS-Console 단일 도구 통합. PR-1 머지 후 PR-2 즉시 진행하여 GAS 의존성 빠르게 축소
- **성공 기준**:
  - 매칭 정확도 GAS 대비 동등 이상 (mismatch 알림 빈도 ≤ GAS의 `notifyAmountMismatch_`)
  - dry-run 1주 운영 후 GAS 결과와 매칭 cases ≥ 95% 일치 (수동 비교)
  - 매시간 cron 실패 0건 (24시간 × 1주 모니터링)
  - K열 race 0건 (PR-3 전까지 GAS doGet 사용 시각 모니터링 — 우려 사항)

## 제약

### 기술
- **Microsoft Graph PATCH**: cell range 단위 (`/range(address='K5:K5')`). chunk 처리 시 throttle 안전 (1초 sleep 그룹 사이)
- **deposit Excel item ID**: 새 환경변수 `SHAREPOINT_DEPOSIT_ITEM_ID` 필요 (운영팀과 조율)
- **chunk paging state**: GAS는 Script Properties로 `AUTO_MATCH_START_INDEX` 저장 후 hourly 30개씩 처리. OPS-Console은 Supabase `automation_state` 테이블 또는 in-memory + reset
- **dry-run 기본값**: `MAIL_MATCH_DRY_RUN=true` default (PR-1 패턴과 일치). PATCH 호출 skip + log만
- **이력 테이블**: GAS는 이력 없음 (logger만). OPS-Console은 일관성 위해 `receivables_match_runs` 신규
- **timezone**: cron KST 기준 (insights-fetch · receivables-mail-operator 동일 패턴)

### 비즈니스
- **K열 race**: PR-2 머지 시 GAS `autoMatchDeposits` 트리거만 비활성. doGet Web App(수동 입금완료 버튼)은 PR-3까지 유지 → 자동 매칭은 OPS-Console만 / 수동 입금완료는 GAS 남음. **race 가능성 낮지만 존재** — 운영자가 GAS 메일 속 버튼 클릭 직전에 OPS-Console cron 실행되어 같은 행을 동시 PATCH 시 last-write-wins
- **포팅 회귀 위험**: GAS 알고리즘 복잡 (정규화 dictionary 30+ · Levenshtein · N:M 합산). 테스트 케이스 ≥ 30 개로 보호
- **마이그레이션 기간 메일 발송 영향**: 매칭이 자동 K열을 "입금완료"로 채우면 PR-1 운영자 알림 메일이 그 행을 제외. PR-1 + PR-2가 함께 운영되면 자연 일관성

### 코드베이스
- ✅ **이미 있는 인프라**:
  - `automations` registry / API route (`/api/automations/run`) — PR-1에서 신설
  - `receivables/queries.ts` — SharePoint fetch + `columnLetter` util
  - `lib/microsoft/sendmail` — admin 알림 메일 발송
- ❌ **신규**:
  - matcher 모듈 4개 (`normalize`/`similarity`/`collect`/`algorithm`)
  - `deposit-queries.ts` — 입금내역 시트 fetch
  - `mismatch-mail.ts` — admin 알림 메일
  - `jobs/receivables-deposit-match.ts` — automation job
  - 이력 테이블 마이그 2개 (table + RLS)
  - workflow yml + mjs trigger

## 대안 비교

| 항목 | A. 단일 PR (GAS 1:1) | B. 단계 분할 (3 PR) | C. dry-run + 실 매칭 분리 | Z. do nothing |
|------|---------------------|--------------------|------------------------|--------------|
| 비용 | 1주, ~16 files | 1.5주, PR 3개 | 1주 + 후속 PR | 0 |
| 위험 | 포팅 회귀 (test로 보호) | 알고리즘 단독 PR 운영 가치 없음 | dry-run 분리는 결국 후속 작업 | GAS 토큰 관리 부담 지속 |
| 가역성 | PR revert로 GAS 활성 | 단계별 revert | 환경변수 토글 | — |
| 학습 효과 | GAS 알고리즘 완전 이해 | 점진적 | GAS vs OPS 비교 데이터 | 0 |
| GAS 충돌 제어 | autoMatchDeposits 비활성 + doGet 유지 (race ↓) | 동일 | 동일 | — |

## 추천 + 근거

### 추천: **대안 A — 단일 PR, GAS 1:1 + dry-run 기본 모드**

**선택 근거**:
1. **사용자 명시적 선택** — 매칭 알고리즘 정책 Q1에서 "GAS 코드 1:1 포팅"으로 응답
2. **PR-1 패턴 재사용** — automation registry / API route / workflow yml / dry-run env 패턴 그대로. 신설 인프라 없음
3. **회귀 보호 가능** — 7 함수 모두 pure function (시트 입력 → 매칭 결과) → 단위 테스트로 GAS 입력/출력 케이스 ≥ 30개 커버
4. **dry-run 기본값**으로 머지 후 1주 운영하며 GAS 결과와 비교 후 실 적용 → 단계 분할 효과를 환경변수로 달성

### 기각된 대안

**B. 단계 분할**: 매칭 알고리즘만 PR-1로 머지하면 운영 가치 없음 (use 안 됨). dead code 위험. PR overhead 큼

**C. dry-run + 실 매칭 분리**: 환경변수 토글로 동등한 효과 달성 가능. 별도 PR 분리는 overhead만 추가

**Z. do nothing**: 사용자 의도("OPS-Console 단일 통합")와 정면 배치. GAS refresh token 만료/시트 권한 변경 시 매칭 끊김 위험

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260526-070922-receivables-deposit-match.md`
- 변경 규모 ~16 files → **HARD-GATE 간략 등급** → `/plan` 권장 (planner 에이전트 분석)
- 권장 후속: **`/plan from-brainstorm 20260526-070922-receivables-deposit-match.md`**
- T11/T12 (사용자 검증) 단계:
  - dry-run 1주 운영 → GAS와 결과 비교 (수동 30 case 샘플링)
  - 매칭 정확도 ≥ 95% 확인 후 `MAIL_MATCH_DRY_RUN=false` 전환
  - GAS `autoMatchDeposits` 트리거 즉시 비활성 (PR-2 머지 직후)
