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
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

config({ path: ".env.local" });

const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const VAULT = process.env.KNOWLEDGE_VAULT_PATH;
const POLL_MS = Number(process.env.ASSISTANT_POLL_MS ?? 2000);

// 도구는 화이트리스트로 주되, 위험한 것은 명시적으로 뺀다.
// (MCP 서버 차단은 아래 query() 옵션 쪽 — allowedTools로는 안 막힌다.)
// 실측(2026-08-16): allowedTools만 주고 permissionMode=bypassPermissions면 Bash가 그대로
// 실행된다. disallowedTools를 함께 줘야 "Bash로 실행하라"는 프롬프트 지시도 무시된다.
// 볼트는 운영자 전원이 쓰는 파일이라 이 차단이 인젝션 방어의 본체다.
const ALLOWED = ["Read", "Glob", "Grep", "mcp__ops__schedule_range"];
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

/**
 * HTTP 한 번의 상한.
 *
 * 없으면 네트워크가 어중간하게 끊길 때(맥 절전 복귀 등) fetch가 영원히 매달려
 * 폴러가 살아 있는 채로 아무 일도 안 한다 — 실제로 겪었다. 로그도 안 찍히니
 * 밖에서는 "조용히 잘 도는 중"과 구분되지 않는다.
 */
const HTTP_TIMEOUT_MS = 15_000;

/** 타임아웃이 걸린 fetch. 실패는 그대로 던져 호출부의 백오프로 넘긴다. */
async function fetchWithTimeout(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
}

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
  const res = await fetchWithTimeout(endpoint, { headers });
  if (!res.ok) throw new Error(`claim ${res.status}`);
  const body = await res.json();
  return body.request ?? null;
}

async function report(id, ok, { answer, toolUses, message }) {
  const res = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ id, ok, answer, toolUses, vaultRoot: VAULT, message }),
  });
  if (!res.ok) throw new Error(`report ${res.status}`);
}

/**
 * 운영 데이터 조회 도구.
 *
 * 볼트에 없는 것(누가 언제 쉬는지 등)을 Claude가 직접 물어볼 수 있게 붙인다.
 * DB를 직접 보지 않고 OPS-Console API를 거치는 이유는 **서비스 키를 이 PC에
 * 내려보내지 않기 위해서**다 — 이 PC가 아는 건 CRON_SECRET뿐이다.
 */
const opsTools = createSdkMcpServer({
  name: "ops",
  tools: [
    tool(
      "schedule_range",
      "운영부 일정을 기간으로 조회한다. 휴가·당직·회의·마감 등 '누가 언제 무엇을 하는지'는 볼트 문서가 아니라 이 도구로 확인한다.",
      {
        from: z.string().describe("조회 시작일 YYYY-MM-DD"),
        to: z.string().describe("조회 종료일 YYYY-MM-DD (그날 포함)"),
        type: z
          .enum([
            "shift",
            "event",
            "leave",
            "training",
            "application",
            "pims",
            "external_meeting",
            "meeting",
          ])
          .optional()
          .describe("종류. 휴가·연차는 leave. 생략하면 전 종류"),
      },
      async ({ from, to, type }) => {
        const qs = new URLSearchParams({ from, to });
        if (type) qs.set("type", type);
        const res = await fetchWithTimeout(
          `${BASE}/api/assistant/tools/schedule?${qs}`,
          { headers },
        );
        const body = await res.json();
        if (!res.ok || !body.ok) {
          return {
            content: [
              { type: "text", text: `조회 실패: ${body.error ?? res.status}` },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(body.events) }],
        };
      },
    ),
  ],
});

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

      // 이 PC의 Claude에 붙어 있는 MCP 서버를 상속하지 않는다.
      // 실측(2026-08-16): 이 셋이 없으면 disallowedTools를 줘도 MCP 도구가 그대로
      // 열려 있다 — "구글 캘린더 조회해줘" 한 줄로 개인 캘린더를 읽어냈다.
      // 볼트는 운영자 전원이 쓰는 파일이라, 문서 한 줄이 회사 PC의 메일·Teams·
      // 노션에 닿는 경로가 된다. 도구 차단만으로는 부족하고 여기서 끊어야 한다.
      strictMcpConfig: true, // 프로젝트/사용자/플러그인 MCP 설정 전부 무시
      // strictMcpConfig 하에서는 여기 넘긴 것만 살아남는다 — 우리 도구만 붙고
      // 이 PC에 설치된 다른 MCP는 여전히 차단된다.
      mcpServers: { ops: opsTools },
      settingSources: [], // ~/.claude, .claude/settings.json 미로드
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
const stamp = () => new Date().toLocaleTimeString("ko-KR", { hour12: false });

/**
 * 살아 있다는 신호를 주기적으로 남긴다.
 *
 * 대기 중에는 아무것도 안 찍혀서, 밖에서 보면 **멈춘 것과 구분되지 않는다**.
 * 실제로 로그가 조용해 죽은 줄 알고 확인한 적이 있다.
 */
const HEARTBEAT_MS = 5 * 60 * 1000;
let lastBeat = 0;

/** 같은 실패로 로그가 도배되지 않게 — 첫 건과 10건마다만 남긴다. */
let failStreak = 0;

console.log(`[assistant] 폴링 시작 — ${endpoint} (${POLL_MS}ms), 볼트: ${VAULT}`);

// 상주 루프. claim 실패(네트워크·배포 중)로는 죽지 않는다 — 죽으면 채팅이 통째로 멈춘다.
for (;;) {
  let req = null;
  try {
    req = await claim();
    if (failStreak > 0) {
      console.log(`[assistant] ${stamp()} 서버 복구 (실패 ${failStreak}건 뒤)`);
      failStreak = 0;
    }
  } catch (e) {
    failStreak += 1;
    if (failStreak === 1 || failStreak % 10 === 0) {
      console.error(`[assistant] ${stamp()} claim 실패 ${failStreak}건째: ${e.message}`);
    }
    await sleep(POLL_MS * 5);
    continue;
  }

  if (!req) {
    const now = Date.now();
    if (now - lastBeat >= HEARTBEAT_MS) {
      console.log(`[assistant] ${stamp()} 대기 중`);
      lastBeat = now;
    }
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
