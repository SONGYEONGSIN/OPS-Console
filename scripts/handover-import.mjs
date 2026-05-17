#!/usr/bin/env node
// handover 시트 → handover_records upsert
//   DRY_RUN=true node scripts/handover-import.mjs  # 매칭/payload 검증 (DB 안 건드림)
//   node scripts/handover-import.mjs               # 실제 upsert
//
// 정책:
//  - 시트 row의 (대학명, 구분) → services substring 매칭 + scoring
//  - 단일 매칭: 1 service에 upsert
//  - 동점 다수: 후보 N개 모두에 동일 콘텐츠 upsert (broad-단위 시트)
//  - 0 매칭: skip + 보고
//  - author: 송영신 (시트 작성자, hardcoded)
//  - status: 14 sub-field 모두 채워지면 ready, 아니면 draft

import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

dotenvConfig({ path: ".env.local" });

const SHEET_ID = "1Biglnbic-a7PiovPes381ppdmymOFpQNZXQR9G63D7w";
const TARGET_GID = 917587571;
const SA_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || ".gcp/folio-sheets-sa.json";
const DRY_RUN = process.env.DRY_RUN === "true";

const AUTHOR_EMAIL = "ys1114@jinhakapply.com";
const AUTHOR_NAME = "송영신";

/**
 * 시트 row 번호(헤더 포함 1-base) → service_id 명시 매핑.
 * - 자동 매칭(substring)을 override
 * - 값이 number[]면 1:N (여러 service에 동일 콘텐츠)
 * - skip하려면 빈 배열 []
 * user가 row 단위로 확인해 추가하는 매핑.
 */
const OVERRIDES = {
  3: [6007001], // 한예종 [무용원] → 제22회 KARTS 전국무용경연대회
  // row5 명지대 [대학원] → 0매칭 (services에 없음), 자동 skip
  6: [3017001, 3017002, 3017003, 3017005, 3017007, 3017012], // 한국공학대 대학원 신편입학전형 6차수
  7: [1154002, 1154003, 1154005, 1154010, 1154011, 1154014], // 항공대 순수외국인 9월·3월 (1154007 재외국민과외국인 제외)
  8: [1154001, 1154004, 1154006, 1154009], // 항공대 전교육과정해외이수자 + 북한이탈주민
  9: [1009002, 1009007, 1009012, 1009013, 1009016, 1009020], // 건국대 글로컬 외국인 학부 6차수
  10: [1102001, 1102003], // 신라대 외국인 2차수
  11: [6007007], // 한예종 무용원 2차 (row3 KARTS와 분리)
  21: [6007013, 6007014], // 한예종 영재교육원 서울 본원 + 지역캠퍼스
  22: [1098001, 1098005, 1098008, 1098012, 1098022, 1098026], // 숙명여대 Fall/Spring Admission Graduate 6건
  23: [1210009, 1210010], // 부산대 일반편입학 + 학사편입학 (1210001/007 외국인 편입학 제외)
};

// 시트 18 컬럼 헤더 인덱스 → DB sub-field
const FIELD_MAP = [
  // [컬럼 인덱스, DB 컬럼명]
  [4, "contract_info_md"], // 계약정보
  [5, "contract_data_md"], // 계약자료
  [6, "work_basic_md"], // 원서작업(기초)
  [7, "work_generator_md"], // 원서작업(생성툴)
  [8, "work_site_md"], // 원서작업(사이트/페이지)
  [9, "work_output_md"], // 원서작업(출력물)
  [10, "work_rate_md"], // 원서작업(경쟁률)
  [11, "work_file_md"], // 원서작업(전산파일)
  [12, "work_etc_md"], // 원서작업(기타)
  [13, "payment_fee_md"], // 전형료정산
  [14, "payment_invoice_md"], // 계산서발송
  [15, "docs_md"], // 자료제출
  [16, "school_contact_md"], // 학교담당자
  [17, "notes_md"], // 비고
];

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
  return (s ?? "")
    .replace(/\[.*?\]/g, "")
    .replace(/[()\s/·,]+/g, "")
    .trim();
}
function tokensOf(s) {
  const out = new Set();
  for (const word of (s ?? "").replace(/\[.*?\]/g, " ").split(/[\s/·,()]+/)) {
    const w = word.trim();
    if (w) out.add(w);
  }
  return [...out];
}

