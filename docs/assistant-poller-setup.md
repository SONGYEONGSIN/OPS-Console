# 어시스턴트 Claude 모드 — 회사 PC 셋업

어시스턴트의 기본 모드는 **회사 PC에서 도는 폴러**가 답을 만든다. 이 문서는 그 폴러를 회사 PC에 올리는 절차다.

> **왜 회사 PC인가**: Claude 구독(OAuth)은 로그인한 그 PC에만 있어 Vercel에서 쓸 수 없다. 그래서 웹은 질문을 큐(`assistant_requests`)에 쌓기만 하고, 이 폴러가 2초마다 가져가 볼트를 읽혀 답을 되돌려 적는다. 경쟁률 점검·개발탭 분석과 같은 구조이며, 다른 점은 **채팅이라 5분 간격이 아니라 상주**라는 것뿐이다.

---

## 0. 셋업 전 상태 (정상이다)

폴러가 없으면 어시스턴트에 질문했을 때 **15초 뒤 "에이전트를 계속 부르는 중 — 아직 응답이 없는 것 같아요"** 가 뜬다. 고장이 아니라 *아무도 큐를 가져가지 않는 상태*다.

**화면은 거기서 멈추지 않고 3분까지 기다린다.** 폴러를 늦게 켜도 그 안이면 답이 그대로 온다. 대신 다른 갈래는 없다 — 빠른 답변(Gemini)은 걷어냈다.

---

## 1. 사전 확인 (3가지)

### 1-1. Claude 로그인

```powershell
claude -p "hi"
```

답이 나오면 된다. `Failed to authenticate` / `OAuth session expired`가 나오면 `claude` 를 실행해 로그인부터 한다. **이 PC의 구독 세션이 곧 어시스턴트의 엔진**이다.

### 1-2. 볼트 동기 폴더

SharePoint `운영부/17. 업무 지식망`이 OneDrive로 동기돼 있어야 한다. 탐색기에서 실제 경로를 확인한다. 대략 이런 모양이다:

```
C:\Users\<사용자>\<회사 OneDrive>\<사업본부> - 17. 업무 지식망
```

그 폴더 안에 `개념 / 플레이북 / 규칙 / 결정 / 오류사례 / 엔티티 / 프로젝트 / 제안 / _templates` 이 보이면 맞다.

### 1-3. Node.js

```powershell
& "C:\Program Files\nodejs\node.exe" -v
```

다른 경로에 있으면 3단계의 등록 스크립트에서 `$node` 값을 그 경로로 고친다.

---

## 2. 설치 (3단계)

### 2-1. `.env.local`에 값 두 개 추가

레포 루트 `.env.local`에 아래 두 줄을 더한다. **경로에 공백이 있어도 따옴표를 붙이지 않는다**(dotenv가 그대로 읽는다).

```
OPS_CONSOLE_BASE_URL=https://ops-console-psi.vercel.app
KNOWLEDGE_VAULT_PATH=C:\Users\<사용자>\<회사 OneDrive>\<사업본부> - 17. 업무 지식망
```

`CRON_SECRET`은 이미 들어 있다(다른 폴러가 쓰고 있다). **없으면 Vercel 환경변수와 같은 값**을 넣어야 한다 — 다르면 3-2의 확인에서 401이 난다.

### 2-2. 의존성 설치

```powershell
cd <레포 경로>
npm ci
```

Agent SDK(`@anthropic-ai/claude-agent-sdk`)는 devDependency라 `npm ci --omit=dev` 로 설치하면 **빠진다.** 그냥 `npm ci`로 받는다.

### 2-3. 작업 등록 (관리자 PowerShell)

```powershell
cd <레포 경로>
powershell -ExecutionPolicy Bypass -File scripts\assistant\register-serve-task.ps1
```

**로그온 시 자동 시작 + 죽으면 1분 뒤 재시작**으로 등록된다. 다른 폴러(5분 간격 단발)와 달리 실행 시간 제한이 없다 — 상주 프로세스라 기본 3일 제한에 걸리면 채팅이 멈춘다.

---

## 3. 확인

### 3-1. 프로세스가 살아 있나

작업 스케줄러에서 **`OPS-Console 어시스턴트 폴러`** 가 *실행 중*이면 된다.

