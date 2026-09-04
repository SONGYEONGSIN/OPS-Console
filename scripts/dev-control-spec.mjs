// 저장된 raw_code → claude -p 명세 생성 → dev_control_specs 적재
//
// 실행: node scripts/dev-control-spec.mjs <serviceId>
//
// **수집을 다시 하지 않는다** — 원서GEN 로그인도, Moa 접속도 없다. 분석이 이미
// 걷어 둔 raw_code 를 다른 프롬프트로 다시 읽는 것뿐이다. 그래서 분석보다 훨씬 빠르고,
// 계정 잠금 위험도 없다.
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { buildSpecPrompt, parseSpecJson } from "./lib/dev-control-lib.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const serviceId = Number(process.argv[2]);
if (!serviceId) {
  console.error("[spec] serviceId 필요 — node scripts/dev-control-spec.mjs <id>");
  process.exit(1);
}

const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

/** 항목 배열이 스키마를 벗어나는 경우를 막는다 — 모델 출력이라 형태를 못 믿는다. */
function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => ({
      key: String(i?.key ?? "").trim(),
      title: String(i?.title ?? "").trim(),
      body: String(i?.body ?? "").trim(),
      included: true,
    }))
    .filter((i) => i.key && i.title);
}

/** 재생성해도 운영자가 뺀 결정은 살아남는다 — item-merge.ts 와 같은 규칙. */
function mergeItems(prev, next) {
  const byKey = new Map((prev ?? []).map((p) => [p.key, p]));
  return next.map((n) => {
    const old = byKey.get(n.key);
    return old ? { ...n, included: old.included } : n;
  });
}

const { data: analyses, error } = await sb
  .from("dev_control_analyses")
  .select("kind, raw_code, analyzed_at")
  .eq("service_id", serviceId);
if (error) {
  console.error(`[spec] 조회 실패: ${error.message}`);
  process.exit(1);
}
const files = (analyses ?? []).filter((a) => (a.raw_code ?? "").length > 0);
if (files.length === 0) {
  console.error(`[spec] ${serviceId} — 저장된 코드가 없다. 먼저 분석이 필요하다`);
  process.exit(1);
}

// 코드를 걷어 온 시각 중 **가장 이른 것**을 쓴다 — 문서 전체가 그만큼 오래됐다는 뜻이다.
const sourceAnalyzedAt = files
  .map((f) => f.analyzed_at)
  .filter(Boolean)
  .sort()[0];

console.log(`[spec] ${serviceId} — 파일 ${files.length}건으로 명세 생성`);

let out;
try {
  // 분석 스크립트와 같은 격리 — 도구 전면 차단 + 리포 밖 cwd.
  // 이 리포의 .claude 설정을 상속하면 에이전트가 Bash·git 을 승인 없이 쓴다.
  out = execFileSync(
    CLAUDE_BIN,
    ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
    {
      input: buildSpecPrompt(
        files.map((f) => ({ kind: f.kind, code: f.raw_code })),
      ),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300_000,
      shell: process.platform === "win32",
      cwd: os.tmpdir(),
    },
  );
} catch (e) {
  console.error(`[spec] claude 실패: ${e.message}`);
  process.exit(1);
}

const parsed = parseSpecJson(out);
const items = sanitizeItems(parsed?.items);
if (items.length === 0) {
  // 제어가 하나도 없다는 문서는 학교에 쓸모가 없다 — 실패로 남겨 사람이 보게 한다.
  console.error("[spec] 항목이 비었다 — 적재하지 않는다");
  process.exit(1);
}

const { data: prev } = await sb
  .from("dev_control_specs")
  .select("items")
  .eq("service_id", serviceId)
  .maybeSingle();

const merged = mergeItems(prev?.items, items);
const { error: upErr } = await sb.from("dev_control_specs").upsert(
  {
    service_id: serviceId,
    items: merged,
    source_analyzed_at: sourceAnalyzedAt ?? null,
    generated_at: new Date().toISOString(),
  },
  { onConflict: "service_id" },
);
if (upErr) {
  console.error(`[spec] 적재 실패: ${upErr.message}`);
  process.exit(1);
}

const kept = merged.filter((i) => !i.included).length;
console.log(
  `[spec] 완료 — 항목 ${merged.length}건${kept ? ` (이전 제외 ${kept}건 유지)` : ""}`,
);
