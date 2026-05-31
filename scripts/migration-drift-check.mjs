// 마이그레이션 drift 점검 — supabase/migrations/*.sql가 생성하는 테이블이
// 운영 DB에 모두 적용돼 있는지 확인한다. 누락(미적용)이 있으면 목록 출력 + exit 1.
//
// 배경: 마이그레이션이 수동 적용이라 운영 DB가 drift할 수 있다(예: receivables 이력
// 테이블 3개 미적용으로 자동화가 조용히 실패). 매일 스케줄로 이 drift를 감시한다.
//
// 사용 (local): NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migration-drift-check.mjs
// 사용 (CI):    GitHub Actions에서 secrets로 주입 (.env.local 없으면 process.env 폴백)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envFromFile = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .reduce((acc, l) => {
        const [k, ...v] = l.split("=");
        if (k) acc[k.trim()] = v.join("=").trim();
        return acc;
      }, {})
  : {};
const env = { ...envFromFile, ...process.env };

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(
    "Missing required env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const DIR = "supabase/migrations";

/** 마이그 SQL에서 `create table [if not exists] public.<name>` 테이블명 추출. */
export function extractMigrationTables(sqlFiles) {
  const tables = new Set();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  for (const sql of sqlFiles) {
    let m;
    while ((m = re.exec(sql)) !== null) tables.add(m[1]);
  }
  return [...tables].sort();
}

const sqlFiles = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`${DIR}/${f}`, "utf8"));
const want = extractMigrationTables(sqlFiles);
console.log(`마이그레이션 테이블 ${want.length}개 점검 (운영 DB)...`);

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const missing = [];
const errored = [];
for (const t of want) {
  const { error } = await supabase
    .from(t)
    .select("*", { count: "exact", head: true });
  if (!error) continue;
  if (
    error.code === "PGRST205" ||
    /schema cache|does not exist|find the table/i.test(error.message)
  ) {
    missing.push(t);
  } else {
    errored.push(`${t}: ${error.code ?? ""} ${error.message}`);
  }
}

if (missing.length) {
  console.error(`\n✗ 운영 DB 누락 테이블 ${missing.length}개 (마이그 미적용):`);
  for (const t of missing) console.error("  -", t);
  console.error(
    "\n→ 해당 supabase/migrations/*.sql를 운영 DB에 적용하세요.",
  );
}
if (errored.length) {
  console.error(`\n⚠ 점검 실패 ${errored.length}개:`);
  for (const e of errored) console.error("  -", e);
}
if (!missing.length && !errored.length) {
  console.log(`✓ 모든 마이그레이션 테이블(${want.length})이 운영 DB에 존재합니다.`);
  process.exit(0);
}
process.exit(missing.length > 0 ? 1 : 2);