**로그는 레포 루트 `assistant-poller.log`에 쌓인다**(작업 스케줄러로 돌 때도 남는다). 최근 것만 보려면:

```powershell
Get-Content .\assistant-poller.log -Tail 20
# 실시간으로 보려면
Get-Content .\assistant-poller.log -Tail 20 -Wait
```

콘솔에서 직접 띄워 확인하려면:

```powershell
cd <레포 경로>
& "C:\Program Files\nodejs\node.exe" scripts\assistant\serve-local.mjs
```

이렇게 뜨면 정상이다:

```
[assistant] 폴링 시작 — https://.../api/assistant/claude/claim (2000ms), 볼트: C:\...
[assistant] 14시 03분 21초 대기 중
```

**`대기 중`은 5분마다 찍히는 하트비트다.** 그게 없으면 멈춘 것이고, 있으면 조용해도 살아 있는 것이다.

**웹에서도 볼 수 있다** — `/dashboard/settings` 첫 화면(**상태** 탭)에 폴러 6개의 심박이 나온다. 회사 PC 에 접속하지 않고 확인할 때 여기를 본다.

### 3-2. 서버까지 닿나

```powershell
$s = (Select-String -Path .env.local -Pattern '^CRON_SECRET=(.*)$').Matches.Groups[1].Value
curl.exe -s -H "Authorization: Bearer $s" https://ops-console-psi.vercel.app/api/assistant/claude/claim
```

`{"ok":true,"request":null}` 이면 성공. `unauthorized`(401)면 `CRON_SECRET`이 Vercel 값과 다르다.

### 3-3. 실제로 답하나

웹에서 채팅 아이콘을 열고 묻는다:

> 공문 시행번호는 어떻게 매겨져?

**30초쯤** 뒤 답이 오고, 아래에 **읽은 지식망 문서**가 붙으면 끝이다. 기다리는 동안 `회사 PC로 보냈습니다…` → `지식망 문서를 읽는 중…` 순으로 바뀐다.

---

## 3-4. 우편물 판독 폴러 (별개 프로세스)

회사 PC에는 폴러가 **둘** 돈다. 어시스턴트와 별개다 — 하나가 죽어도 다른 하나는 살아 있어야 한다.

```powershell
cd <레포 경로>
powershell -ExecutionPolicy Bypass -File scripts\postal\register-extract-task.ps1
```

| | 어시스턴트 | 우편물 판독 |
|---|---|---|
| 작업 이름 | `OPS-Console 어시스턴트 폴러` | `OPS-Console 우편물 판독 폴러` |
| 스크립트 | `scripts\assistant\serve-local.mjs` | `scripts\postal\extract-local.mjs` |
| 로그 | `assistant-poller.log` | `postal-poller.log` |
| 추가 env | `KNOWLEDGE_VAULT_PATH` | 없음 |

확인: 우편물 화면에서 영수증 **[추출]** → 30초 내 표가 나오면 정상. 등록 전에는 눌러도 `pending`에 머문다.

---

## 4. 코드가 바뀌면 — 갱신 절차 (자주 하게 된다)

**작업 스케줄러는 죽은 프로세스만 되살린다. 코드를 따라가지는 않는다.**
main에 폴러 관련 변경이 들어와도 이 PC는 옛 코드를 계속 돌린다 — 새 도구가 안 붙거나, 고친 버그가 그대로 남는다. 실제로 폴러가 몇 시간 낡은 코드로 돌던 적이 있다.

```powershell
cd <레포 경로>
git pull
npm ci                                            # 의존성이 바뀌었을 수 있다
Restart-ScheduledTask -TaskName "OPS-Console 어시스턴트 폴러"
Restart-ScheduledTask -TaskName "OPS-Console 우편물 판독 폴러"
```

### ▶ 지금 밀려 있는 것 (2026-08-22)

