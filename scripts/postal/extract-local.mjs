// 우편물 영수증 판독 — 회사 PC 상주 폴러
//
// 이미지를 읽으려면 Claude가 필요한데 구독(OAuth)은 이 PC에만 있어 Vercel에서
// 못 한다. 어시스턴트 폴러와 같은 구조다 — 웹이 큐에 쌓고, 여기서 claim해
// Agent SDK가 이미지를 Read 로 읽고, 결과를 서버가 검증해 저장한다.
//
// **판단은 서버에 있다.** 프롬프트도 검산도 서버가 만들어 내려주므로 규칙을
// 고칠 때 이 PC를 만지지 않는다.
//
// 필요 env (.env.local): OPS_CONSOLE_BASE_URL · CRON_SECRET
// 실행: node scripts/postal/extract-local.mjs

import { startHeartbeat } from "../lib/heartbeat.mjs";
import { fetchWithTimeout } from "../lib/fetch-timeout.mjs";
import { config } from "dotenv";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

config({ path: ".env.local" });

const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const POLL_MS = Number(process.env.POSTAL_POLL_MS ?? 3000);
const HTTP_TIMEOUT_MS = 20_000;
/** 한 장에 3분이면 이상 상황이다(실측 30초 안팎). */
const TIMEOUT_MS = 180_000;
const HEARTBEAT_MS = 5 * 60 * 1000;

// 영수증만 읽으면 되므로 도구를 최소로. MCP 격리는 어시스턴트와 같은 이유다 —
// 이 PC의 메일·Teams·노션에 에이전트가 닿으면 안 된다.
const ALLOWED = ["Read"];
const DISALLOWED = ["Bash", "Write", "Edit", "NotebookEdit", "Task", "WebFetch", "WebSearch", "Glob", "Grep"];

if (!BASE || !SECRET) {
  console.error("[postal] OPS_CONSOLE_BASE_URL / CRON_SECRET 미설정 — 종료");
  process.exit(1);
}

const endpoint = `${BASE}/api/postal/extract`;
const headers = { authorization: `Bearer ${SECRET}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toLocaleTimeString("ko-KR", { hour12: false });

/**
 * 타임아웃 있는 fetch — 없으면 절전 복귀 때 영원히 매달린다(어시스턴트에서 겪었다).
 *
 * `AbortSignal.timeout()` 으로는 모자랐다. **그 타이머가 unref 라** 이벤트 루프를
 * 안 잡아, 절전 중 좀비가 된 fetch 를 깨우지 못한 채 프로세스가 조용히 죽었다
 * (2026-08-24 어시스턴트, exit 13).
 */
const http = (url, init = {}) => fetchWithTimeout(url, init, HTTP_TIMEOUT_MS);

async function claim() {
  const res = await http(endpoint, { headers });
  if (!res.ok) throw new Error(`claim ${res.status}`);
  return (await res.json()).request ?? null;
}

async function report(id, ok, { raw, message }) {
  const res = await http(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ id, ok, raw, message }),
  });
  if (!res.ok) throw new Error(`report ${res.status}`);
}

/** 이미지를 임시 폴더에 내려받아 그 폴더를 cwd로 열고 Read 시킨다. */
async function extract(req) {
  const dir = await mkdtemp(join(tmpdir(), "postal-"));
  try {
    const img = await http(req.imageUrl);
    if (!img.ok) throw new Error(`이미지 내려받기 실패 ${img.status}`);
    await writeFile(join(dir, req.fileName), Buffer.from(await img.arrayBuffer()));

    const ac = new AbortController();
    let timedOut = false;
    const run = query({
      prompt: req.prompt,
      options: {
        cwd: dir,
        allowedTools: ALLOWED,
        disallowedTools: DISALLOWED,
        permissionMode: "bypassPermissions",
        // 이 PC에 붙은 MCP를 상속하지 않는다 — 어시스턴트와 같은 방어.
        strictMcpConfig: true,
        mcpServers: {},
        settingSources: [],
        abortController: ac,
      },
    });
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, TIMEOUT_MS);

    // 텍스트 블록을 모은다 — m.result 는 마지막 블록만 준다(어시스턴트에서 겪은 답 잘림).
    const texts = [];
    let result = "";
    try {
      for await (const m of run) {
        if (m.type === "assistant")
          for (const b of m.message.content ?? [])
            if (b.type === "text" && b.text.trim()) texts.push(b.text.trim());
        if (m.type === "result") result = m.result ?? "";
      }
    } catch (e) {
      if (timedOut) throw new Error("3분을 넘겨 중단했습니다");
      throw e;
    } finally {
      clearTimeout(timer);
    }
    return texts.length > 0 ? texts.join("\n\n") : result;
  } finally {
    // 영수증에는 수취인 실명·카드 정보가 찍혀 있다. 판독이 끝나면 바로 지운다.
    await rm(dir, { recursive: true, force: true });
  }
}

console.log(`[postal] 폴링 시작 — ${endpoint} (${POLL_MS}ms)`);

// 살아있음을 1분마다 남긴다 — 큐가 조용하면 이게 생사의 유일한 증거다.
startHeartbeat({ baseUrl: BASE, secret: SECRET, pollerId: "postal-extract" });

let lastBeat = 0;
let failStreak = 0;

for (;;) {
  let req = null;
  try {
    req = await claim();
    if (failStreak > 0) {
      console.log(`[postal] ${stamp()} 서버 복구 (실패 ${failStreak}건 뒤)`);
      failStreak = 0;
    }
  } catch (e) {
    failStreak += 1;
    if (failStreak === 1 || failStreak % 10 === 0)
      console.error(`[postal] ${stamp()} claim 실패 ${failStreak}건째: ${e.message}`);
    await sleep(POLL_MS * 5);
    continue;
  }

  if (!req) {
    const now = Date.now();
    if (now - lastBeat >= HEARTBEAT_MS) {
      console.log(`[postal] ${stamp()} 대기 중`);
      lastBeat = now;
    }
    await sleep(POLL_MS);
    continue;
  }

  console.log(`[postal] claim ${req.id} (영수증 ${req.receiptId})`);
  const t0 = Date.now();
  try {
    const raw = await extract(req);
    await report(req.id, true, { raw });
    console.log(`[postal] 완료 ${req.id} — ${((Date.now() - t0) / 1000).toFixed(1)}초`);
  } catch (e) {
    console.error(`[postal] 실패 ${req.id}: ${e.message}`);
    await report(req.id, false, { message: e.message }).catch((e2) =>
      console.error(`[postal] 실패 보고도 실패: ${e2.message}`),
    );
  }
}
