#!/usr/bin/env node
// (참고) 가격정책 시트 usedRange — 행 수·컬럼 수·표본 행 출력. 데이터 구조 파악용.
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

const TENANT = process.env.AZURE_AD_TENANT_ID;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const SECRET = process.env.AZURE_AD_CLIENT_SECRET;
const DRIVE = process.env.SHAREPOINT_DRIVE_ID;
const ITEM = process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID;

if (!TENANT || !CLIENT_ID || !SECRET || !DRIVE || !ITEM) {
  console.error("[fatal] AZURE_AD_* / SHAREPOINT_DRIVE_ID / SHAREPOINT_ASSIGNMENTS_ITEM_ID 환경 변수 누락");
  process.exit(1);
}

const SHEET = process.argv[2] || "(참고) 가격정책";

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const r = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!r.ok) throw new Error(`token ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function main() {
  const token = await getToken();
  const enc = encodeURIComponent(SHEET);
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE}/items/${ITEM}/workbook/worksheets('${enc}')/usedRange(valuesOnly=true)?$select=text,rowCount,columnCount`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    console.error(`[fail] ${r.status}`, (await r.text()).slice(0, 400));
    process.exit(1);
  }
  const data = await r.json();
  const rows = data.text ?? [];
  console.log(`[sheet] "${SHEET}"`);
  console.log(`[rows] ${data.rowCount}  [cols] ${data.columnCount}`);
  console.log(`\n[행별 비어있지 않은 첫 셀 + 길이] (행 번호 0-base)`);
  rows.forEach((row, i) => {
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "").length;
    const firstNonEmpty = row.find((c) => String(c ?? "").trim() !== "") ?? "";
    const trunc = String(firstNonEmpty).length > 80
      ? String(firstNonEmpty).slice(0, 80) + "…"
      : firstNonEmpty;
    console.log(`  [${String(i).padStart(3, " ")}] non-empty=${String(nonEmpty).padStart(2, " ")} | first: ${trunc}`);
  });

  console.log(`\n[전체 행 cell dump]`);
  rows.forEach((row, i) => {
    console.log(`\n--- row ${i} ---`);
    row.forEach((c, j) => {
      const v = String(c ?? "");
      if (v.trim() === "") return;
      const t = v.length > 80 ? v.slice(0, 80) + "…" : v;
      console.log(`  col[${j}]: ${t}`);
    });
  });
}

main().catch((e) => {
  console.error("[fatal]", e.message);
  process.exit(1);
});
