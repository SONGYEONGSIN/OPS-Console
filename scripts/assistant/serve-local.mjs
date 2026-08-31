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

import { startHeartbeat } from "../lib/heartbeat.mjs";
import { fetchWithTimeout as withFetchTimeout } from "../lib/fetch-timeout.mjs";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
// 경로 검증은 순수 함수로 빼 두고 테스트가 그 파일을 그대로 검사한다
// (src/features/assistant/__tests__/propose.test.ts).
import {
  resolveProposalPath,
  resolveProposalCategory,
  classifiedBy,
} from "./propose-lib.mjs";
import { resolvePromotion } from "./promote-lib.mjs";

config({ path: ".env.local" });

/**
 * 로그는 작업 스케줄러가 파일로 넘긴다 —
 *   cmd /c "node serve-local.mjs >> assistant-poller.log 2>&1"
 *
 * 폴러가 스스로도 같은 파일에 쓰게 했다가 되돌렸다. cmd 가 그 파일을 쥐고 있어
 * 쓰기가 **매번** EBUSY 로 튕겼고, 그 실패 메시지가 로그에 섞여 진단을 흐렸다
 * (2026-08-19). 무엇보다 node 가 통째로 죽을 때 나오는 스택은 console 을 거치지
 * 않으므로 리다이렉트만이 잡는다 — 폴러가 조용히 죽는 걸 보려고 만든 로그다.
 */

const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
const VAULT = process.env.KNOWLEDGE_VAULT_PATH;
const POLL_MS = Number(process.env.ASSISTANT_POLL_MS ?? 2000);

// 도구는 화이트리스트로 주되, 위험한 것은 명시적으로 뺀다.
// (MCP 서버 차단은 아래 query() 옵션 쪽 — allowedTools로는 안 막힌다.)
// 실측(2026-08-16): allowedTools만 주고 permissionMode=bypassPermissions면 Bash가 그대로
// 실행된다. disallowedTools를 함께 줘야 "Bash로 실행하라"는 프롬프트 지시도 무시된다.
// 볼트는 운영자 전원이 쓰는 파일이라 이 차단이 인젝션 방어의 본체다.
const ALLOWED = [
  "Read",
  "Glob",
  "Grep",
  "mcp__ops__schedule_range",
  "mcp__ops__report_gap",
  "mcp__ops__search_ops",
  "mcp__ops__fetch_ops",
  // 볼트 쓰기는 이 도구로만 연다. Write·Edit는 아래 DISALLOWED에 그대로 둔다 —
  // 범용 쓰기를 열면 문서 한 줄이 이 PC의 파일 시스템을 여는 경로가 된다.
  "mcp__ops__propose_doc",
  "mcp__ops__promote_doc",
];
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

/**
 * 타임아웃이 걸린 fetch. 실패는 그대로 던져 호출부의 백오프로 넘긴다.
 *
 * 타임아웃 타이머가 **이벤트 루프를 잡아야** 한다 — `AbortSignal.timeout()` 은
 * unref 되어 있어 절전 중 좀비가 된 fetch 를 깨울 것이 아무것도 없었다
 * (2026-08-24, exit 13 으로 1시간 멈춤). 자세한 건 `lib/fetch-timeout.mjs`.
 */
async function fetchWithTimeout(url, init = {}) {
  return withFetchTimeout(url, init, HTTP_TIMEOUT_MS);
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

async function report(id, ok, { answer, toolUses, message, usage, totalCostUsd, numTurns, modelUsage }) {
  const res = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      id,
      ok,
      answer,
      toolUses,
      vaultRoot: VAULT,
      message,
      // 토큰·비용 — 서버가 숫자만 걸러 저장한다.
      usage,
      totalCostUsd,
      numTurns,
      modelUsage,
    }),
  });
  if (!res.ok) throw new Error(`report ${res.status}`);
}
/**
 * 지금 무엇을 하는 중인지 서버에 알린다.
 *
 * 화면 문구가 고정이면 30~40초 동안 멈춘 것처럼 보인다. 무엇을 하는 중인지는
 * 여기서만 알 수 있으므로 도구를 부를 때마다 흘려준다.
 *
 * **문장은 서버가 만든다** — 여기서는 도구 이름만 보낸다. 표현을 고칠 때마다
 * 회사 PC를 만져야 한다면 문구는 영영 안 고쳐진다.
 *
 * 실패해도 답변은 막지 않는다. 다만 조용히 넘기지는 않는다 — 진행 표시가 통째로
 * 죽어 있어도 모르면 그게 다음 진단을 막는다.
 */
