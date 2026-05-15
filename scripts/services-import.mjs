// scripts/services-import.mjs
//
// ⚠️ DEPRECATED — 재실행 금지.
//
// 정책 결정 (2026-05-15): services 도메인의 source-of-truth는 Folio DB.
// 마이그레이션 `20260522_services_service_id_renumber.sql`로 학교키 + write_start_at 시퀀스
// 재부여 완료. 본 스크립트는 CSV 원본의 service_id를 그대로 upsert 하므로 *재실행 시
// 재부여된 service_id가 원본 값으로 덮어쓰여진다*. 운영부 Sheets는 더 이상 Folio와 동기 안 함.
//
// 신규 services row는 `/dashboard/services` "+ 신규 서비스" UI로 등록.
//
// 본 스크립트는 historical 기록(초기 import 절차 / dry-run 매칭률 도출 로직)으로만 보존.
//
// services 도메인 — Google Sheets CSV + 로컬 Excel 카테고리 dict 일회성 import.
//
// 두 소스를 service_id 기준 join:
//   - CSV (Google Sheets export, 최신본): 시트 truth — 운영자/개발자/지역/대학구분 등 모든 필드
//   - XLSX (로컬 카테고리 dict): service_id → category 매핑만 사용 (시트엔 카테고리 없음)
//
// 보안 메모: xlsx 라이브러리(0.18.5)에 HIGH CVE 2건 존재 — Prototype Pollution / ReDoS.
// 본 스크립트는 admin이 로컬에서 신뢰된 운영부 Excel 파일을 1회성 처리하는 용도라
// 위험 노출이 매우 제한적이다. 웹 요청 경로에 절대 노출하지 않는다.
//
// 사용:
//   node scripts/services-import.mjs --csv=path/to.csv --xlsx=path/to.xlsx --dry-run
//   node scripts/services-import.mjs --csv=path/to.csv --xlsx=path/to.xlsx
//
// dry-run 출력:
//   - 매칭률 (카테고리 / 운영자 / 개발자)
//   - 카테고리 unique 분포 (enum follow-up용 데이터)
//   - 누락 service_id 목록 (Excel에 카테고리 없는 행 = 거부 대상)
//   - 처음 3건 미리보기

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { parse as csvParse } from "csv-parse/sync";
import xlsx from "xlsx";

function parseArgs(argv) {
  const out = { dryRun: false, csv: null, xlsx: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg.startsWith("--csv=")) out.csv = arg.slice("--csv=".length);
    else if (arg.startsWith("--xlsx=")) out.xlsx = arg.slice("--xlsx=".length);
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

/** "2025-03-04 09:00:00" → "2025-03-04 09:00:00+09:00" (KST 명시) */
function toKstTimestamp(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/[+-]\d{2}:?\d{2}$|Z$/.test(s)) return s;
  return `${s}+09:00`;
}

/** Excel에서 service_id → category Map 추출 */
function loadCategoryDict(xlsxPath) {
  const wb = xlsx.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const dict = new Map();
  for (const r of rows) {
    const sid = Number(r["서비스ID"] ?? r["service_id"] ?? 0);
    const cat = String(r["카테고리"] ?? "").trim();
    if (sid && cat) dict.set(sid, cat);
  }
  return dict;
}

const args = parseArgs(process.argv);
if (!args.csv || !args.xlsx) {
  console.error(
    "사용: node scripts/services-import.mjs --csv=path/to.csv --xlsx=path/to.xlsx [--dry-run]",
  );
  process.exit(1);
}
if (!existsSync(args.csv)) {
  console.error(`CSV 파일 없음: ${args.csv}`);
  process.exit(1);
}
if (!existsSync(args.xlsx)) {
  console.error(`XLSX 파일 없음: ${args.xlsx}`);
  process.exit(1);
}

const env = loadEnv();
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// 1) CSV 파싱 (quote 안전)
const csvText = readFileSync(args.csv, "utf8");
const csvRows = csvParse(csvText, {
  columns: true,
  bom: true,
  trim: true,
  skip_empty_lines: true,
});
console.log(`✓ CSV parsed: ${csvRows.length} rows`);
console.log(`  headers: ${Object.keys(csvRows[0] ?? {}).join(", ")}`);

// 2) Excel 카테고리 dict 로드
const categoryDict = loadCategoryDict(args.xlsx);
console.log(`✓ XLSX category dict: ${categoryDict.size} entries`);

// 3) operators 마스터 로드
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

// 4) 행별 변환 + 카테고리 join
let matchedCategory = 0;
let unmatchedCategoryIds = [];
let matchedOperator = 0;
let unmatchedOperator = [];
let matchedDeveloper = 0;
let unmatchedDeveloper = [];
const categoryDistribution = new Map();
const records = [];
const skipped = [];

