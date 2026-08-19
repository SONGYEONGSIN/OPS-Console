#!/usr/bin/env node
/**
 * 레포 `.claude/` 를 훑어 도구 카탈로그를 만든다.
 *
 * 결과 파일을 **커밋한다.** Vercel 함수는 `.claude/` 를 못 읽는다 — Next 는 코드가
 * 참조하지 않는 파일을 번들에 넣지 않기 때문이다. 빌드 때 생성해 gitignore 하는
 * 방법도 있지만, 그러면 fresh clone 에서 typecheck·test 가 파일이 없어 깨진다
 * (`next-env.d.ts` 로 이미 겪은 문제다).
 *
 * 커밋하면 드리프트가 생길 수 있어 CI 가 재생성 후 diff 를 본다.
 *
 * 실행: node --experimental-strip-types scripts/scan-claude-tools.mjs
 *   `scan.ts` 를 그대로 불러 쓰려는 것이다. 파싱을 여기 복사하면 테스트가 있는
 *   쪽과 실제로 도는 쪽이 갈라진다.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { skillEntry, agentEntry, hookEntry, ruleEntry } = await import(
  join(root, "src/features/dev-tools/scan.ts")
);

const read = (p) => readFileSync(p, "utf8");
const listed = (dir) =>
  existsSync(join(root, dir)) ? readdirSync(join(root, dir)).sort() : [];

const entries = [];

// 스킬 — 폴더 안의 SKILL.md 가 본체다.
for (const folder of listed(".claude/skills")) {
  const md = join(root, ".claude/skills", folder, "SKILL.md");
  if (!existsSync(md)) continue;
  entries.push(skillEntry(folder, read(md)));
}

for (const file of listed(".claude/agents")) {
  if (!file.endsWith(".md")) continue;
  entries.push(agentEntry(file, read(join(root, ".claude/agents", file))));
}

for (const file of listed(".claude/hooks")) {
  if (!file.endsWith(".sh")) continue;
  entries.push(hookEntry(file, read(join(root, ".claude/hooks", file))));
}

for (const file of listed(".claude/rules")) {
  if (!file.endsWith(".md")) continue;
  entries.push(ruleEntry(file, read(join(root, ".claude/rules", file))));
}

const out = `// 이 파일은 생성물입니다. 직접 고치지 마세요.
// 다시 만들기: npm run tools:scan
import type { ToolEntry } from "./scan";

export const TOOL_CATALOG: readonly ToolEntry[] = ${JSON.stringify(entries, null, 2)};
`;

const target = join(root, "src/features/dev-tools/catalog.generated.ts");
writeFileSync(target, out);

const byKind = entries.reduce((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {});
console.log(`도구 ${entries.length}개 —`, JSON.stringify(byKind));
