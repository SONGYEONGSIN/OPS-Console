#!/usr/bin/env node
// handover sheet probe — gid=917587571 탭의 헤더+첫 3행을 가져와 컬럼 매핑 결정용.
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

dotenvConfig({ path: ".env.local" });

const SHEET_ID = "1Biglnbic-a7PiovPes381ppdmymOFpQNZXQR9G63D7w";
const TARGET_GID = 917587571;
const SA_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || ".gcp/folio-sheets-sa.json";

const sa = JSON.parse(readFileSync(SA_PATH, "utf8"));
const jwt = new JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function gFetch(url) {
  const { token } = await jwt.getAccessToken();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const meta = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets(properties(sheetId,title,gridProperties))`,
  );
  const sheet = meta.sheets.find((s) => s.properties.sheetId === TARGET_GID);
  if (!sheet) {
    console.error("[fatal] gid=", TARGET_GID, "탭 없음. 전체 탭:");
    meta.sheets.forEach((s) =>
      console.error("  ", s.properties.sheetId, s.properties.title),
    );
    process.exit(1);
  }
  const title = sheet.properties.title;
  const rowCount = sheet.properties.gridProperties.rowCount;
  console.log(`[tab] "${title}" (${rowCount} rows)`);

  // 첫 5행 가져오기 (헤더 + 샘플 4행)
  const range = encodeURIComponent(`${title}!A1:Z5`);
  const data = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
  );
  const rows = data.values ?? [];
  if (rows.length === 0) {
    console.log("[empty] 빈 시트");
    return;
  }

  console.log(`\n[header] ${rows[0].length} columns:`);
  rows[0].forEach((h, i) => console.log(`  [${i}] ${h}`));

  console.log(`\n[sample] 4개 행 미리보기:`);
  for (let i = 1; i < Math.min(rows.length, 5); i++) {
    console.log(`\n--- row ${i} ---`);
    rows[0].forEach((h, j) => {
      const v = rows[i]?.[j] ?? "";
      const trunc = v.length > 80 ? v.slice(0, 80) + "…" : v;
      console.log(`  ${h}: ${trunc}`);
    });
  }
}

main().catch((e) => {
  console.error("[fatal]", e.message);
  process.exit(1);
});
