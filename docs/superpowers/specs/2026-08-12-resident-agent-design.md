# 상주 에이전트 — 무엇부터, 어떻게 보고, 어떻게 구성하나

**질문**: 이 시스템에 상주 에이전트를 적용한다면 무엇부터 하고, 그것이 무엇을 하고 있는지 어떻게 보고, 어떤 구조로 올리는가.
**날짜**: 2026-08-12 / 코드 변경 0줄

> ⚠️ **용어 주의 — 이 문서는 본류가 아니다.**
>
> 여기서 "상주 에이전트"는 **cron으로 도는 백그라운드 감시자**를 말한다. 사람이 묻지 않아도 스스로 돌며 자동화 실행 결과를 판단하는 물건이다.
>
> **운영자가 "내 미수채권 있어?"라고 물으면 답하고 대신 실행하는 에이전트는 이 문서가 아니라 `2026-08-10-assistant-system-agent-design.md`다.** 그쪽이 본류이고, 두 문서는 다른 물건을 다룬다.
>
> 두 트랙이 공유하는 지식층: `2026-08-12-knowledge-system-design.md`

---

## 0. 출발점을 다시 잡는다

"상주 에이전트를 적용한다"는 말은 보통 *없던 것을 새로 올린다*는 뜻으로 들린다. **이 레포에서는 아니다.**

| 상주 시스템의 구성요소 | 이 레포의 현재 |
|---|---|
| 계속 도는 실행기 | ✅ 잡 **17개** (`automations/registry.ts`), Vercel cron + cron-job.org + 회사 PC 폴러 |
| 실행 이력 | ✅ `automation_runs` (`job_id, ran_at, ok, skipped, message, duration_ms`) |
| 실패 감지 + 통보 | ✅ `failure-notify.ts` → Teams 즉시 |
| 미실행 감지 | ✅ `digest.ts` — `cadence`별 임계로 "안 돈 잡"까지 잡음 |
| 멱등·중복 방지 | ✅ `claim_due_backup_requests` 원자적 선점 |
| LLM 판단 | △ **3곳뿐** — `ratio-audit`(로컬 `claude -p`), `team-briefing`(스토리 생성), `mailbox-ingest`(초안) |
| 에이전트 단위 관측 | ❌ **없음** — 무엇을 보고 그렇게 판단했는지 아무 데도 안 남는다 |
| 토큰·비용 추적 | ❌ **없음** |

**그래서 이 작업의 실체는 "상주를 만드는 것"이 아니라 "이미 상주하는 것에 판단을 얹고, 그 판단을 볼 수 있게 만드는 것"이다.** 이 재정의가 이후 모든 결정을 바꾼다 — 새 플랫폼을 도입할 이유가 사라지고, 관측이 1순위로 올라온다.

---

## 1. 무엇부터 — `automation-digest`를 판단하는 에이전트로

### 왜 하나만 고르나

업계에서 반복 확인된 배포 원칙: **"one workflow, one channel, one reviewer for the first two weeks, then expand."** 한 번에 다섯 개를 올린 팀은 다음 한 달을 문제 추적에 쓰고 **조직의 신뢰를 잃는다.** 상주 에이전트는 사람이 안 볼 때 도는 물건이라, 신뢰를 잃으면 다시 켜지지 않는다.

### 고르는 기준 세 개

| 기준 | 이유 |
|---|---|
| **A. 틀려도 되돌릴 수 있는가** | 첫 대상은 반드시 읽기 전용. 판단 정확도를 모르는 채로 부작용을 허용하지 않는다 |
| **B. 데이터가 이미 있는가** | 새 수집 파이프라인을 같이 만들면 무엇이 실패했는지 못 가린다 |
| **C. 매일 자연스럽게 검증되는가** | 사람이 안 보는 판단은 틀린 채로 굳는다. 검증이 일과에 섞여 있어야 한다 |

### 후보 대조

