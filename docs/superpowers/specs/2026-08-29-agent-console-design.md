# 에이전트 콘솔 — 정적 조직도에서 운영 주체로

작성 2026-08-29 · 상태: Phase 0 착수

## 1. 무엇이 문제인가

`/dashboard/agents` 는 **DB를 한 건도 읽지 않는다.** `features/agent-org/registry.ts` 에
팀 5개·팀원 23명이 하드코딩된 정적 조직도이고, 자동화 잡의 라벨만 빌려 쓴다. 상태·시각·
성공 여부가 없다. 원래 설계 문서(`2026-08-13-agent-org-design.md` §6)가 현황 탭과 딥링크를
"`agent_traces` 테이블이 없어서" 의도적으로 v1에서 뺐다고 적어 두었다.

요청은 셋이다 — (1) 팀 묶음이 아니라 **시스템을 운영하는 독립 주체**로 재구성, (2) 에이전트별
**실시간 작동 로그 + 회사 PC 연결**, (3) 에이전트별 **사용량(일·주·월)**.

**핵심 판단: (2)와 (3)은 화면 문제가 아니라 기록 문제다.** 지금 화면부터 만들면 빈 화면이 나온다.

## 2. 지금 있는 것 / 없는 것

### 있는 것 (그대로 쓴다)

| 재료 | 위치 | 쓸 곳 |
|---|---|---|
| 회사 PC 심박 6종 | `poller_heartbeats` + `features/system-status/pollers.ts` | 연결 상태 |
| 생사 판정 (큐 나이 → 심박 순) | `system-status/verdict.ts` `judgePoller()` | 연결 상태 |
| 잡별 실행 이력 | `automation_runs(job_id, ran_at, ok, skipped, duration_ms)` | 사용량 |
| 어시스턴트 요청 이력 | `assistant_requests` — requested/claimed/finished + `stage`·`stage_at` | 사용량·로그 |
| 폴러 큐 5종 | `*_requests` / `entertest_test_runs` — 전부 `requested_by` + 3 타임스탬프 | 사용량·로그 |
| KST 기간 유틸 | `reports/queries.ts`(주 시작·기간·직전 기간), `automations/today-runs.ts`(일 경계) | 일·주·월 집계 |
| 개수 전용 쿼리 | `reports/queries.ts` `countTable()` (`head:true`) | 사용량 |

### 없는 것 (만들어야 함)

1. **에이전트 ↔ 폴러/잡 매핑** — `agent-org` 의 `ratio-auditor` 와 `POLLERS.id` 의 `ratio-audit` 이
   별개 네임스페이스다. 매핑 없이는 에이전트에 상태를 못 붙인다.
2. **토큰·비용** — 전 78개 테이블에 컬럼이 하나도 없다. 다만 **폴러가 이미 SDK에서 받아 버리고
   있다**(`scripts/assistant/serve-local.mjs` 의 result 처리가 `m.result` 만 꺼낸다).
3. **트리거 주체** — `recordAutomationRun(jobId, outcome)` 가 actor 를 안 받아 cron 과 수동 실행이
   원리적으로 구분 불가.
4. **`.claude/agents/` 서브에이전트 호출 기록** — 0건. `.claude/` 는 gitignore 라 Vercel 이 못 읽는다.

## 3. 구조적 제약

- **서버가 회사 PC 를 찔러볼 수 없다** (아웃바운드 전용). 실시간은 반드시 *폴러 → 서버 push*.
- 선례가 이미 있다 — 어시스턴트 폴러가 도구 호출마다 `stage` 를 갱신하고 화면이 2초 폴링한다.
  **문장은 서버가 만든다**(`stage-label.ts`). 표현을 고칠 때 회사 PC 를 안 만지기 위해서다.
- `poller_heartbeats` PK 가 `poller_id` 단독이라 **회사 PC 가 둘이 되면 서로 덮어쓴다.**

## 4. 단계

### Phase 0 — 기록 (이번)

화면은 그대로 두고 **데이터가 쌓이기 시작하게** 한다.

- **0a 매핑**: `AgentMember` 에 `pollerId?` 를 붙이고, 에이전트 → 폴러/잡 조회를 순수 함수로.
  테스트가 오타·미실재를 잡는다(기존 registry 테스트와 같은 방식).
- **0b 활동 피드**: 큐 5종 + `automation_runs` + `assistant_requests` 를 **에이전트 단위로 접어**
  최근 활동으로 돌려주는 쿼리. **새 테이블 없이** 오늘 당장 값이 나온다.
- **0c 사용량 집계**: 같은 출처를 일·주·월로 접는다. KST 경계는 `lt(익일 00:00)` 로 통일한다
  (리포트 쪽 `lte(23:59:59)` 와 섞이면 반올림 유실이 생긴다).
- **0d 토큰·비용**: `assistant_requests` 에 `input_tokens/output_tokens/cost_usd/num_turns/model`
  추가 + 폴러가 `usage` 를 실어 보내고 라우트가 저장. **회사 PC 폴러 갱신이 필요하다.**

### Phase 1 — 화면

에이전트별 상세 — 맡은 일 / 회사 PC 연결 / 최근 활동 / 사용량 추이. 팀 카드는 유지하되
카드가 **살아 있는 상태**를 보여주고, 클릭하면 그 에이전트로 들어간다.

### Phase 2 — 성과 리포트 에이전트

운영자 개인별 목표 기반 리포트(주간·월별), 학년도 2026-03-01 ~ 2027-02-28.

- 골격은 있다 — `features/performance/aggregators/` 레지스트리·점수·인쇄본, `academicYearRangeKST()`.
- **목표를 담을 자리가 없다**: `performance_metrics.target_value` 없음, 조직/본부 목표 테이블 없음,
  `performance_cycles` 에 기간 컬럼 없음(연도 하드코딩). → 화면에서 한 건씩 입력받는다(결정).
- **귀속 불가 2갈래를 연다**(결정):
  - 합격자발표 — `announcement_services` 에 운영자 컬럼 추가. 값은 **총괄장의 PIMS 배정**에서
    온다(`features/assignments/queries.ts` 가 이미 대학×서비스 → 운영자를 읽는다).
    합격자발표를 원서접수와 **별도 관리**하고, 지난 과거분은 **완료로 가정**한다.
  - 원서접수 세팅(WA/WB/PA/PB) — `dev_control_analyses.flags[].checked` 에 누가·언제가 없다.
    점검 이력 테이블을 새로 두어 **앞으로 쌓는다**.
- 리스크: `closing_services` 는 append-only 스냅샷이라 **최초 적재 후 담당자 변경이 반영되지
  않는다.** 1년치 성과의 분모가 틀어질 수 있어 Phase 2 착수 전 확인이 필요하다.

## 5. 이번에 하지 않는 것

- `.claude/` 서브에이전트 사용량 — 기록 자체가 없고, 남기려면 훅 + 서버 push 경로가 따로 필요하다.
- `poller_heartbeats` 이력화(가동률) — 지금은 마지막 심박만. 회사 PC 가 둘이 될 때 같이 푼다.
- 진짜 단계별 스트리밍 로그 — 0b 의 파생 피드로 먼저 채우고, 부족하면 그때 폴러 push 를 넓힌다.