async function reportStage(id, payload) {
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) console.error(`[assistant] 단계 보고 ${res.status}`);
  } catch (e) {
    console.error(`[assistant] 단계 보고 실패: ${e.message}`);
  }
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
      "운영부 일정을 기간으로 조회한다. 휴가·당직·회의·마감 등 '누가 언제 무엇을 하는지'는 볼트 문서가 아니라 이 도구로 확인한다. 응답의 backupAbsences 는 **일정에 등록되지 않은 부재**를 백업요청에서 찾은 것이다 — 휴가자를 물으면 events 의 leave 와 backupAbsences 를 **합쳐서** 답하고, 후자는 '백업요청 기준'이라고 밝힌다.",
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
    tool(
      "read_file",
      "Teams·SharePoint 에 올라온 파일(Word·PowerPoint·Excel·PDF)을 읽을 수 있게 내려받는다. **볼트 문서가 아닌 파일**을 지식망에 넣어달라는 요청에 쓴다. 돌려주는 경로를 Read 로 열어 내용을 확인하고, 파일에 있는 내용만 쓴다. 표가 많은 파일이면 요약하지 말고 어떤 표가 무엇을 담는지와 원본 링크를 적는다.",
      {
        url: z
          .string()
          .describe("SharePoint·Teams 파일 링크. 사용자가 붙여넣은 것을 그대로 넘긴다"),
      },
      async ({ url }) => {
        const res = await fetchWithTimeout(
          `${BASE}/api/assistant/tools/read-file`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          return {
            content: [
              { type: "text", text: `파일을 못 받았습니다: ${body.error ?? res.status}` },
            ],
            isError: true,
          };
        }

        // 서버는 Graph 의 짧게 사는 주소만 준다 — 내려받기는 여기서 한다.
        // 우편물 판독과 같은 구조다(파일은 임시 폴더에 두고 Read 로 연다).
        try {
          const file = await fetchWithTimeout(body.downloadUrl, {});
          if (!file.ok) throw new Error(`내려받기 ${file.status}`);
          const dir = await mkdtemp(join(tmpdir(), "ops-knowledge-"));
          // 확장자를 pdf 로 둔다 — 서버가 어떤 형식이든 PDF 로 바꿔 준다.
          const path = join(dir, "file.pdf");
          await writeFile(path, Buffer.from(await file.arrayBuffer()));
          return {
            content: [
              {
                type: "text",
                text: `${body.name} 을 내려받았습니다. Read 로 여세요: ${path}\n원본 링크: ${body.webUrl}`,
              },
            ],
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: `내려받기 실패: ${e.message}` }],
            isError: true,
          };
        }
      },
    ),
    tool(
      "report_gap",
      "질문에 완전히 답하지 못했을 때 무엇이 없어서 못 했는지 남긴다. 충분히 답했으면 부르지 않는다.",
      {
        kind: z
          .enum(["missing", "shallow", "tool"])
          .describe(
            "missing=주제 자체가 볼트에 없음 / shallow=문서는 있는데 물어본 층위가 없음 / tool=문서가 아니라 시스템 데이터가 필요",
          ),
        topic: z
          .string()
          .describe("빠진 지식의 주제. 짧고 일반적으로(예: '휴가 등록 절차')"),
        note: z.string().optional().describe("무엇이 어떻게 부족했는지 한두 문장"),
        nearPaths: z
          .array(z.string())
          .optional()
          .describe("shallow일 때 근처까지 간 볼트 문서 경로"),
      },
      async ({ kind, topic, note, nearPaths }) => {
        const res = await fetchWithTimeout(`${BASE}/api/assistant/tools/gap`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            topic,
            note,
            nearPaths,
            // 질문·요청자는 폴러가 안다 — 모델이 옮겨 적다 틀리게 두지 않는다.
            question: current.question,
            requestId: current.id,
            operatorEmail: current.operator_email,
          }),
        });
        const body = await res.json();
        if (!res.ok || !body.ok) {
          return {
            content: [{ type: "text", text: `기록 실패: ${body.error ?? res.status}` }],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: "기록했습니다." }] };
      },
    ),
    tool(
      "search_ops",
      "운영 데이터를 검색한다. 인수인계·사고·TIP·백업요청·연락처·서비스·지식망을 한 번에 훑는다. 볼트 문서에 없는 '실제로 무엇이 적혀 있나'는 이 도구로 확인한다.",
      {
        q: z.string().describe("검색어. 질문 그대로보다 핵심 낱말이 낫다"),
      },
      async ({ q }) => {
        // 요청자를 서버가 확인한다 — 없는 사람·비활성·viewer는 403이다.
        if (!current.operator_email) {
          return {
            content: [{ type: "text", text: "요청자 정보가 없어 검색할 수 없습니다." }],
            isError: true,
          };
        }
        const qs = new URLSearchParams({ q, as: current.operator_email });
        const res = await fetchWithTimeout(
          `${BASE}/api/assistant/tools/search?${qs}`,
          { headers },
        );
        const body = await res.json();
        if (!res.ok || !body.ok) {
          return {
            content: [
              { type: "text", text: `검색 실패: ${body.error ?? res.status}` },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(body.sources) }],
        };
      },
    ),
    tool(
      "fetch_ops",
      "search_ops로 찾은 레코드의 **전문**을 읽는다. 검색은 앞부분 발췌만 주므로, 내용을 문서로 옮기거나 자세히 답해야 하면 이 도구로 전체를 읽는다.",
      {
        domain: z
          .enum([
            "handover",
            "incident",
            "ai-tip",
            "backup",
            "contact",
            "service",
            "knowledge",
          ])
          .describe("search_ops 결과의 domain 값을 그대로"),
        id: z.string().describe("search_ops 결과의 id 값을 그대로"),
      },
      async ({ domain, id }) => {
        if (!current.operator_email) {
          return {
            content: [{ type: "text", text: "요청자 정보가 없어 읽을 수 없습니다." }],
            isError: true,
          };
        }
        const qs = new URLSearchParams({
          domain,
          id,
          as: current.operator_email,
        });
        const res = await fetchWithTimeout(
          `${BASE}/api/assistant/tools/fetch?${qs}`,
          { headers },
        );
        const body = await res.json();
        if (!res.ok || !body.ok) {
          return {
            content: [
              { type: "text", text: `전문 조회 실패: ${body.error ?? res.status}` },
            ],
            isError: true,
          };
        }
        const text = body.empty
          ? `${body.title}: 본문이 비어 있습니다(작성되지 않음).`
          : `# ${body.title}\n\n${body.body}`;
        return { content: [{ type: "text", text }] };
      },
    ),
    tool(
      "propose_doc",
      "지식망에 넣을 문서 초안을 `제안/` 폴더에 만든다. 본 위치에는 못 쓴다 — 사람이 검토해서 옮긴다. 내용을 지어내지 말고, 근거가 있는 것만 쓴다. **분류는 시스템이 정하므로 사용자에게 묻지 않는다.**",
      {
        title: z.string().describe("문서 제목. 그대로 파일명이 된다"),
        sourceDomain: z
          .enum([
            "handover",
            "incident",
            "service",
            "contact",
            "backup",
            "ai-tip",
            "knowledge",
          ])
          .optional()
          .describe(
            "이 문서의 근거가 된 운영 데이터 출처(search_ops/fetch_ops의 domain). 주면 분류를 시스템이 정한다 — 사용자에게 묻지 마라",
          ),
        category: z
          .enum([
            "개념",
            "플레이북",
            "규칙",
            "결정",
            "오류사례",
            "엔티티",
            "프로젝트",
          ])
          .optional()
          .describe("sourceDomain이 없을 때만 쓴다"),
        body: z.string().describe("마크다운 본문. frontmatter는 붙이지 않는다"),
        replace: z
          .boolean()
          .optional()
          .describe(
            "같은 이름의 초안을 덮어쓴다. 사람이 '고쳐줘'라고 했을 때만 true — 남이 검토 중인 초안을 갈아엎지 않는다",
          ),
      },
      async ({ title, category, body, sourceDomain, replace }) => {
        try {
          const path = resolveProposalPath(VAULT, title);
          // 분류는 백단에서 정한다 — 모델이 매번 고르면 같은 종류가 흩어진다.
          const resolved = resolveProposalCategory(sourceDomain ?? null, category ?? "");
          const front = [
            "---",
            `title: ${title}`,
            `category: ${resolved}`,
            `updated: ${new Date().toISOString().slice(0, 10)}`,
            `owner: ${current.operator_email ?? ""}`,
            // 분류를 누가 정했나 — 사람 판정이 몇 건인지 세려면 남아 있어야 한다.
            `classified_by: ${classifiedBy(sourceDomain ?? null)}`,
            "related: []",
            "---",
            "",
          ].join("\n");
          // 기본은 실패다 — 사람이 검토 중인 초안을 갈아엎지 않는다.
          // 고쳐달라고 한 경우만 덮는다(replace).
          await writeFile(path, front + body, {
            encoding: "utf8",
            flag: replace ? "w" : "wx",
          });

          return {
            content: [
              {
                type: "text",
                text: `제안/${title}.md 를 만들었습니다 (분류: ${resolved}).`,
              },
            ],
          };
        } catch (e) {
          const msg =
            e?.code === "EEXIST"
              ? `제안/${title}.md 가 이미 있습니다. 다른 제목을 쓰거나 사람에게 확인하세요.`
              : `초안 작성 실패: ${e?.message ?? e}`;
          return { content: [{ type: "text", text: msg }], isError: true };
        }
      },
    ),
    tool(
      "promote_doc",
      "검토를 마친 `제안/` 초안을 본 위치로 옮긴다. **사람이 내용을 보고 '옮겨줘'라고 했을 때만 부른다** — 초안을 만들자마자 이어서 부르지 마라. 본 위치에 같은 이름이 있으면 덮어쓰므로, 덮는다는 사실을 먼저 알리고 동의를 받는다.",
      {
        proposalPath: z
          .string()
          .describe("옮길 초안 경로. `제안/파일명.md` 형태여야 한다"),
        category: z
          .enum([
            "개념",
            "플레이북",
            "규칙",
            "결정",
            "오류사례",
            "엔티티",
            "프로젝트",
          ])
          .describe("옮길 폴더. 초안 frontmatter의 category를 그대로 쓴다"),
      },
      async ({ proposalPath, category }) => {
        try {
          const { from, to, toRel } = resolvePromotion(
            VAULT,
            proposalPath,
            category,
          );
          // 덮어쓰는지 먼저 안다 — 답에 그대로 적어 사람이 알아채게 한다.
          const overwrote = existsSync(to);
          await rename(from, to);
          return {
            content: [
              {
                type: "text",
                text: overwrote
                  ? `${toRel} 를 덮어썼습니다.`
                  : `${toRel} 로 옮겼습니다.`,
              },
            ],
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: `옮기지 못했습니다: ${e?.message ?? e}` }],
            isError: true,
          };
        }
      },
    ),
  ],
});