| 후보 | A 가역 | B 데이터 | C 검증 | 판정 |
|---|---|---|---|---|
| **`automation-digest`** | ✅ 읽기만 | ✅ `automation_runs` 그대로 | ✅ 매일 11:00 본인이 읽음 | **← 첫 대상** |
| `ratio-audit` | ⚠️ 담당자에게 오알림 | ✅ | △ | 이미 `claude -p` 판정을 쓰지만 **Selenium + Moa 로그인 + 회사 PC** 의존이라 표면이 너무 넓다. 코드 주석에도 "판정 정확도가 안정되기 전까지 사람이 버튼을 누른다"고 적혀 있다 |
| `receivables-deposit-match` | ❌ 시트 PATCH, 비가역 | ✅ | ❌ | 매시간 + 돈. 첫 대상으로 부적합 |
| 어시스턴트(설계 완료분) | — | — | — | **상주가 아니다.** 물어봐야 답한다. 별개 트랙 |

### 지금의 digest와 무엇이 달라지나

현재 `digest.ts`는 규칙 기반 나열이다 — 성공 n건 / 실패 n건 / 미실행 n건. 사람이 그걸 읽고 **"이게 심각한가"를 매번 스스로 판단**한다.

에이전트가 하면:

> 입금 매칭이 **3일째 같은 지점**에서 실패하고 있습니다. 메시지가 매번 `504 MaxRequestDurationExceeded`로 동일한데, 이건 워크북 세션 만료 패턴입니다.
> 나머지 16개 잡은 정상입니다. **오늘 사람이 볼 것은 이 하나입니다.**

차이는 요약이 아니라 **분류**다 — 17줄 중 사람이 볼 1줄을 골라주는 것. 이게 상주 에이전트가 실제로 주는 가치이고, 아래 §3의 알림 예산 문제와 정확히 맞물린다.

### 하지 말 것

- digest 에이전트에게 **잡을 재실행할 권한을 주지 않는다.** 첫 2주는 읽고 말하는 것만
- 새 알림 채널을 만들지 않는다 (§3)
- 같은 PR에서 두 번째 잡으로 확장하지 않는다

---

## 2. 로그로 무엇을 보나 — OTel GenAI 규약을 우리 크기로

### 지금 무엇이 안 보이나

`automation_runs`는 `{ok, skipped, message, duration_ms}` — **잡이 돌았는가**만 안다. 에이전트가 되면 알아야 할 게 셋 더 생긴다:

1. **무엇을 보고 판단했나** (입력)
2. **어떻게 판단했나** (모델·추론·도구 호출)
3. **얼마를 썼나** (토큰·비용)

셋 다 지금 없다. 그리고 **에이전트를 올린 뒤에 붙이면 늦다** — 판단이 틀렸을 때 되짚을 근거가 없으면 "왜 틀렸는지 모르지만 껐다"로 끝난다.

> 업계 수치가 이 위험을 뒷받침한다 — 조직의 **47.1%만** 에이전트를 모니터링하고, **21.9%만** 에이전트를 별개 엔티티로 취급한다. 대부분이 관측 없이 올린다.

### 표준을 따른다 — OpenTelemetry GenAI Semantic Conventions

에이전트 관측은 2026년에 표준이 정해졌다. 자체 포맷을 발명하지 않는다.

**스팬 계층** (3종):

```
invoke_agent            ← 에이전트 1회 실행
├─ chat                 ← LLM 호출 (재시도·연속 호출마다 1개)
└─ execute_tool         ← 도구 호출
```

**속성** (메타데이터 — 항상 기록):

| 속성 | 내용 |
|---|---|
| `gen_ai.request.model` | 어느 모델 |
| `gen_ai.usage.input_tokens` / `output_tokens` | 토큰 |
| `gen_ai.response.finish_reasons` | 왜 멈췄나 (`stop` / `tool_calls` / `refusal`) |