async function fetchSheetRows() {
  const meta = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets(properties(sheetId,title))`,
  );
  const sheet = meta.sheets.find((s) => s.properties.sheetId === TARGET_GID);
  if (!sheet) throw new Error(`gid=${TARGET_GID} 탭 없음`);
  const title = sheet.properties.title;
  const range = encodeURIComponent(`${title}!A1:R200`);
  const data = await gFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
  );
  const all = data.values ?? [];
  return all.slice(1).filter((r) => r[0] && r[0].trim());
}

async function fetchServicesByUni(unis) {
  const map = new Map();
  for (const uni of unis) {
    const { data, error } = await supabase
      .from("services")
      .select("id, service_id, university_name, service_name")
      .eq("university_name", uni);
    if (error) throw new Error(`services fetch fail ${uni}: ${error.message}`);
    map.set(uni, data ?? []);
  }
  return map;
}

function matchRow(sheetRow, candidates) {
  const divRaw = sheetRow[1] ?? "";
  const toks = tokensOf(divRaw);
  const scored = candidates.map((c) => {
    const target = norm(c.service_name);
    const hits = toks.filter((t) => target.includes(t)).length;
    return { svc: c, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);
  const top = scored[0];
  if (!top || top.hits === 0) return { kind: "zero", matched: [] };
  const tied = scored.filter((s) => s.hits === top.hits);
  if (tied.length === 1) return { kind: "exact", matched: [top.svc] };
  return { kind: "multi", matched: tied.map((t) => t.svc) };
}

function buildPayload(sheetRow, serviceId) {
  const payload = {
    service_id: serviceId,
    author_email: AUTHOR_EMAIL,
    author_name: AUTHOR_NAME,
  };
  let filledCount = 0;
  for (const [colIdx, dbCol] of FIELD_MAP) {
    const v = (sheetRow[colIdx] ?? "").trim();
    payload[dbCol] = v || null;
    if (v) filledCount++;
  }
  payload.status = filledCount === FIELD_MAP.length ? "ready" : "draft";
  payload.updated_at = new Date().toISOString();
  return payload;
}

async function main() {
  console.log(`[mode] ${DRY_RUN ? "DRY_RUN" : "REAL UPSERT"}`);
  const sheetRows = await fetchSheetRows();
  console.log(`[sheet] ${sheetRows.length} data rows`);

  const unis = [...new Set(sheetRows.map((r) => r[0].trim()))];
  const svcMap = await fetchServicesByUni(unis);
  console.log(`[services] ${unis.length} 대학 fetched`);

  const upserts = [];
  const skips = [];
  for (let i = 0; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    const sheetRowNum = i + 2;
    const uni = row[0].trim();
    const divLabel = (row[1] ?? "").replace(/\n/g, " | ").slice(0, 50);
    const candidates = svcMap.get(uni) ?? [];

    // OVERRIDES 우선 — service_id(number) 배열을 candidates에서 찾기
    let matched;
    if (sheetRowNum in OVERRIDES) {
      const ids = OVERRIDES[sheetRowNum];
      if (ids.length === 0) {
        skips.push(`row${sheetRowNum} ${uni} [${divLabel}] → OVERRIDE: skip`);
        continue;
      }
      matched = candidates.filter((c) => ids.includes(c.service_id));
      if (matched.length !== ids.length) {
        console.warn(
          `[warn] row${sheetRowNum} OVERRIDE 일부 service_id 미존재: 요청 ${ids} / 실제 ${matched.map((m) => m.service_id)}`,
        );
      }
    } else {
      const r = matchRow(row, candidates);
      if (r.kind === "zero") {
        skips.push(`row${sheetRowNum} ${uni} [${divLabel}] → 0매칭`);
        continue;
      }
      matched = r.matched;
    }

    for (const svc of matched) {
      upserts.push({
        meta: `row${sheetRowNum} ${uni} [${divLabel}] → ${svc.service_id} ${svc.service_name}`,
        payload: buildPayload(row, svc.id),
      });
    }
  }

  console.log(`\n[plan]`);
  console.log(`  upsert 대상: ${upserts.length} services`);
  console.log(`  skip: ${skips.length} rows`);
  for (const s of skips) console.log(`    ${s}`);

  if (DRY_RUN) {
    console.log(`\n[DRY_RUN 매칭 상세]`);
    for (const u of upserts) console.log(`  ${u.meta}`);
    console.log(`\n[DRY_RUN payload sample (첫 row)]`);
    if (upserts[0]) {
      const sample = { ...upserts[0].payload };
      for (const k of Object.keys(sample)) {
        if (typeof sample[k] === "string" && sample[k].length > 80) {
          sample[k] = sample[k].slice(0, 80) + "…";
        }
      }
      console.dir(sample, { depth: null });
    }
    return;
  }

  let ok = 0;
  for (const u of upserts) {
    const { error } = await supabase
      .from("handover_records")
      .upsert(u.payload, { onConflict: "service_id" });
    if (error) {
      console.error(`[fail] ${u.meta}: ${error.message}`);
      continue;
    }
    ok++;
  }
  console.log(`\n[OK] ${ok}/${upserts.length} upserted`);
}

main().catch((e) => {
  console.error("[fatal]", e.message);
  process.exit(1);
});
