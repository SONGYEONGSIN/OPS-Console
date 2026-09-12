#!/usr/bin/env node
// AI TIP 후보 리포 메타 1회 백필 — 언어·마지막 푸시·별을 GitHub에서 다시 읽는다.
//
// 왜 1회 백필인가: 수집기는 이미 담은 리포를 구조적으로 다시 안 읽는다
// (GET /api/ai-tips/candidates 의 seen 목록 → pickNewRepos 건너뜀 → upsert
// ignoreDuplicates). 그래서 기존 행은 수집기로는 영영 안 채워진다.
//
// 자격: 레포 루트 .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//       / GITHUB_TOKEN(선택 — 없으면 시간당 60회 한도).
// 실행: node scripts/ai-tips/backfill-repo-meta.mjs [--dry]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { toRepoMetaUpdate } from "./backfill-lib.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  env.NEXT_PUBLIC_SUPABASE_URL ??
  ""
).trim();
const SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  env.SUPABASE_SERVICE_ROLE_KEY ??
  ""
).trim();
const GH_TOKEN = (process.env.GITHUB_TOKEN ?? env.GITHUB_TOKEN ?? "").trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[backfill] SUPABASE URL / SERVICE_ROLE_KEY 미설정 — 종료");
  process.exit(1);
}
const dry = process.argv.includes("--dry");

function ghHeaders() {
  const h = { accept: "application/vnd.github+json" };
  if (GH_TOKEN) h.authorization = `Bearer ${GH_TOKEN}`;
  return h;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// 필터는 repo_synced_at is null 하나뿐 — status로 좁히면 promoted·hidden 이
// 영영 빈 칸으로 남고 아무도 다시 안 본다. 같은 필터라 재실행이 멱등이다.
const { data, error } = await supabase
  .from("ai_tip_candidates")
  .select("id, repo_full_name, status, stars")
  .is("repo_synced_at", null)
  .order("collected_at", { ascending: true });
if (error) {
  console.error("[backfill] 조회 실패:", error.message);
  process.exit(1);
}
const targets = data ?? [];
const byStatus = targets.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `[backfill] 대상 ${targets.length}건 — ${JSON.stringify(byStatus)}`,
);

if (dry) {
  for (const r of targets) {
    console.log(`  ${r.status.padEnd(8)} ${r.repo_full_name} (별 ${r.stars})`);
  }
  process.exit(0);
}

let updated = 0;
const failures = [];
for (const r of targets) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${r.repo_full_name}`, {
      headers: ghHeaders(),
    });
  } catch (e) {
    failures.push({ repo: r.repo_full_name, reason: `네트워크: ${e.message}` });
    await sleep(200);
    continue;
  }
  // 403은 시간당 한도 — 계속 돌아도 전부 같은 실패다. 멈추고 건수를 보고한다.
  if (res.status === 403 || res.status === 429) {
    console.error(
      `[backfill] GitHub 한도(${res.status}) — 중단. 남은 ${targets.length - updated - failures.length}건은 재실행으로 이어간다`,
    );
    break;
  }
  const json = await res.json().catch(() => null);
  const patch = toRepoMetaUpdate(res.ok ? json : null, new Date());
  if (!patch) {
    // 404(삭제·비공개)는 그 행을 손대지 않는다 — repo_synced_at 을 적으면
    // 물어본 척이 되고, 화면이 '주 언어가 없는 리포'로 잘못 읽는다.
    failures.push({ repo: r.repo_full_name, reason: `HTTP ${res.status}` });
    await sleep(200);
    continue;
  }
  // repo_full_name 은 절대 갱신하지 않는다 — unique 제약이고, 301 리다이렉트면
  // 새 이름이 와도 메타만 옛 이름 행에 적는다.
  const { error: upErr } = await supabase
    .from("ai_tip_candidates")
    .update(patch)
    .eq("id", r.id);
  if (upErr) {
    failures.push({ repo: r.repo_full_name, reason: `update: ${upErr.message}` });
  } else {
    updated += 1;
    const moved =
      json.full_name !== r.repo_full_name ? ` (301 → ${json.full_name})` : "";
    console.log(
      `  ✓ ${r.repo_full_name} — ${patch.repo_language ?? "언어없음"} / ${patch.repo_pushed_at} / 별 ${patch.stars}${moved}`,
    );
  }
  await sleep(200);
}

console.log(`[backfill] 갱신 ${updated}건 / 실패 ${failures.length}건`);
for (const f of failures) console.log(`  ✗ ${f.repo} — ${f.reason}`);