**내용** (`gen_ai.system_instructions` · `gen_ai.input.messages` · `gen_ai.output.messages`): 표준은 **기본 off, 명시적 opt-in**이다. 프라이버시 때문이다. 우리도 그대로 간다 — 운영 데이터(미수 금액·연락처·인수인계 메모)가 프롬프트에 들어가므로 기본으로 저장하면 안 된다.

### 우리 스키마 — `agent_traces` 신설

`automation_runs`에 컬럼을 붙이지 않는다. 잡 1회 실행에 스팬이 **여러 개** 달리므로 1:N이고, 컬럼으로 욱여넣으면 나무 구조를 잃는다. (`receivables_match_runs`가 jsonb payload를 쓰는 선례가 있지만, 그건 결과 저장이고 이건 실행 추적이다.)

```sql
create table public.agent_traces (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid references public.automation_runs(id) on delete cascade,
  parent_id    uuid references public.agent_traces(id) on delete cascade,
  kind         text not null check (kind in ('invoke_agent','chat','execute_tool')),
  name         text not null,          -- 잡 id / 도구 이름
  started_at   timestamptz not null,
  ended_at     timestamptz,
  model        text,
  input_tokens  integer,
  output_tokens integer,
  finish_reason text,
  content      jsonb,                  -- 기본 null — opt-in일 때만 채운다
  error        text
);
```

**이걸로 할 수 있는 것**:
- 자동화 페이지에서 **"지금 이 잡이 무엇을 하고 있나"를 나무로 렌더** — `invoke_agent` 아래 `chat`/`execute_tool`
- **잡별 일일 토큰·원가** — 상주 에이전트는 아무도 안 볼 때 돈을 쓴다. 이게 없으면 청구서로 처음 안다
- **판단이 틀렸을 때 되짚기** — `content` opt-in을 켜서 그 실행만 재현

**보존**: 상주 에이전트는 트레이스를 빠르게 쌓는다. 90일 초과분 삭제를 처음부터 넣는다 — 나중에 붙이면 이미 커져 있다.

### 먼저 계기부터 단다 — 에이전트보다 앞선다

**0단계는 에이전트를 만들지 않는다.** 이미 LLM을 쓰는 **3곳**(`ratio-audit` · `team-briefing` · `mailbox-ingest`)에 트레이스 기록만 붙인다.

이유가 셋이다:
1. **에이전트를 올리기 전에 화면이 이미 돌아간다** — 첫 에이전트의 첫 실행부터 볼 수 있다
2. **지금 그 3곳이 토큰을 얼마 쓰는지 아무도 모른다** — 기준선이 생긴다
3. **계기 자체를 검증한다** — 에이전트와 관측을 동시에 올리면 이상할 때 어느 쪽이 문제인지 못 가린다

---

## 3. 알림 설계 — 여기가 가장 위험하고, 이 레포는 이미 절반을 안다

### 감독에는 용량이 있다 (역U자)

2026년 연구 결과가 직관을 뒤집는다: **에스컬레이션을 늘릴수록 안전이 오르는 게 아니다.** 사람의 검토 신뢰도는 부하가 용량을 넘으면 무너지고, 안전은 **역U자**를 그린다.

- 검토 용량이 25건일 때 **안전 최적 에스컬레이션 비율은 64%** — 100%가 아니다
- 전부 올리면 위험 통과율이 **42% → 57%로 나빠진다**
- 알림이 많으면 사람은 **고무도장**이 된다

> ⚠️ 이 수치는 가정된 피로 곡선을 쓴 **시뮬레이션**이고 실제 인간 연구가 아니다(논문이 스스로 밝힌 한계). 숫자를 그대로 우리 임계로 옮기지 않는다. **가져올 것은 방향**이다 — "다 올리는 게 안전하다"가 틀렸다는 것.

### 이 레포는 이미 손으로 발견했다

`failure-notify.ts` 주석:

> *소음 억제가 핵심이다. 입금 매칭은 매시간 돌아서, 장애가 하루 이어지면 같은 실패로 24통이 온다. 그래서 **직전 실행도 실패였으면 다시 보내지 않는다** — 첫 실패만 알리고, 지속 중인 장애는 일일 보고가 매일 상기시킨다.*

같은 문제를, 같은 결론으로, 먼저 풀어놨다. **상주 에이전트를 올리면 이 문제가 몇 배가 된다** — 판단이 붙으면 할 말이 많아지기 때문이다.

### 규칙 셋

1. **새 알림 채널을 만들지 않는다.** 기존 두 경로(실패 즉시 / 일일 다이제스트)에만 얹는다. 에이전트 전용 채널은 곧 아무도 안 보는 채널이 된다
2. **에이전트가 "사람이 봐야 한다"고 판정한 건수에 일일 상한을 둔다.** 초과분은 즉시 알림이 아니라 다이제스트로 밀린다. 상한은 설정값으로 두고 관측 결과를 보고 조정한다
3. **에이전트는 조용할 수 있어야 한다.** "오늘 볼 것 없음"이 정상 출력이다. 억지로 할 말을 만들면 그게 노이즈다 — 어시스턴트 설계의 `nextSteps` 빈 배열 문제와 같은 함정이고, 프롬프트로 강하게 걸어야 한다

---

## 4. 어디서 도나 — 세 선택지

| # | 방식 | 얻는 것 | 비용 |
|---|---|---|---|
| **A** | **기존 구조 그대로** — cron → `/api/automations/run` → 서버에서 Claude API **1회 호출** | 새 인프라 0. 기존 가드·이력·보고 전부 재사용 | 도구 루프 없음 |
| B | **Managed Agents scheduled deployment** — Anthropic이 루프·샌드박스·스케줄을 호스팅 | 세션 컨테이너, 이벤트 스트림, 메모리 스토어, 재시도 | 새 플랫폼. 계정·자격·관측이 우리 밖으로 나감 |
| C | **회사 PC 폴러** (`ratio-audit`·`closing-scrape` 방식) | 사내망·Selenium 접근 | 회사 PC가 꺼지면 멈춤 |

### 권장 — A

**digest 에이전트는 탐색할 게 없다.** 서버가 `automation_runs`를 다 읽어서 넘기고 판단만 받으면 된다. 단일 호출이면 충분하고, 도구 루프는 비용과 비결정성만 늘린다.

이건 어시스턴트 설계에서 이미 내린 결론과 **같은 판단**이다 — *"1.5단계까지는 에이전트가 아니라 워크플로다."* 두 트랙이 같은 원칙 위에 선다.

**B로 갈 조건**(미리 적어둔다): 에이전트가 **여러 소스를 오가며 스스로 파고들어야** 할 때. 예 — "입금 매칭이 왜 실패했나"를 답하려고 시트를 직접 열고, 로그를 뒤지고, 이전 실행과 대조하는 수준. 그때 재검토한다. **C**는 사내망 자원이 필요한 잡에만.

---

## 5. 단계

### 0단계 — 계기부터 (에이전트 없음)
`agent_traces` 테이블 + 기존 LLM 3곳에 트레이스 기록 + 자동화 페이지에 나무 렌더 + 일일 토큰 집계.
- **완료 조건**: 어제 `team-briefing`이 토큰을 얼마 썼는지 화면에서 답할 수 있다
- **하지 말 것**: 에이전트 만들기. `content` 기본 저장(opt-in만)

### 1단계 — digest 에이전트 (읽기 전용)
`automation-digest`가 규칙 나열 대신 판단한다. 트레이스는 0단계 계기에 자동으로 잡힌다.
- **완료 조건**: 2주간 매일 돌고, **"오늘 볼 것 없음"이 실제로 나온 날이 있다.** 한 번도 조용하지 않았다면 실패다 — 노이즈 생성기를 만든 것
- **하지 말 것**: 잡 재실행 권한. 새 알림 채널

