// scripts/inspect-contracts.mjs
//
// SharePoint 계약서 Excel 다중 시트 구조 일회성 분석.
//
// 목적 (PR-1 T1):
// - 시트 이름 list (4년제 / 2년제 / 대학원 / ... / 기타)
// - 각 시트 헤더 + 샘플 3행 fetch
// - 결과를 stdout에 출력 → plan에 최소 노출 컬럼 명세 반영
//
// 사용:
//   node scripts/inspect-contracts.mjs
//
// 환경변수:
//   AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET
//   SHAREPOINT_DRIVE_ID / SHAREPOINT_CONTRACTS_ITEM_ID

import { readFileSync } from "node:fs";

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

async function getGraphToken(env) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AZURE_AD_CLIENT_ID,
    client_secret: env.AZURE_AD_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`[token] ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function listWorksheets(token, driveId, itemId) {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`[worksheets] ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.value.map((w) => ({ id: w.id, name: w.name, position: w.position }));
}

async function fetchSheetSample(token, driveId, itemId, sheetName) {
  const encoded = encodeURIComponent(sheetName);
  // usedRange 전체에서 text only — 첫 5행만 client-side에서 자른다.
  // Excel 큰 시트는 usedRange가 무거우므로 ?$select=text로 raw value 회피.
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encoded}')/usedRange?$select=text,rowCount,columnCount`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return {
      sheetName,
      error: `${res.status}: ${(await res.text()).slice(0, 200)}`,
    };
  }
  const json = await res.json();
  const text = json.text ?? [];
  return {
    sheetName,
    rowCount: json.rowCount,
    columnCount: json.columnCount,
    firstRows: text.slice(0, 5),
  };
}

const env = loadEnv();
const required = [
  "AZURE_AD_TENANT_ID",
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "SHAREPOINT_DRIVE_ID",
  "SHAREPOINT_CONTRACTS_ITEM_ID",
];
const missing = required.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error(`[env] 누락: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("✓ env 로드 완료");
const token = await getGraphToken(env);
console.log("✓ Graph token 발급");

const sheets = await listWorksheets(
  token,
  env.SHAREPOINT_DRIVE_ID,
  env.SHAREPOINT_CONTRACTS_ITEM_ID,
);
console.log(`\n✓ 시트 ${sheets.length}개 발견:`);
for (const s of sheets) {
  console.log(`  - [${s.position}] ${s.name}`);
}

console.log("\n========================================");
console.log("시트별 샘플 (헤더 + 첫 4행)");
console.log("========================================\n");

for (const s of sheets) {
  const sample = await fetchSheetSample(
    token,
    env.SHAREPOINT_DRIVE_ID,
    env.SHAREPOINT_CONTRACTS_ITEM_ID,
    s.name,
  );
  console.log(`■ ${s.name}`);
  if (sample.error) {
    console.log(`  ERROR: ${sample.error}\n`);
    continue;
  }
  console.log(`  rowCount=${sample.rowCount}, columnCount=${sample.columnCount}`);
  for (let i = 0; i < sample.firstRows.length; i++) {
    const label = i === 0 ? "header" : `row ${i}`;
    const cells = sample.firstRows[i].map((c) => `"${c}"`).join(" | ");
    console.log(`  [${label}] ${cells}`);
  }
  console.log("");
}
