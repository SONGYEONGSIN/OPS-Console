// scripts/services-import.mjs
//
// services 도메인 — Google Sheets CSV → Folio DB 일회성 import.
//
// 1차 PR 범위 (minimal):
// - CSV 파일 경로(--csv=path) 받기
// - 헤더 + 행 파싱 (단순 split; quote escape는 추후 csv-parse 도입 시 강화)
// - 운영자/개발자 name → operators.email 매칭 (best-effort)
// - service_role 클라이언트로 services 테이블 upsert (onConflict: 'service_id')
// - --dry-run 옵션: DB 미변경, 매칭/파싱 결과만 로그
//
// Follow-up (별도 PR):
// - csv-parse 의존성 도입 (quote, BOM, 한글 안전성)
// - xlsx 의존성 + 로컬 `서비스리스트.xlsx`에서 service_id → category 보강
// - operators 매칭 실패 행의 admin UI 정정 흐름
//
// 사용:
//   node scripts/services-import.mjs --csv=./services.csv --dry-run
//   node scripts/services-import.mjs --csv=./services.csv

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function parseArgs(argv) {
  const out = { dryRun: false, csv: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg.startsWith("--csv=")) out.csv = arg.slice("--csv=".length);
  }
  return out;
}

function loadEnv() {
  return readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .reduce((acc, l) => {
      const [k, ...v] = l.split("=");
      if (k) acc[k.trim()] = v.join("=").trim();
      return acc;
    }, {});
}

/**
 * 단순 CSV 파싱 (quote escape 미지원 — 1차 PR placeholder).
 * 한글 + comma 포함 셀이 있다면 csv-parse 도입 필요.
 */
function parseCsvNaive(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = (cols[i] ?? "").trim();
    }
    return row;
  });
  return { headers, rows };
}

const args = parseArgs(process.argv);
if (!args.csv) {
  console.error(
    "사용: node scripts/services-import.mjs --csv=path/to.csv [--dry-run]",
  );
  process.exit(1);
}
if (!existsSync(args.csv)) {
  console.error(`CSV 파일 없음: ${args.csv}`);
  process.exit(1);
}

const env = loadEnv();
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const csv = readFileSync(args.csv, "utf8");
const { headers, rows: csvRows } = parseCsvNaive(csv);
console.log(`✓ CSV parsed: ${csvRows.length} rows`);
console.log(`headers: ${headers.join(", ")}`);

// 운영자 마스터 로드
const { data: operators, error: opError } = await sb
  .from("operators")
  .select("email, name");
if (opError) {
  console.error("operators load failed:", opError.message);
  process.exit(1);
}
const nameToEmail = new Map(
  (operators ?? []).map((o) => [o.name.trim().normalize("NFC"), o.email]),
);
console.log(`✓ operators loaded: ${operators?.length ?? 0}`);

let matched = 0;
let unmatched = 0;
const records = [];
for (const r of csvRows) {
  const operatorName = (r["운영자"] ?? "").trim().normalize("NFC");
  const developerName = (r["개발자"] ?? "").trim().normalize("NFC");
  const operatorEmail = nameToEmail.get(operatorName) ?? null;
  const developerEmail = nameToEmail.get(developerName) ?? null;
  if (operatorEmail) matched++;
  else if (operatorName) unmatched++;

  records.push({
    service_id: Number(r["service_id"] ?? 0),
    application_type: r["접수구분"] ?? "",
    region: r["지역"] ?? "",
    university_name: r["대학명"] ?? "",
    service_name: r["서비스명"] ?? "",
    university_type: r["대학구분"] ?? "",
    category: r["카테고리"] ?? "",
    operator_email: operatorEmail,
    operator_name: operatorName || null,
    developer_email: developerEmail,
    developer_name: developerName || null,
    write_start_at: r["작성시작"] || null,
    write_end_at: r["작성마감"] || null,
    pay_start_at: r["결제시작"] || null,
    pay_end_at: r["결제마감"] || null,
    solo: (r["단독여부"] ?? "").toUpperCase() === "Y",
    source: "google_sheet_import",
    imported_at: new Date().toISOString(),
  });
}
console.log(`✓ parsed records: ${records.length}`);
console.log(`  matched_operators: ${matched}`);
console.log(`  unmatched_operators: ${unmatched}`);

if (args.dryRun) {
  console.log("--dry-run — DB 미변경. 처음 3건 미리보기:");
  for (const r of records.slice(0, 3)) {
    console.log(JSON.stringify(r, null, 2));
  }
  process.exit(0);
}

// 실 upsert
const { error } = await sb
  .from("services")
  .upsert(records, { onConflict: "service_id" });
if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}
console.log(`✓ upserted ${records.length} services`);