**`read_file` 도구가 추가됐다**(#1074) — Teams·SharePoint 파일을 읽어 지식망 초안을 만드는 도구다. 폴러 파일(`scripts/assistant/serve-local.mjs`)이 바뀌었으므로 **위 절차를 한 번 돌려야** 쓸 수 있다.

**안 하면 티가 안 난다.** 에러가 나지 않고 어시스턴트가 그냥 *"파일을 읽을 수 없다"* 고 답한다 — 도구가 없다는 걸 모델도 모르기 때문이다. 지식망 화면의 **[파일로 초안 만들기]** 가 30초 뒤 아무 초안도 안 만들면 이걸 의심한다.

확인: 지식망 화면에서 Teams 파일 링크(Word·PDF 권장)를 붙여넣고 초안 요청 → `제안/` 에 문서가 생기면 된다.

**언제 해야 하나** — 아래가 바뀌었을 때. 판단이 애매하면 그냥 한다(1분이면 끝난다).

| 바뀐 것 | 왜 |
|---|---|
| `scripts/assistant/*` · `scripts/postal/*` | 폴러 본체·도구. 이 PC에서 도는 코드 그대로다 |
| `package.json` | 새 의존성이 없으면 SDK 호출이 깨진다 |
| `src/features/assistant/*` · `src/app/api/assistant/*` | **재시작 불필요** — 서버(Vercel) 쪽이라 배포로 반영된다 |

프롬프트·근거 추출은 서버에 있어(설계상) 그것만 고쳤다면 이 PC를 만질 필요가 없다. **폴러 파일이 바뀌었는지만 보면 된다.**

갱신 뒤에는 3-1(하트비트)과 3-3(실제 질문)으로 한 번 확인한다.

### 폴러를 두 곳에서 돌리지 않는다

큐를 원자적으로 claim하므로 답이 두 번 나가지는 않지만, **어느 PC가 답했는지 알 수 없어져 문제 추적이 어려워진다.** 개발 중 임시로 다른 PC에서 띄웠다면 반드시 끈다.

---

## 5. 문제가 생기면

| 증상 | 원인 | 조치 |
|---|---|---|
| 15초 뒤 "회사 PC가 응답하지 않습니다" | 폴러가 안 돎 | 작업 스케줄러 상태 + `assistant-poller.log` 마지막 줄 확인 |
| `claim 실패 N건째: fetch failed` | 네트워크 두절·PC 절전 | 복구되면 `서버 복구 (실패 N건 뒤)`가 찍힌다. 계속이면 3-2 확인 |
| `unauthorized` | `CRON_SECRET` 불일치 | Vercel 환경변수와 맞춘다 |
| `KNOWLEDGE_VAULT_PATH 없음/경로 부재` | 경로 오타·동기 안 됨 | 탐색기에서 실제 경로 확인, OneDrive 동기 상태 확인 |
| 답에 "볼트에 없습니다"만 나옴 | 볼트에 그 문서가 없음 | 정상 동작이다. 일정·휴가는 문서가 아니라 도구로 답한다 |
| "3분을 넘겨 중단했습니다" | 한 건이 3분을 넘김 | 질문을 좁혀 다시. 반복되면 로그의 도구 호출을 본다 |
| 답이 안 오고 큐에 `running`으로 남음 | 폴러가 도중에 죽음 | 5분 뒤 서버가 자동으로 실패 처리한다. 조치 불필요 |
| 답은 오는데 **새로 붙인 도구를 안 쓴다** | 폴러가 옛 코드로 돌고 있음 | §4 갱신. 이 증상은 에러가 안 나서 티가 잘 안 난다 |

---

## 6. 이 폴러가 지키는 것 (건드리지 말 것)

`scripts/assistant/serve-local.mjs`의 아래 설정은 **각각 실제 사고에서 나온 것**이다.

- **`strictMcpConfig` + `mcpServers` + `settingSources: []`** — 이게 없으면 그 PC의 Claude에 붙은 MCP(메일·Teams·노션 등)에 에이전트가 닿는다. 실측으로 개인 캘린더를 읽어낸 적이 있다(#992). **볼트는 운영자 전원이 쓰는 파일**이라 문서 한 줄이 그 경로를 열 수 있다.
- **`disallowedTools`** — `allowedTools`만으로는 Bash가 막히지 않는다(#990 실측).
- **HTTP 15초 상한** — 없으면 네트워크가 어중간하게 끊길 때 fetch가 영원히 매달리고, 폴러는 살아 있는 채로 아무 일도 안 한다(#995).
- **3분 상한은 `abortController`** — `interrupt()`는 도구가 응답을 안 준 상태에서 부르면 SDK 진단 문자열을 그대로 뱉는다(#996).

판단(프롬프트 조립·근거 추출)은 **전부 서버에 있다.** 프롬프트를 고칠 때 이 PC를 만질 필요가 없다.
