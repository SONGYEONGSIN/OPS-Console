#!/usr/bin/env node
// incidents 시트 import — Google Sheets API 직접 fetch. PR-7.
// 실행:
//   DRY_RUN=true node scripts/incidents-import.mjs   # 검증 (insert 없음)
//   node scripts/incidents-import.mjs                # 실제 insert
//
// .env.local 필수:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (Supabase)
//   GOOGLE_SERVICE_ACCOUNT_JSON_PATH                    (예: .gcp/folio-sheets-sa.json)
//   INCIDENTS_SHEET_ID                                  (시트 ID)
//   INCIDENTS_SHEET_TAB_NAME                            (탭 이름, e.g. "2025학년도")

import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

dotenvConfig({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GCP_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
const SHEET_ID = process.env.INCIDENTS_SHEET_ID;
const SHEET_TAB = process.env.INCIDENTS_SHEET_TAB_NAME;
const DRY_RUN = process.env.DRY_RUN === "true";
const YEAR = 2025;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[fatal] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요 — .env.local 확인",
  );
  process.exit(1);
}
if (!GCP_KEY_PATH || !SHEET_ID || !SHEET_TAB) {
  console.error(
    "[fatal] GOOGLE_SERVICE_ACCOUNT_JSON_PATH / INCIDENTS_SHEET_ID / INCIDENTS_SHEET_TAB_NAME 필요 — .env.local 확인",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// PR-6 reporter 매핑과 동일
const REPORTER_BY_DEPARTMENT = {
  "운영부-운영1팀": { email: "alcure23@jinhakapply.com", name: "허승철" },
  "운영부-운영2팀": { email: "ys1114@jinhakapply.com", name: "송영신" },
};

// 14개 카테고리 — page.tsx CATEGORY_SUGGESTIONS와 동기. PIMS는 별도 처리(app_type).
const CATEGORY_CANON = new Set([
  "사이트",
  "원서작성",
  "유의사항",
  "전산파일",
  "추천서",
  "출력물",
  "전형료",
  "결제",
  "경쟁률",
  "수험번호",
  "로그인/회원가입",
  "기타",
]);

function canonicalCategory(raw) {
  const c = (raw ?? "").trim();
  // SMS / 알림톡 → 단일화
  if (c === "SMS" || c === "알림톡") return "SMS/알림톡";
  // PIMS는 분류 컬럼에 있어도 카테고리 아님 (app_type으로 이동) — 호출 측에서 별도 분기
  if (CATEGORY_CANON.has(c)) return c;
  return "기타";
}

// 시트 분류='PIMS'면 app_type='PIMS' (구분으로 이동)
function isPimsCategory(raw) {
  return (raw ?? "").trim() === "PIMS";
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
 * Google Sheets API fetch — service account 인증.
 * 응답: { range, majorDimension, values: [[col1, col2, ...], ...] }
 * values[0] = header, values[1..] = data rows.
 */
async function fetchSheetRows() {
  const credentials = JSON.parse(readFileSync(GCP_KEY_PATH, "utf8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:Z`, // 전체 컬럼 — header에서 실제 사용 컬럼 자동 매핑
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const values = res.data.values ?? [];
  if (values.length < 2) {
    throw new Error("sheet has no data rows");
  }
  const header = values[0].map((s) => String(s ?? "").trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const cells = values[i] ?? [];
    const row = {};
    header.forEach((h, idx) => {
      row[h] = cells[idx] != null ? String(cells[idx]) : "";
    });
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
  const title = (sheetRow["요약"] ?? "").trim();
  const rawCategory = (sheetRow["분류"] ?? "").trim();
  const universityRaw = (sheetRow["대학교"] ?? "").trim();
  const university_name = universityRaw || null; // 빈 값은 null 허용
  if (!title) return { skip: "필수 누락: title" };
  if (!rawCategory) return { skip: "필수 누락: category" };

  const assigneeName = (sheetRow["담당자"] ?? "").trim();
  if (!assigneeName) return { skip: "필수 누락: 담당자" };
  const assignee = opsMap.get(assigneeName);
  // assignee 매칭 실패(타 부서 / 퇴사자) — null + default 운영1팀
  const team = assignee?.team ?? "운영1팀";
  const department =
    team === "운영2팀" ? "운영부-운영2팀" : "운영부-운영1팀";
  const reporter = REPORTER_BY_DEPARTMENT[department];

  // 분류=PIMS → app_type='PIMS' + category='기타'
  const isPims = isPimsCategory(rawCategory);
  const app_type = isPims ? "PIMS" : "공통원서";
  const category = isPims ? "기타" : canonicalCategory(rawCategory);

  return {
    payload: {
      year: YEAR,
      university_name,
      app_type,
      category,
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
  console.log(`[sheet] fetching ${SHEET_TAB} via Google Sheets API...`);

  const sheetRows = await fetchSheetRows();
  console.log(`[sheet] ${sheetRows.length} rows fetched`);

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
