// 어시스턴트 Claude 모드 — 회사 PC 상주 폴러
//
// Claude 구독(OAuth)은 이 PC에만 있어 Vercel에서 못 쓴다. 그래서 웹은 질문을
// assistant_requests에 쌓기만 하고, 이 프로세스가 2초마다 claim해 Agent SDK로
// 볼트를 읽혀 답을 만든 뒤 되돌려 적는다.
//
// 작업 스케줄러(5분 간격 단발)가 아니라 **상주**인 이유: 채팅이라 5분을 못 기다린다.
//
// 이 스크립트에는 판단이 없다 — 프롬프트는 서버가 만들어 내려주고, 근거 추출도
// 서버가 한다(폴러는 쓴 도구를 그대로 넘긴다). 그래야 프롬프트를 고칠 때 회사 PC를
// 만지지 않아도 되고, 그 로직이 테스트 도는 곳(src/features/assistant)에 남는다.
//
// 필요 env (.env.local):
//   OPS_CONSOLE_BASE_URL · CRON_SECRET · KNOWLEDGE_VAULT_PATH
// 실행: node scripts/assistant/serve-local.mjs

import { config } from "dotenv";
import { existsSync } from "node:fs";
import { query } from "@anthropic-ai/claude-agent-sdk";

config({ path: ".env.local" });

const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const VAULT = process.env.KNOWLEDGE_VAULT_PATH;
const POLL_MS = Number(process.env.ASSISTANT_POLL_MS ?? 2000);

// 도구는 화이트리스트로 주되, 위험한 것은 명시적으로 뺀다.
// 실측(2026-08-16): allowedTools만 주고 permissionMode=bypassPermissions면 Bash가 그대로
// 실행된다. disallowedTools를 함께 줘야 "Bash로 실행하라"는 프롬프트 지시도 무시된다.
// 볼트는 운영자 전원이 쓰는 파일이라 이 차단이 인젝션 방어의 본체다.
const ALLOWED = ["Read", "Glob", "Grep"];
const DISALLOWED = [
  "Bash",
  "Write",
  "Edit",
  "NotebookEdit",
  "Task",
  "WebFetch",
  "WebSearch",
];

/** 한 건이 무한정 물고 있지 않게 — 실측 30~45초라 3분이면 이상 상황이다. */
const TIMEOUT_MS = 180_000;

if (!BASE || !SECRET) {
  console.error("[assistant] OPS_CONSOLE_BASE_URL / CRON_SECRET 미설정 — 종료");
  process.exit(1);
}
if (!VAULT || !existsSync(VAULT)) {
  console.error(`[assistant] KNOWLEDGE_VAULT_PATH 없음/경로 부재: ${VAULT} — 종료`);
  process.exit(1);
}

const endpoint = `${BASE}/api/assistant/claude/claim`;
const headers = { authorization: `Bearer ${SECRET}` };

async function claim() {
  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`claim ${res.status}`);
  const body = await res.json();
  return body.request ?? null;
}

async function report(id, ok, { answer, toolUses, message }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ id, ok, answer, toolUses, vaultRoot: VAULT, message }),
  });
  if (!res.ok) throw new Error(`report ${res.status}`);
}

/** 볼트를 cwd로 Claude를 돌린다. 답과 쓴 도구를 그대로 돌려준다(해석은 서버가). */
async function answerWithVault(prompt) {
  const uses = [];
  let answer = "";
  const run = query({
    prompt,
    options: {
      cwd: VAULT,
      allowedTools: ALLOWED,
      disallowedTools: DISALLOWED,
      permissionMode: "bypassPermissions",
    },
  });

  const timer = setTimeout(() => run.interrupt?.(), TIMEOUT_MS);
  try {
    for await (const m of run) {
      if (m.type === "assistant") {
        for (const b of m.message.content ?? []) {
          if (b.type === "tool_use") uses.push({ name: b.name, input: b.input });
        }
      }
      if (m.type === "result") answer = m.result ?? "";
    }
  } finally {
    clearTimeout(timer);
  }

  return { answer, toolUses: uses };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`[assistant] 폴링 시작 — ${endpoint} (${POLL_MS}ms), 볼트: ${VAULT}`);

// 상주 루프. claim 실패(네트워크·배포 중)로는 죽지 않는다 — 죽으면 채팅이 통째로 멈춘다.
for (;;) {
  let req = null;
  try {
    req = await claim();
  } catch (e) {
    console.error(`[assistant] claim 실패: ${e.message}`);
    await sleep(POLL_MS * 5);
    continue;
  }

  if (!req) {
    await sleep(POLL_MS);
    continue;
  }

  console.log(`[assistant] claim ${req.id} (${req.operator_email}): ${req.question.slice(0, 40)}`);
  const t0 = Date.now();
  try {
    const { answer, toolUses } = await answerWithVault(req.prompt);
    if (!answer) throw new Error("빈 응답");
    await report(req.id, true, { answer, toolUses });
    const reads = toolUses.filter((u) => u.name === "Read").length;
    console.log(
      `[assistant] 완료 ${req.id} — ${((Date.now() - t0) / 1000).toFixed(1)}초, 문서 ${reads}건 읽음`,
    );
  } catch (e) {
    console.error(`[assistant] 실패 ${req.id}: ${e.message}`);
    // 보고까지 실패하면 그 요청은 running에 남는다 — 다음 루프에서 재시도하지 않는다.
    // 사용자 화면에는 타임아웃으로 드러나므로 조용히 사라지지는 않는다.
    await report(req.id, false, { message: e.message }).catch((e2) =>
      console.error(`[assistant] 실패 보고도 실패: ${e2.message}`),
    );
  }
}
