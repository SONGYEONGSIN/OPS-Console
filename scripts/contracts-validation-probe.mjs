#!/usr/bin/env node
// Excel data validation 옵션 fetch — 계약진행현황 / 서비스여부 셀
import { config } from "dotenv";
config({ path: ".env.local" });

const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;
const ITEM_ID = process.env.SHAREPOINT_CONTRACTS_ITEM_ID;
const tenant = process.env.AZURE_AD_TENANT_ID;
const clientId = process.env.AZURE_AD_CLIENT_ID;
const secret = process.env.AZURE_AD_CLIENT_SECRET;

const tokenRes = await fetch(
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
    }),
  },
);
const { access_token } = await tokenRes.json();

// K3 (계약진행현황 컬럼 3번째 row 가정) 시작으로 4년제 시트 fetch
const sheet = "4년제";
const cells = process.argv.slice(2);
if (cells.length === 0) {
  cells.push("K3", "L3"); // 기본 후보
}
console.log(`[sheet] ${sheet}`);

for (const cell of cells) {
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook/worksheets('${encodeURIComponent(sheet)}')/range(address='${encodeURIComponent(cell)}')/dataValidation`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!r.ok) {
    console.log(`  ${cell}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    continue;
  }
  const j = await r.json();
  console.log(`\n  ${cell}:`);
  console.dir(j, { depth: 5 });
}
