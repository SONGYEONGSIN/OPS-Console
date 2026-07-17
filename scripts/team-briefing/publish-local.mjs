// 주간 브리핑 로컬 발행기 — 상시 맥 launchd가 매주 금 10:00 실행.
//
// 흐름: GET /api/team-briefing/draft(서버 집계) → claude -p 스토리 생성
//   → POST /api/team-briefing/publish(발행 + Teams 티저).
// claude 실패/파싱 실패 시 수치 요약 폴백으로 발행한다 (발행은 항상 성공).
//
// 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL.
// 실행: node scripts/team-briefing/publish-local.mjs [--dry]  (--dry는 스토리만 출력)
// 등록: scripts/team-briefing/README.md 참조 (launchd plist).
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  buildStoryPrompt,
  parseStoryJson,
  fallbackStory,
} from "./story-lib.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
// process.env가 .env.local보다 우선 — launchd EnvironmentVariables/일회성 오버라이드용
const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? env.OPS_CONSOLE_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const SECRET = (process.env.CRON_SECRET ?? env.CRON_SECRET ?? "").trim();
if (!BASE || !SECRET) {
  console.error("[briefing] OPS_CONSOLE_BASE_URL / CRON_SECRET 미설정 — 종료");
  process.exit(1);
}
const dry = process.argv.includes("--dry");

// dev-control-analyze.mjs와 동일한 안전장치 — 도구 전면 차단 + repo 밖 cwd
// (프로젝트 .claude 설정 상속 방지). 프롬프트는 stdin으로 전달.
const CLAUDE_BIN =
  env.CLAUDE_BIN || (process.platform === "win32" ? "claude.cmd" : "claude");

function generateStory(payload, issueNo) {
  const prompt = buildStoryPrompt(payload, issueNo);
  try {
    const out = execFileSync(
      CLAUDE_BIN,
      ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
      {
        input: prompt,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300_000,
        shell: process.platform === "win32",
        cwd: os.tmpdir(),
      },
    );
    const story = parseStoryJson(out);
    if (story) return { story, source: "claude" };
    console.error("[briefing] claude 응답 파싱 실패 — 수치 요약 폴백 사용");
  } catch (e) {
    console.error(
      "[briefing] claude 실행 실패 — 수치 요약 폴백:",
      e?.message ?? e,
    );
  }
  return { story: fallbackStory(payload), source: "fallback" };
}

const headers = { Authorization: `Bearer ${SECRET}` };

// 1) 서버 집계 초안
const draftRes = await fetch(`${BASE}/api/team-briefing/draft`, { headers });
if (!draftRes.ok) {
  console.error(
    `[briefing] draft 실패 HTTP ${draftRes.status}: ${(await draftRes.text()).slice(0, 200)}`,
  );
  process.exit(1);
}
const draft = await draftRes.json();

// 2) 스토리 생성 (claude -p → 폴백)
const { story, source } = generateStory(draft.payload, draft.nextIssueNo);
console.log(`[briefing] 스토리(${source}): ${story.headline}`);

if (dry) {
  console.log(JSON.stringify(story, null, 2));
  process.exit(0);
}

// 3) 발행 + Teams 티저
const pubRes = await fetch(`${BASE}/api/team-briefing/publish`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ payload: { ...draft.payload, story } }),
});
const pub = await pubRes.json().catch(() => ({}));
if (!pubRes.ok || !pub.ok) {
  console.error(
    `[briefing] publish 실패 HTTP ${pubRes.status}: ${JSON.stringify(pub).slice(0, 300)}`,
  );
  process.exit(1);
}
console.log(
  `[briefing] #${pub.issueNo} 발행 완료 — ${pub.url} (Teams ${pub.sent ? "발송됨" : "발송 생략"})`,
);
