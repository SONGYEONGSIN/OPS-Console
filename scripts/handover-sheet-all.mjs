#!/usr/bin/env node
// handover 시트 전수 → 대학명+구분 distinct + services 매칭 후보 출력 (dry-run)
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

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
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function gFetch(url) {
  const { token } = await jwt.getAccessToken();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function norm(s) {
  // 공백/구분자 전부 제거 — substring 매칭용
  return (s ?? "")
    .replace(/\[.*?\]/g, "")
    .replace(/[()\s/·,]+/g, "")
    .trim();
}

function tokensOf(s) {
  // sheet의 multi-line 구분을 의미 단위로 분할 (space/줄바꿈/구분자 기준)
  // 각 token은 substring 매칭에 사용
  const out = new Set();
  for (const word of (s ?? "")
    .replace(/\[.*?\]/g, " ")
    .split(/[\s/·,()]+/)) {
    const w = word.trim();
    if (w) out.add(w);
  }
  return [...out];
}

async function main() {
  const meta = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets(properties(sheetId,title))`,
  );
  const sheet = meta.sheets.find((s) => s.properties.sheetId === TARGET_GID);
  const title = sheet.properties.title;
  const range = encodeURIComponent(`${title}!A1:R200`);
  const data = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
  );
  const all = data.values ?? [];
  const header = all[0];
  const rows = all.slice(1).filter((r) => r[0] && r[0].trim());
  console.log(`[sheet] ${rows.length} data rows (헤더 제외)`);
  console.log(`\n[대학명+구분 distinct]`);
  for (let i = 0; i < rows.length; i++) {
    const uni = rows[i][0];
    const div = (rows[i][1] ?? "").replace(/\n/g, " | ");
    console.log(`  row ${i + 2}: ${uni} / ${div}`);
  }

  // services 페치 (시트 대학명 distinct)
  const unis = [...new Set(rows.map((r) => r[0].trim()))];
  console.log(`\n[대학 distinct] ${unis.length}: ${unis.join(", ")}`);

  const svcByUni = new Map();
  for (const uni of unis) {
    const { data: svc } = await supabase
      .from("services")
      .select("id, service_id, university_name, service_name")
      .eq("university_name", uni);
    svcByUni.set(uni, svc ?? []);
  }

  console.log(`\n[매칭 결과]`);
  let exactCnt = 0;
  let multiCnt = 0;
  let zeroCnt = 0;
  for (let i = 0; i < rows.length; i++) {
    const uni = rows[i][0].trim();
    const divRaw = rows[i][1] ?? "";
    const candidates = svcByUni.get(uni) ?? [];
    const toks = tokensOf(divRaw);
    const scored = candidates.map((c) => {
      const target = norm(c.service_name);
      const hits = toks.filter((t) => target.includes(t)).length;
      return { c, hits };
    });
    scored.sort((a, b) => b.hits - a.hits);
    const top = scored[0];
    const second = scored[1];
    const isExact =
      top && top.hits > 0 && (!second || top.hits > second.hits);
    const divLabel = divRaw.replace(/\n/g, " | ").slice(0, 60);
    if (isExact) {
      exactCnt++;
      console.log(
        `  ✓ row${i + 2} ${uni} [${divLabel}] → ${top.c.service_id} ${top.c.service_name} (${top.hits}/${toks.length})`,
      );
    } else if (top && top.hits > 0) {
      multiCnt++;
      console.log(
        `  ? row${i + 2} ${uni} [${divLabel}] → 동점 다수 (top hit ${top.hits}):`,
      );
      for (const s of scored.slice(0, 3)) {
        if (s.hits === top.hits)
          console.log(`      ${s.c.service_id} ${s.c.service_name}`);
      }
    } else {
      zeroCnt++;
      console.log(`  ✗ row${i + 2} ${uni} [${divLabel}] → 매칭 0`);
    }
  }

  console.log(
    `\n[요약] 단일 매칭 ${exactCnt} / 동점 다수 ${multiCnt} / 0매칭 ${zeroCnt} / 합계 ${rows.length}`,
  );
}

main().catch((e) => {
  console.error("[fatal]", e.message);
  process.exit(1);
});