for (const r of csvRows) {
  const serviceId = Number(r["서비스ID"] ?? r["service_id"] ?? 0);
  if (!serviceId) {
    skipped.push({ row: r, reason: "service_id 누락" });
    continue;
  }

  const category = categoryDict.get(serviceId) ?? "";
  if (category) {
    matchedCategory++;
    categoryDistribution.set(
      category,
      (categoryDistribution.get(category) ?? 0) + 1,
    );
  } else {
    unmatchedCategoryIds.push(serviceId);
    skipped.push({ row: r, reason: "Excel에 카테고리 없음" });
    continue;
  }

  const operatorName = String(r["운영자"] ?? "").trim().normalize("NFC");
  const developerName = String(r["개발자"] ?? "").trim().normalize("NFC");
  const operatorEmail = nameToEmail.get(operatorName) ?? null;
  const developerEmail = nameToEmail.get(developerName) ?? null;
  if (operatorEmail) matchedOperator++;
  else if (operatorName) unmatchedOperator.push(operatorName);
  if (developerEmail) matchedDeveloper++;
  else if (developerName) unmatchedDeveloper.push(developerName);

  records.push({
    service_id: serviceId,
    application_type: String(r["접수구분"] ?? "").trim(),
    region: String(r["지역"] ?? "").trim(),
    university_name: String(r["대학명"] ?? "").trim(),
    service_name: String(r["서비스명"] ?? "").trim(),
    university_type: String(r["대학구분"] ?? "").trim(),
    category,
    operator_email: operatorEmail,
    operator_name: operatorName || null,
    developer_email: developerEmail,
    developer_name: developerName || null,
    write_start_at: toKstTimestamp(r["작성시작"]),
    write_end_at: toKstTimestamp(r["작성마감"]),
    pay_start_at: toKstTimestamp(r["결제시작"]),
    pay_end_at: toKstTimestamp(r["결제마감"]),
    solo: String(r["단독여부"] ?? "").toUpperCase() === "Y",
    source: "google_sheet_import",
    imported_at: new Date().toISOString(),
  });
}

const uniqUnmatchedOperators = [...new Set(unmatchedOperator)];
const uniqUnmatchedDevelopers = [...new Set(unmatchedDeveloper)];

console.log("");
console.log("=== 매칭 결과 ===");
console.log(`  카테고리 matched: ${matchedCategory} / ${csvRows.length}`);
console.log(`  카테고리 unmatched (skip): ${unmatchedCategoryIds.length}`);
console.log(`  운영자 matched: ${matchedOperator}`);
console.log(
  `  운영자 unmatched (unique names): ${uniqUnmatchedOperators.length}`,
);
console.log(`  개발자 matched: ${matchedDeveloper}`);
console.log(
  `  개발자 unmatched (unique names): ${uniqUnmatchedDevelopers.length}`,
);

console.log("");
console.log("=== 카테고리 분포 ===");
const sortedCats = [...categoryDistribution.entries()].sort(
  (a, b) => b[1] - a[1],
);
for (const [cat, count] of sortedCats) {
  console.log(`  ${cat}: ${count}`);
}

if (uniqUnmatchedOperators.length > 0) {
  console.log("");
  console.log("=== 매칭 실패 운영자 이름 ===");
  for (const n of uniqUnmatchedOperators) console.log(`  ${n}`);
}
if (uniqUnmatchedDevelopers.length > 0) {
  console.log("");
  console.log("=== 매칭 실패 개발자 이름 ===");
  for (const n of uniqUnmatchedDevelopers) console.log(`  ${n}`);
}

if (unmatchedCategoryIds.length > 0) {
  console.log("");
  console.log(
    `=== Excel에 카테고리 없는 service_id (${unmatchedCategoryIds.length}건, skip 대상) ===`,
  );
  console.log(`  ${unmatchedCategoryIds.slice(0, 20).join(", ")}${unmatchedCategoryIds.length > 20 ? ` ... (+${unmatchedCategoryIds.length - 20})` : ""}`);
}

console.log("");
console.log(`✓ upsert 대상: ${records.length} records (skip: ${skipped.length})`);

if (args.dryRun) {
  console.log("");
  console.log("--dry-run — DB 미변경. 처음 3건 미리보기:");
  for (const rec of records.slice(0, 3)) {
    console.log(JSON.stringify(rec, null, 2));
  }
  process.exit(0);
}

// 5) 실 upsert
console.log("");
console.log("→ DB upsert 시작...");
const { error } = await sb
  .from("services")
  .upsert(records, { onConflict: "service_id" });
if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}
console.log(`✓ upserted ${records.length} services`);