/**
 * 지금 처리 중인 요청. report_gap 도구가 질문·요청자를 여기서 읽는다 —
 * 모델이 프롬프트에서 옮겨 적게 하면 틀리거나 잘린다.
 */
let current = { id: null, question: "", operator_email: null };

/** 볼트를 cwd로 Claude를 돌린다. 답과 쓴 도구를 그대로 돌려준다(해석은 서버가). */
async function answerWithVault(prompt, onStage) {
  const uses = [];
  /**
   * 텍스트 블록을 순서대로 모은다.
   *
   * m.result 는 **마지막 텍스트 블록만** 담는다 — 도구를 부르기 전에 쓴 답은
   * 버려진다. 실제로 그래서 "위 갭은 기록해 두었습니다." 같은 15자짜리 답이
   * 운영자에게 나갔다(2026-08-19, 5건). 앞에 있던 진짜 답이 통째로 사라진 것이다.
   */
  const texts = [];
  let result = "";
  let usage = null;
  let totalCostUsd = null;
  let numTurns = null;
  let modelUsage = null;
  // 3분 상한은 abortController로 건다. run.interrupt()는 **도구가 응답을 안 준
  // 상태에서 부르면** SDK가 `[ede_diagnostic] ... stop_reason=tool_use` 라는
  // 진단 문자열을 던진다 — 운영자에게 그대로 보이면 아무 뜻이 없다.
  // (2026-08-17 재현: 끝나지 않는 도구 + interrupt → 그 문구, + abort → "aborted by user")
  const ac = new AbortController();
  let timedOut = false;
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
      abortController: ac,
    },
  });

  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, TIMEOUT_MS);
  try {
    for await (const m of run) {
      if (m.type === "assistant") {
        for (const b of m.message.content ?? []) {
          if (b.type === "tool_use") {
            uses.push({ name: b.name, input: b.input });
            // 기다리지 않는다 — 진행 표시가 답을 늦추면 주객이 뒤바뀐다.
            void onStage?.({ tool: { name: b.name, input: b.input } });
          }
          // 도구를 부르기 전에 나온 텍스트도 답의 일부다.
          if (b.type === "text" && b.text.trim()) {
            texts.push(b.text.trim());
            // 도구를 쓴 뒤 나온 텍스트 = 답을 쓰기 시작했다는 뜻.
            if (uses.length > 0) void onStage?.({ phase: "composing" });
          }
        }
      }
      if (m.type === "result") {
        result = m.result ?? "";
        // SDK 가 여기에 실어 보내는데 그동안 버리고 있었다. 서버가 이걸로
        // "이 에이전트가 얼마나 쓰는가"에 답한다.
        usage = m.usage ?? null;
        totalCostUsd = m.total_cost_usd ?? null;
        numTurns = m.num_turns ?? null;
        // **판정은 서버가 한다.** 여기서 첫 키를 집었더니 haiku(2%)가 대표로 뽑혀
        // opus(98%)로 도는 걸 haiku 로 보이게 했다(2026-08-31). 통째로 넘긴다.
        modelUsage = m.modelUsage ?? null;
      }
    }
  } catch (e) {
    // 사유를 사람 말로 바꿔 보고한다 — 화면에 그대로 뜨는 문장이다.
    if (timedOut) throw new Error("3분을 넘겨 중단했습니다");
    throw e;
  } finally {
    clearTimeout(timer);
  }

  // 모은 것이 있으면 그걸 쓴다. result 는 보통 마지막 블록이라 texts 에 이미 들어
  // 있어 중복되지 않는다. 아무 블록도 없었으면(도구만 쓰고 끝난 경우) result 로 받는다.
  const answer = texts.length > 0 ? texts.join("\n\n") : result;
  return { answer, toolUses: uses, usage, totalCostUsd, numTurns, modelUsage };
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

// 살아있음을 1분마다 남긴다 — 큐가 조용하면 이게 생사의 유일한 증거다.
startHeartbeat({ baseUrl: BASE, secret: SECRET, pollerId: "assistant" });

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
  current = {
    id: req.id,
    question: req.question,
    operator_email: req.operator_email,
  };
  const t0 = Date.now();
  try {
    // claim 직후 = 에이전트가 막 돌기 시작한 시점. 이전 문구는 "보냈습니다"였는데
    // 그때 이미 돌고 있었으므로 실제 상태와 어긋났다.
    void reportStage(req.id, { phase: "start" });
    const { answer, toolUses, usage, totalCostUsd, numTurns, modelUsage } =
      await answerWithVault(req.prompt, (p) =>
      reportStage(req.id, p),
    );
    if (!answer) throw new Error("빈 응답");
    await report(req.id, true, {
      answer,
      toolUses,
      usage,
      totalCostUsd,
      numTurns,
      modelUsage,
    });
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
