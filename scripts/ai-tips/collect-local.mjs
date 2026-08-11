// AI TIP 후보 수집기 — 회사 PC Windows 작업 스케줄러가 주 1회 실행.
//
// 흐름: GET /api/ai-tips/candidates(이미 본 리포) → GitHub Search → 새 리포 MAX_PER_RUN건
//   → README 발췌 → claude -p로 TIP 초안 → POST /api/ai-tips/candidates.
// claude 실패는 정상 경로 — 초안 없이 리포 정보만 보낸다.
//
// 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL / GITHUB_TOKEN(선택).
// 실행: node scripts/ai-tips/collect-local.mjs [--dry]
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  TOPICS,
  MIN_STARS,
  CREATED_WITHIN_DAYS,
  MAX_PER_RUN,
  buildSearchQuery,
  createdAfterDate,
  pickNewRepos,
  buildTipPrompt,
  parseTipDraft,
} from "./collect-lib.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? env.OPS_CONSOLE_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const SECRET = (process.env.CRON_SECRET ?? env.CRON_SECRET ?? "").trim();
const GH_TOKEN = (process.env.GITHUB_TOKEN ?? env.GITHUB_TOKEN ?? "").trim();
if (!BASE || !SECRET) {
  console.error("[ai-tips] OPS_CONSOLE_BASE_URL / CRON_SECRET 미설정 — 종료");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const authHeaders = { authorization: `Bearer ${SECRET}` };

const CLAUDE_BIN =
  env.CLAUDE_BIN || (process.platform === "win32" ? "claude.cmd" : "claude");

function ghHeaders() {
  const h = { accept: "application/vnd.github+json" };
  if (GH_TOKEN) h.authorization = `Bearer ${GH_TOKEN}`;
  return h;
}

async function fetchSeen() {
  const res = await fetch(`${BASE}/api/ai-tips/candidates`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`seen 조회 실패: ${res.status}`);
  const json = await res.json();
  return new Set(json.seen ?? []);
}

async function searchRepos(createdAfter) {
  const all = [];
  for (const topic of TOPICS) {
    // fetch 자체가 던지는 네트워크 예외(DNS·연결 리셋 등)까지 토픽 단위로 격리 —
    // 한 토픽이 죽어도 나머지 토픽 검색과 그때까지 모은 결과는 살아있어야 한다.
    try {
      const q = buildSearchQuery(topic, { minStars: MIN_STARS, createdAfter });
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;
      const res = await fetch(url, { headers: ghHeaders() });
      if (!res.ok) {
        console.error(`[ai-tips] 검색 실패(${topic}): ${res.status}`);
        continue;
      }
      const json = await res.json();
      all.push(...(json.items ?? []));
    } catch (e) {
      console.error(`[ai-tips] 검색 실패(${topic}):`, e.message);
    }
  }
  return all;
}

async function fetchReadme(fullName) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/readme`,
      { headers: { ...ghHeaders(), accept: "application/vnd.github.raw" } },
    );
    if (!res.ok) return "";
    return (await res.text()).slice(0, 8000);
  } catch {
    return "";
  }
}

function generateDraft(repo, readme) {
  try {
    const out = execFileSync(
      CLAUDE_BIN,
      ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
      {
        input: buildTipPrompt(repo, readme),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        // Windows는 .cmd를 shell 없이 직접 spawn 못 한다(EINVAL) — publish-local.mjs와 동일 처리.
        shell: process.platform === "win32",
        // 레포 밖 cwd — 프로젝트 .claude 설정 상속을 막는 기존 안전장치(team-briefing과 동일).
        cwd: os.tmpdir(),
        timeout: 180_000,
      },
    );
    return parseTipDraft(out);
  } catch (e) {
    console.error(`[ai-tips] claude 실패(${repo.repo_full_name}):`, e.message);
    return null;
  }
}

const seen = await fetchSeen();
const createdAfter = createdAfterDate(new Date(), CREATED_WITHIN_DAYS);
const items = await searchRepos(createdAfter);
const repos = pickNewRepos(items, seen, MAX_PER_RUN);
console.log(`[ai-tips] 검색 ${items.length}건 → 신규 ${repos.length}건`);

const candidates = [];
for (const repo of repos) {
  const readme = await fetchReadme(repo.repo_full_name);
  const draft = generateDraft(repo, readme);
  candidates.push({ ...repo, ...(draft ?? {}) });
  console.log(
    `[ai-tips] ${repo.repo_full_name} — 초안 ${draft ? "생성" : "실패(리포 정보만 저장)"}`,
  );
}

if (dry) {
  console.log(JSON.stringify(candidates, null, 2));
  process.exit(0);
}

const res = await fetch(`${BASE}/api/ai-tips/candidates`, {
  method: "POST",
  headers: { ...authHeaders, "content-type": "application/json" },
  body: JSON.stringify({ candidates }),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("[ai-tips] 적재 실패:", res.status, json);
  process.exit(1);
}
console.log(`[ai-tips] 적재 완료 — ${json.inserted}건`);
