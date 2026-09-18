// 배정 판정 로컬 폴러 — 회사 PC (작업 스케줄러 5분 간격 단발)
//
// 판정은 Claude 구독(OAuth)을 쓰는 Agent SDK 이고 그 구독은 이 PC 에만 있다. 그래서
// 서버는 판정 요청을 큐에 쌓기만 하고(설계 §6.4), 이 프로세스가 claim 해 판정한 뒤
// 응답 원문을 되돌려 보낸다.
//
// **이 스크립트에는 판단이 없다.** 프롬프트는 서버가 만들어 내려주고, 응답 검산
// (G1~G7)과 배치 적재도 서버가 한다. 게이트를 여기로 내보내면 검산이 두 곳에 생기고,
// 이 PC 의 코드가 낡은 채로 통과시킨 배치를 아무도 못 알아챈다(어시스턴트 선례).
//
// 상주가 아니라 5분 단발인 이유: 배정은 채팅이 아니라 연 1회·평일 1건 규모라
// 5분을 기다려도 된다. 상주 프로세스를 하나 덜 두는 편이 낫다.
//
// 필요 env (.env.local): OPS_CONSOLE_BASE_URL · CRON_SECRET
// 실행: node scripts/assignments/propose-local.mjs

import { config } from "dotenv";
import { query } from "@anthropic-ai/claude-agent-sdk";

config({ path: ".env.local" });

const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const ENDPOINT = `${BASE}/api/assignments/propose-request`;

/**
 * 판정 시간 제한. **서버의 `STALE_RUNNING_MS`(30분)보다 작아야 한다** — 크면 서버가
 * 죽은 줄 알고 큐를 열어 같은 판정이 두 벌 돈다. 두 값은 묶여 있다
 * (`features/assignments/propose-requests/enqueue.ts`).
 */
const JUDGE_TIMEOUT_MS = 10 * 60_000;

const MODEL = process.env.ASSIGNMENT_JUDGE_MODEL ?? "claude-opus-5";

/**
 * 판정에는 도구가 **하나도** 필요 없다 — 서버가 표를 다 조립해 프롬프트로 주고
 * 답은 JSON 한 덩이다. 열 이유가 없는 것을 열어 두면 나중에 프롬프트 한 줄이 이 PC 의
 * 파일·메일에 닿는 경로가 된다.
 *
 * `allowedTools: []` 만으로는 안 막힌다(어시스턴트 실측 2026-08-16) — 이름으로도
 * 막고, MCP 는 아래 세 옵션으로 끊는다.
 */
const DISALLOWED = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
  "NotebookEdit",
];

const authHeaders = { authorization: `Bearer ${SECRET}` };

async function claim() {
  const res = await fetch(ENDPOINT, { headers: authHeaders });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok !== true) {
    throw new Error(
      `claim 실패 (${res.status}): ${body.error ?? "응답을 읽을 수 없습니다"}`,
    );
  }
  return body;
}

async function report(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  // 회신이 안 들어가면 running 이 남아 STALE 까지 큐가 잠긴다 — 조용히 넘기지 않는다.
  if (!res.ok) {
    console.error(`[propose] 회신 실패 (${res.status}):`, body.error ?? "");
  }
  return body;
}

/** 서버가 준 프롬프트를 그대로 넘기고, 모델이 말한 것을 그대로 모은다. */
async function judge(prompt) {
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, JUDGE_TIMEOUT_MS);

  const chunks = [];
  try {
    const run = query({
      prompt,
      options: {
        model: MODEL,
        allowedTools: [],
        disallowedTools: DISALLOWED,
        permissionMode: "bypassPermissions",

        // 이 PC 의 Claude 에 붙어 있는 MCP 서버를 상속하지 않는다.
        // 실측(2026-08-16, 어시스턴트): 이 셋이 없으면 disallowedTools 를 줘도 MCP
        // 도구가 그대로 열려 있다 — "구글 캘린더 조회해줘" 한 줄로 개인 캘린더를
        // 읽어냈다.
        strictMcpConfig: true,
        mcpServers: {},
        settingSources: [],
        abortController: ac,
      },
    });

    for await (const m of run) {
      if (m.type !== "assistant") continue;
      for (const block of m.message?.content ?? []) {
        if (block.type === "text") chunks.push(block.text);
      }
    }
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) {
    throw new Error(`판정이 ${JUDGE_TIMEOUT_MS / 60_000}분을 넘겨 중단했습니다`);
  }
  return chunks.join("").trim();
}

async function main() {
  if (!BASE || !SECRET) {
    console.error("[propose] OPS_CONSOLE_BASE_URL / CRON_SECRET 필요");
    process.exitCode = 1;
    return;
  }

  const claimed = await claim();
  if (!claimed.request) {
    // 할 일이 없다. 5분 뒤에 또 온다.
    return;
  }

  const { id, kind, academic_year: year } = claimed.request;
  const where =
    kind === "single"
      ? `${claimed.request.university_name} ${claimed.request.work_kind}`
      : `${year}학년도 전체`;
  console.log(`[propose] claim ${id} — ${kind} / ${where}`);

  try {
    const verdictRaw = await judge(claimed.prompt);
    if (!verdictRaw) {
      throw new Error("모델이 아무 말도 하지 않았습니다");
    }
    const body = await report({
      id,
      ok: true,
      verdictRaw,
      model: MODEL,
      promptHash: claimed.promptHash,
    });
    console.log(
      body.ok
        ? `[propose] 완료 — ${body.summary ?? ""} (배치 ${body.batchId ?? "-"})`
        : `[propose] 서버가 거부 — ${body.error ?? ""}`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[propose] 판정 실패 — ${message}`);
    await report({ id, ok: false, message });
    process.exitCode = 1;
  }
}

main().catch((e) => {
  // main 밖에서 죽으면 회신이 못 나간다 — 그건 STALE 이 치우고, 로그로 남긴다.
  console.error("[propose] 폴러가 죽었습니다:", e);
  process.exitCode = 1;
});
