#!/usr/bin/env node
// incidents 시트 import — 2025학년도 운영부 row 주입. PR-7.
// 실행:
//   DRY_RUN=true node scripts/incidents-import.mjs   # 검증 (insert 없음)
//   node scripts/incidents-import.mjs                # 실제 insert
//
// 시트 캐시: scripts/incidents-sheet-cache.txt (.gitignore — Drive MCP에서 추출)

import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

dotenvConfig({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "true";
const SHEET_CACHE = "scripts/incidents-sheet-cache.txt";
const YEAR = 2025;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[fatal] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요 — .env.local 확인",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// PR-6 reporter 매핑과 동일
const REPORTER_BY_DEPARTMENT = {
  "운영부-운영1팀": { email: "alcure23@jinhakapply.com", name: "허승철" },
  "운영부-운영2팀": { email: "ys1114@jinhakapply.com", name: "송영신" },
};

const CATEGORY_CANON = new Set(["결제", "원서작성", "사이트", "경쟁률"]);
function canonicalCategory(raw) {
  const c = (raw ?? "").trim();
  return CATEGORY_CANON.has(c) ? c : "기타";
}

function canonicalStatus(raw) {
  const s = (raw ?? "").trim();
  if (s === "할 일") return "미처리";
  if (s === "처리완료" || s === "완료") return "처리완료";
  if (s === "진행중" || s === "진행 중") return "처리중";
  if (s === "보류") return "보류";
  return "미처리";
}

function parseDate(raw) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/**
 * markdown table parser — | col1 | col2 | ... |
 * 첫 2줄은 header / separator. 그 이후가 데이터 row.
 * Cell 내부에 `\|`로 escape된 파이프가 있을 가능성을 무시하고 단순 split.
 * Cell 내부 multi-line은 시트 export 시 한 줄로 합쳐졌다고 가정.
 * Header 컬럼 수와 데이터 row의 cell 수가 다르면 skip (multi-line으로 깨진 row 자동 제외).
 */
function parseSheet(text) {
  const lines = text.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 3) throw new Error("sheet table not found");

  const headerLine = lines[0];
  const header = headerLine
    .split("|")
    .slice(1, -1)
    .map((s) => s.trim());

  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split("|")
      .slice(1, -1)
      .map((s) => s.trim());
    if (cells.length !== header.length) continue;
    const row = {};
    header.forEach((h, idx) => (row[h] = cells[idx]));
    rows.push(row);
  }
  return rows;
}

async function fetchOperatorsMap() {
  const { data, error } = await supabase
    .from("operators")
    .select("email,name,team")
    .eq("status", "active");
  if (error) throw new Error("operators fetch fail: " + error.message);
  const m = new Map();
  for (const op of data ?? []) {
    if (op.name) m.set(op.name, { email: op.email, team: op.team });
  }
  return m;
}

function mapRow(sheetRow, opsMap) {
  const dept = (sheetRow["부서"] ?? "").trim();
  if (dept !== "운영부") return { skip: "non-운영부" };

  const title = (sheetRow["요약"] ?? "").trim();
  const category = (sheetRow["분류"] ?? "").trim();
  const university_name = (sheetRow["대학교"] ?? "").trim();
  if (!title) return { skip: "필수 누락: title" };
  if (!category) return { skip: "필수 누락: category" };
  if (!university_name) return { skip: "필수 누락: university_name" };

  const assigneeName = (sheetRow["담당자"] ?? "").trim();
  if (!assigneeName) return { skip: "필수 누락: 담당자" };
  const assignee = opsMap.get(assigneeName);
  // assignee 매칭 실패(퇴사자 등) — assignee_email/name은 null로 두고 import 진행 (PR-7 nullable 마이그)
  // department는 매칭 실패 시 default 운영1팀 (보고자=허승철)
  const team = assignee?.team ?? "운영1팀";
  const department =
    team === "운영2팀" ? "운영부-운영2팀" : "운영부-운영1팀";
  const reporter = REPORTER_BY_DEPARTMENT[department];

  return {
    payload: {
      year: YEAR,
      university_name,
      app_type: "공통원서",
      category: canonicalCategory(category),
      occurred_date: parseDate(sheetRow["Start date"]),
      resolved_date: parseDate(sheetRow["기한"]),
      title: title.slice(0, 200),
      cause_summary: (sheetRow["설명"] ?? "").slice(0, 5000) || null,
      root_cause: null,
      resolution: null,
      prevention: null,
      department,
      assignee_email: assignee?.email ?? null,
      assignee_name: assignee ? assigneeName : null,
      reporter_email: reporter.email,
      reporter_name: reporter.name,
      status: canonicalStatus(sheetRow["상태"]),
    },
  };
}

function printDistribution(label, items, getKey) {
  const dist = new Map();
  for (const item of items) {
    const k = getKey(item);
    dist.set(k, (dist.get(k) ?? 0) + 1);
  }
  console.log(`\n[${label}]`);
  for (const [k, v] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

async function main() {
  console.log(`[mode] ${DRY_RUN ? "DRY_RUN" : "REAL INSERT"}`);

  const sheetText = readFileSync(SHEET_CACHE, "utf8");
  const sheetRows = parseSheet(sheetText);
  console.log(`[sheet] ${sheetRows.length} rows parsed`);

  const opsMap = await fetchOperatorsMap();
  console.log(`[operators] ${opsMap.size} active`);

  const payloads = [];
  const skipReasons = [];
  for (const r of sheetRows) {
    const result = mapRow(r, opsMap);
    if (result.skip) {
      skipReasons.push(result.skip);
      continue;
    }
    payloads.push(result.payload);
  }

  console.log(`\n[mapped] ${payloads.length} payloads`);
  console.log(`[skip] ${sheetRows.length - payloads.length} rows`);
  printDistribution("skip reason", skipReasons, (s) => s);

  if (payloads.length > 0) {
    printDistribution("category", payloads, (p) => p.category);
    printDistribution("department", payloads, (p) => p.department);
    printDistribution("status", payloads, (p) => p.status);
  }

  if (DRY_RUN) {
    if (payloads.length > 0) {
      console.log("\n[DRY_RUN] sample payload (first row):");
      console.dir(payloads[0], { depth: null });
    }
    console.log("\n[DRY_RUN] 검증 끝 — 실제 insert는 DRY_RUN 없이 재실행");
    return;
  }

  if (payloads.length === 0) {
    console.log("\n[skip-all] 0 payloads — insert 안 함");
    return;
  }

  const CHUNK = 50;
  let ok = 0;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    const { error } = await supabase.from("incidents").insert(slice);
    if (error) {
      console.error(
        `[fatal] chunk ${i}~${i + slice.length - 1} insert fail:`,
        error.message,
      );
      process.exit(1);
    }
    ok += slice.length;
  }
  console.log(`\n[OK] ${ok} rows inserted into public.incidents`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
