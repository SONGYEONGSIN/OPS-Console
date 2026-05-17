#!/usr/bin/env node
// 특정 시트 row의 콘텐츠 + 매칭 후보 자세히 보기
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

dotenvConfig({ path: ".env.local" });
const SHEET_ID = "1Biglnbic-a7PiovPes381ppdmymOFpQNZXQR9G63D7w";
const TARGET_GID = 917587571;
const TARGET_ROW = Number(process.argv[2] || 22); // 시트 row 번호 (헤더 포함)

const sa = JSON.parse(readFileSync(".gcp/folio-sheets-sa.json", "utf8"));
const jwt = new JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function gFetch(url) {
  const { token } = await jwt.getAccessToken();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

function norm(s) {
  return (s ?? "").replace(/\[.*?\]/g, "").replace(/[()\s/·,]+/g, "").trim();
}
function tokensOf(s) {
  const out = new Set();
  for (const w of (s ?? "").replace(/\[.*?\]/g, " ").split(/[\s/·,()]+/)) {
    const t = w.trim();
    if (t) out.add(t);
  }
  return [...out];
}

const meta = await gFetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets(properties(sheetId,title))`,
);
const sheet = meta.sheets.find((s) => s.properties.sheetId === TARGET_GID);
const title = sheet.properties.title;
const range = encodeURIComponent(`${title}!A${TARGET_ROW}:R${TARGET_ROW}`);
const data = await gFetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
);
const row = data.values[0];
const headers = [
  "대학명", "구분", "운영자", "영업자", "계약정보", "계약자료",
  "원서작업(기초)", "원서작업(생성툴)", "원서작업(사이트/페이지)",
  "원서작업(출력물)", "원서작업(경쟁률)", "원서작업(전산파일)", "원서작업(기타)",
  "전형료정산", "계산서발송", "자료제출", "학교담당자", "비고",
];

console.log(`\n=== 시트 row ${TARGET_ROW} ===`);
console.log(`대학명: ${row[0]}`);
console.log(`구분  : ${row[1]?.replace(/\n/g, " | ")}`);

console.log(`\n[14 sub-field 콘텐츠 — 인스펙터에 들어갈 내용]\n`);
for (let i = 4; i < 18; i++) {
  const v = (row[i] ?? "").trim();
  const trunc = v.length > 100 ? v.slice(0, 100) + "…" : v;
  console.log(`  ▶ ${headers[i]}: ${trunc || "(빈칸)"}`);
}

// 매칭 services
const uni = row[0].trim();
const toks = tokensOf(row[1]);
const { data: svc } = await supabase
  .from("services")
  .select("service_id, service_name")
  .eq("university_name", uni);
const scored = (svc ?? []).map((c) => {
  const target = norm(c.service_name);
  const hits = toks.filter((t) => target.includes(t)).length;
  return { c, hits };
});
scored.sort((a, b) => b.hits - a.hits);
const top = scored[0];
const tied = scored.filter((s) => s.hits === top.hits);

console.log(`\n[1:N 적용 대상 services (${tied.length}개) — 위 콘텐츠가 모두에 동일 복사됨]`);
for (const t of tied) console.log(`  ${t.c.service_id} ${t.c.service_name}`);
