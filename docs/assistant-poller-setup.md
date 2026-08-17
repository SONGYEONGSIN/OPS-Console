# 어시스턴트 Claude 모드 — 회사 PC 셋업

어시스턴트의 기본 모드는 **회사 PC에서 도는 폴러**가 답을 만든다. 이 문서는 그 폴러를 회사 PC에 올리는 절차다.

> **왜 회사 PC인가**: Claude 구독(OAuth)은 로그인한 그 PC에만 있어 Vercel에서 쓸 수 없다. 그래서 웹은 질문을 큐(`assistant_requests`)에 쌓기만 하고, 이 폴러가 2초마다 가져가 볼트를 읽혀 답을 되돌려 적는다. 경쟁률 점검·개발탭 분석과 같은 구조이며, 다른 점은 **채팅이라 5분 간격이 아니라 상주**라는 것뿐이다.

---

## 0. 셋업 전 상태 (정상이다)

폴러가 없으면 어시스턴트에 질문했을 때 **15초 뒤 "회사 PC가 응답하지 않습니다"** 가 뜬다. 고장이 아니라 *아무도 큐를 가져가지 않는 상태*다.

그동안에도 **토글을 끄면**(`빠른 답변`) Gemini 즉답은 그대로 동작한다.

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

콘솔에서 직접 확인하려면:

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

## 4. 옮긴 뒤 할 일

맥에서 임시로 돌리던 폴러를 **끈다.** 둘이 동시에 돌아도 큐를 원자적으로 claim하므로 답이 두 번 나가지는 않지만, 어느 PC가 답했는지 알 수 없어져 문제 추적이 어려워진다.

---

## 5. 문제가 생기면

| 증상 | 원인 | 조치 |
|---|---|---|
| 15초 뒤 "회사 PC가 응답하지 않습니다" | 폴러가 안 돎 | 작업 스케줄러에서 상태 확인, 3-1로 직접 실행해 로그 확인 |
| `claim 실패 N건째: fetch failed` | 네트워크 두절·PC 절전 | 복구되면 `서버 복구 (실패 N건 뒤)`가 찍힌다. 계속이면 3-2 확인 |
| `unauthorized` | `CRON_SECRET` 불일치 | Vercel 환경변수와 맞춘다 |
| `KNOWLEDGE_VAULT_PATH 없음/경로 부재` | 경로 오타·동기 안 됨 | 탐색기에서 실제 경로 확인, OneDrive 동기 상태 확인 |
| 답에 "볼트에 없습니다"만 나옴 | 볼트에 그 문서가 없음 | 정상 동작이다. 일정·휴가는 문서가 아니라 도구로 답한다 |
| "3분을 넘겨 중단했습니다" | 한 건이 3분을 넘김 | 질문을 좁혀 다시. 반복되면 로그의 도구 호출을 본다 |
| 답이 안 오고 큐에 `running`으로 남음 | 폴러가 도중에 죽음 | 5분 뒤 서버가 자동으로 실패 처리한다. 조치 불필요 |

---

## 6. 이 폴러가 지키는 것 (건드리지 말 것)

`scripts/assistant/serve-local.mjs`의 아래 설정은 **각각 실제 사고에서 나온 것**이다.

- **`strictMcpConfig` + `mcpServers` + `settingSources: []`** — 이게 없으면 그 PC의 Claude에 붙은 MCP(메일·Teams·노션 등)에 에이전트가 닿는다. 실측으로 개인 캘린더를 읽어낸 적이 있다(#992). **볼트는 운영자 전원이 쓰는 파일**이라 문서 한 줄이 그 경로를 열 수 있다.
- **`disallowedTools`** — `allowedTools`만으로는 Bash가 막히지 않는다(#990 실측).
- **HTTP 15초 상한** — 없으면 네트워크가 어중간하게 끊길 때 fetch가 영원히 매달리고, 폴러는 살아 있는 채로 아무 일도 안 한다(#995).
- **3분 상한은 `abortController`** — `interrupt()`는 도구가 응답을 안 준 상태에서 부르면 SDK 진단 문자열을 그대로 뱉는다(#996).

판단(프롬프트 조립·근거 추출)은 **전부 서버에 있다.** 프롬프트를 고칠 때 이 PC를 만질 필요가 없다.