### 2단계 — 알림 예산
일일 상한 + 초과분 다이제스트 강등. 1단계 2주 관측치로 상한을 정한다(추측하지 않는다).
- **완료 조건**: 상한이 실제로 걸린 날에 밀린 항목이 다이제스트에서 보인다

### 3단계 (조건부) — 두 번째 잡
1단계가 2주를 버틴 뒤에만. 대상은 그때 관측 데이터로 고른다.

---

## 6. 가장 싼 첫 실험 — 코드 0줄

**실험 C — digest 에이전트가 실제로 유용한 판단을 하는가 (1시간)**

- **무엇을**: 최근 7일 `automation_runs`를 그대로 뽑아 손으로 Claude에 넣고, "오늘 사람이 볼 것 하나만 고르라"고 시킨다. 7일 = 7회 판정.
- **성공 판정**: 7일 중 **5일 이상**에서 사람이 보기에 옳은 선택을 한다. 그리고 **아무 문제 없던 날에는 조용하다.**
- **실패 시 접는 것**: 5일 미만이면 판단 계층을 접고 **0단계(관측)만** 한다. 관측은 그 자체로 값어치가 있다 — 지금 토큰을 얼마 쓰는지 아무도 모른다.

이 실험이 §1의 선택(왜 digest인가)과 §3의 규칙 3(조용할 수 있는가)을 **동시에** 반증한다.

---

## 7. 열린 질문

1. **Claude 호출 경로** — 서버에서 API 키로 부를 것인지, `ratio-audit`처럼 로컬 `claude -p`인지. 어시스턴트 설계의 같은 질문과 **한 번에 답해야 한다**(두 트랙이 같은 경로를 쓴다). [확인 필요]
2. **`agent_traces` 보존 90일이 맞나** — 잡 17개 × 일일 실행이면 증가 속도를 실측해야 안다
3. **`content` opt-in을 누가 켜나** — admin 토글인지, 환경변수인지, 특정 잡만인지. 운영 데이터가 담기므로 권한 경계가 필요하다
4. **일일 상한 초기값** — 1단계 관측 전에는 정하지 않는다(추측 금지). 다만 관측 없이 시작해야 한다면 몇으로 둘지
5. **digest 판단이 틀렸을 때 사람이 되먹이는 경로가 있나** — 없으면 같은 오판이 반복된다. 2단계에서 필요할 수 있다

---

## 출처

- [Always-On AI Agent: What 24x7 Actually Means in 2026 — MoClaw](https://moclaw.ai/blog/always-on-ai-agent-2026) — 배포 원칙(one workflow, one channel, one reviewer), 상주 에이전트 구성요소
- [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/) — 스팬 계층·속성·내용 opt-in
- [OpenTelemetry for AI Agents: Observability, Tracing, and the GenAI Semantic Conventions — Zylos](https://zylos.ai/research/2026-02-28-opentelemetry-ai-agent-observability/)
- [Oversight Has a Capacity: Calibrating Agent Guards to a Subjective, Fatiguing Human (arXiv 2606.08919)](https://arxiv.org/html/2606.08919v1) — 역U자, 검토 용량, 고무도장
- [AI Agent Monitoring: Best Practices, Tools & Metrics for 2026 — UptimeRobot](https://uptimerobot.com/knowledge-hub/monitoring/ai-agent-monitoring-best-practices-tools-and-metrics/) — 모니터링 채택률 47.1% / 21.9%
- [Building Production-Ready AI Agents in 2026 — MLflow](https://mlflow.org/articles/building-production-ready-ai-agents-in-2026/)
- 스킬 내장 레퍼런스: `claude-api/shared/agent-design.md`, `shared/managed-agents-scheduled-deployments.md`, `shared/managed-agents-overview.md`
