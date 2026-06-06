#!/usr/bin/env node
// 학교담당자 미수채권 알림 DRY-RUN 미리보기.
//   node scripts/receivables-school-dry.mjs
// 발송·DB·엑셀 일절 변경 없음. SharePoint 시트만 읽어 마일스톤 대상 그룹을 출력.
//
// 로직은 아래 TS 소스를 미러링한 사본이다(드리프트 주의):
//   - src/features/receivables/school-mail-grouping.ts (그룹화 규칙)
//   - src/features/receivables/mail-schedule.ts (SCHOOL_TARGET_DAYS)
//   - src/features/receivables/overdue.ts (computeElapsedDays)
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const TENANT = process.env.AZURE_AD_TENANT_ID;
const CLIENT_ID = process.env.AZURE_AD_CLIENT_ID;
const SECRET = process.env.AZURE_AD_CLIENT_SECRET;
const DRIVE_ID = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
const ITEM_ID = process.env.SHAREPOINT_RECEIVABLES_ITEM_ID;

if (!TENANT || !CLIENT_ID || !SECRET || !DRIVE_ID || !ITEM_ID) {
  console.error(
    "환경변수 누락: AZURE_AD_* / SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_RECEIVABLES_ITEM_ID (.env.local)",
  );
  process.exit(1);
}

const SCHOOL_TARGET_DAYS = [
  10, 15, 20, 25, 30, 35, 40, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const findCol = (headers, re) => headers.findIndex((h) => re.test(h));
const computeElapsedDays = (text, now) => {
  if (!text) return null;
  const d = new Date(String(text).trim());
  if (Number.isNaN(d.getTime())) return null;
  const diff = now.getTime() - d.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / 86400000);
};

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
  );
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function fetchSheet(token) {
  const base = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook`;
  const h = { Authorization: `Bearer ${token}` };
  const wsRes = await fetch(`${base}/worksheets?$top=1&$select=name`, { headers: h });
  if (!wsRes.ok) throw new Error(`worksheets ${wsRes.status}`);
  const wsName = (await wsRes.json()).value?.[0]?.name;
  const encoded = encodeURIComponent(wsName);
  const rangeRes = await fetch(
    `${base}/worksheets('${encoded}')/usedRange?$select=values,text,rowCount,columnCount`,
    { headers: h },
  );
  if (!rangeRes.ok) throw new Error(`usedRange ${rangeRes.status}`);
  const j = await rangeRes.json();
  return { wsName, values: j.values ?? [], text: j.text ?? [] };
}

function detectHeaderIdx(text) {
  // 헤더 = '청구일자'와 '운영자'를 모두 포함하는 첫 행 (메타행/데이터행 혼동 방지)
  const look = Math.min(12, text.length);
  for (let i = 0; i < look; i++) {
    const cells = (text[i] ?? []).map((c) => String(c ?? "").trim());
    if (cells.some((c) => /^청구\s*일자/.test(c)) && cells.includes("운영자")) {
      return i;
    }
  }
  return 0;
}

const run = async () => {
  const now = new Date();
  const token = await getToken();
  const { wsName, values, text } = await fetchSheet(token);
  const hIdx = detectHeaderIdx(text.length ? text : values);
  const headers = (text[hIdx] ?? values[hIdx]).map((c) => String(c ?? "").trim());
  const dataText = text.slice(hIdx + 1);

  const ownerCol = findCol(headers, /^학교\s*담당자?$|^학교\s*담당\s*이메일$/);
  const opExact = findCol(headers, /^운영자$/);
  const operatorCol = opExact >= 0 ? opExact : findCol(headers, /^담당\s*운영자|책임자$/);
  const billingCol = findCol(headers, /^청구\s*일자/);
  const noteCol = findCol(headers, /적\s*요|피드백|비고/);
  const nameCol = findCol(headers, /거래처명?|학교명?/);
  const mailSentCol = findCol(headers, /^메일\s*발송\s*일자$/);

  console.log(`시트: ${wsName} / 헤더행: ${hIdx + 1}`);
  console.log(`컬럼 — 학교담당자:${ownerCol} 운영자:${operatorCol} 청구일자:${billingCol} 적요:${noteCol} 메일발송일자:${mailSentCol}`);
  if (ownerCol < 0 || operatorCol < 0 || billingCol < 0) {
    console.error("필수 컬럼(학교담당자/운영자/청구일자) 누락 — 중단");
    process.exit(1);
  }

  const groups = new Map();
  const skip = { noEmail: 0, invalidEmail: 0, noteFilled: 0, notMilestone: 0, noOperator: 0 };
  for (let i = 0; i < dataText.length; i++) {
    const row = dataText[i] ?? [];
    const email = String(row[ownerCol] ?? "").trim();
    if (!email) { skip.noEmail++; continue; }
    if (!EMAIL_RE.test(email)) { skip.invalidEmail++; continue; }
    const operator = String(row[operatorCol] ?? "").trim();
    if (!operator) { skip.noOperator++; continue; }
    if (noteCol >= 0 && String(row[noteCol] ?? "").trim() !== "") { skip.noteFilled++; continue; }
    const days = computeElapsedDays(String(row[billingCol] ?? ""), now);
    if (days === null) continue;
    if (!SCHOOL_TARGET_DAYS.includes(days)) { skip.notMilestone++; continue; }
    const key = `${operator} ▶ ${email}`;
    const g = groups.get(key) ?? { operator, email, items: [] };
    g.items.push({ name: nameCol >= 0 ? String(row[nameCol] ?? "") : "", days, excelRow: hIdx + 2 + i });
    groups.set(key, g);
  }

  console.log(`\n발송 대상 그룹 (운영자 ▶ 학교담당자) — ${groups.size}건:`);
  if (groups.size === 0) console.log("   (오늘 마일스톤 해당 없음)");
  for (const g of groups.values()) {
    const ds = g.items.map((it) => `D+${it.days}`).join(", ");
    console.log(`   ${g.operator} ▶ ${g.email}  · ${g.items.length}건 [${ds}]`);
  }
  console.log(`\n제외: 메일없음 ${skip.noEmail} / 형식오류 ${skip.invalidEmail} / 적요채움 ${skip.noteFilled} / 마일스톤아님 ${skip.notMilestone} / 운영자없음 ${skip.noOperator}`);
  console.log("\n(DRY-RUN — 발송·DB·엑셀 변경 없음)");
};

run().catch((e) => { console.error(e); process.exit(1); });
