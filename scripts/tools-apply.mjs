#!/usr/bin/env node
/**
 * 웹에서 끈 스킬을 이 PC에 실제로 반영한다.
 *
 * 웹(Vercel)은 이 PC의 파일을 만질 수 없다. `.claude/settings.local.json` 은
 * gitignore 라 배포에도 안 들어간다. 그래서 화면은 결정만 적고, 반영은 여기서 한다.
 *
 * 실행: npm run tools:apply
 *
 * 되돌리기: 화면에서 다시 켜고 이 명령을 한 번 더 돌린다. 이 스크립트는
 * `Skill(…)` 항목만 손대므로 파일의 나머지는 그대로다.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { nextDenyList } = await import(join(root, "src/features/dev-tools/apply.ts"));
const { TOOL_CATALOG } = await import(
  join(root, "src/features/dev-tools/catalog.generated.ts")
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다");
  process.exit(1);
}

const settingsPath = join(root, ".claude/settings.local.json");
if (!existsSync(settingsPath)) {
  console.error(`${settingsPath} 가 없습니다 — 이 PC에는 반영할 설정이 없습니다`);
  process.exit(1);
}

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from("dev_tool_toggles")
  .select("kind, name, enabled");
if (error) {
  console.error("토글을 못 읽었습니다:", error.message);
  process.exit(1);
}

const disabled = (data ?? [])
  .filter((t) => t.kind === "skill" && !t.enabled)
  .map((t) => t.name);

const catalogNames = TOOL_CATALOG.filter((e) => e.kind === "skill").map(
  (e) => e.name,
);

const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const before = settings.permissions?.deny ?? [];
const after = nextDenyList(before, catalogNames, disabled);

const unchanged =
  before.length === after.length && before.every((v, i) => v === after[i]);
if (unchanged) {
  console.log(`이미 반영되어 있습니다 (꺼진 스킬 ${disabled.length}개)`);
} else {
  // 이 파일이 깨지면 Claude Code 가 안 뜬다. 덮어쓰기 전에 사본을 남긴다.
  copyFileSync(settingsPath, `${settingsPath}.bak`);
  settings.permissions = { ...(settings.permissions ?? {}), deny: after };
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  console.log(
    `반영했습니다 — 꺼진 스킬 ${disabled.length}개 (이전 파일은 settings.local.json.bak)`,
  );
  if (disabled.length > 0) console.log(`  ${disabled.join(", ")}`);
}

// 언제 어느 PC에 반영했는지 남긴다. 화면이 '아직 반영 안 된 변경'을 이걸로 센다.
const machine = process.env.TOOLS_MACHINE_NAME || hostname();
const { error: logErr } = await supabase.from("dev_tool_applies").upsert(
  {
    machine,
    applied_at: new Date().toISOString(),
    disabled_count: disabled.length,
  },
  { onConflict: "machine" },
);
// 반영은 이미 끝났다. 기록 실패로 실패라고 하면 사람이 다시 돌리는데, 그때는
// '이미 반영되어 있습니다'만 나와 무엇이 문제인지 알 수 없다.
if (logErr) console.error("반영 기록 실패(반영 자체는 완료):", logErr.message);
else console.log(`기록: ${machine}`);

// 새 세션부터 적용된다 — 이걸 안 적으면 왜 지금 안 꺼지는지 알 수 없다.
console.log("Claude Code 를 새로 시작해야 적용됩니다.");
