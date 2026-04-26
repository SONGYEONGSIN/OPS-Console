/**
 * mockup HTML vs 우리 빌드의 동일 element 좌표를 측정해서 차이 출력.
 * sync% 같은 통계 대신 **정확히 어떤 element가 어디에 있는지** 직접 비교.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOCAL_BASE = process.env.LOCAL_BASE || "http://localhost:3001";
const VIEWPORT = { width: 1366, height: 900 };

const TARGETS = [
  // text 기반 selector — mockup HTML과 우리 빌드 모두 같은 텍스트
  { name: "운 seal", selector: "text=운", first: true },
  { name: "OPSROOM · v4.2.1 라인", selector: "text=OPSROOM" },
  { name: "입실 — 운영실 헤딩", selector: "h1" },
  { name: "OBSERVE · RESPOND · RESOLVE", selector: "text=OBSERVE" },
  { name: "기록 · 응대 · 해결 (tagline)", selector: "text=/기록 · 응대 · 해결/" },
  { name: "2026 · 04 · 25 · 월", selector: "text=2026 · 04 · 25 · 월" },
  { name: "운영실 / 인증 / 로그인 (crumb)", selector: "text=/운영실/", first: true },
  { name: "계정 인증 — 입실 헤딩", selector: "h2" },
  { name: "Microsoft SSO 버튼", selector: "text=Microsoft SSO로 계속" },
  { name: "또는 이메일로 로그인", selector: "text=또는 이메일로 로그인" },
  { name: "이메일 input", selector: 'input[name="email"]' },
  { name: "비밀번호 input", selector: 'input[name="password"]' },
  { name: "입실 · 로그인 버튼", selector: "text=/입실/", last: true },
  { name: "MS-2026-042 푸터", selector: "text=MS-2026-042" },
];

async function measure(page, target) {
  try {
    let loc = page.locator(target.selector);
    if (target.first) loc = loc.first();
    if (target.last) loc = loc.last();
    const box = await loc.boundingBox({ timeout: 2000 });
    return box; // { x, y, width, height } or null
  } catch {
    return null;
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });

  // 1) mockup
  const refPage = await ctx.newPage();
  await refPage.goto(`file://${path.join(ROOT, "design-ref/folio-login.html")}`, {
    waitUntil: "networkidle",
  });
  await refPage.waitForTimeout(1500);

  // 2) ours
  const ourPage = await ctx.newPage();
  await ourPage.goto(`${LOCAL_BASE}/login`, { waitUntil: "networkidle" });
  await ourPage.waitForTimeout(1500);

  console.log(`\nLayout 진단 — mockup ↔ ${LOCAL_BASE}/login (viewport ${VIEWPORT.width}×${VIEWPORT.height})\n`);
  console.log(
    `${"element".padEnd(36)} ${"mockup (x,y)".padStart(14)} ${"ours (x,y)".padStart(14)} ${"Δ x".padStart(6)} ${"Δ y".padStart(6)} ${"size 일치".padStart(10)}`
  );
  console.log("─".repeat(95));

  for (const t of TARGETS) {
    const refBox = await measure(refPage, t);
    const ourBox = await measure(ourPage, t);
    if (!refBox && !ourBox) {
      console.log(
        `${t.name.padEnd(36)} ${"(없음)".padStart(14)} ${"(없음)".padStart(14)}`
      );
      continue;
    }
    if (!refBox) {
      console.log(`${t.name.padEnd(36)} ${"(mockup 없음)".padStart(14)}`);
      continue;
    }
    if (!ourBox) {
      console.log(`${t.name.padEnd(36)} ${"(ours 없음)".padStart(14)}`);
      continue;
    }
    const dx = Math.round(ourBox.x - refBox.x);
    const dy = Math.round(ourBox.y - refBox.y);
    const sizeOk =
      Math.abs(ourBox.width - refBox.width) < 3 &&
      Math.abs(ourBox.height - refBox.height) < 3
        ? "✓"
        : `${Math.round(refBox.width)}x${Math.round(refBox.height)} → ${Math.round(ourBox.width)}x${Math.round(ourBox.height)}`;
    console.log(
      `${t.name.padEnd(36)} ${`(${Math.round(refBox.x)}, ${Math.round(refBox.y)})`.padStart(14)} ${`(${Math.round(ourBox.x)}, ${Math.round(ourBox.y)})`.padStart(14)} ${(dx + "").padStart(6)} ${(dy + "").padStart(6)} ${sizeOk.padStart(10)}`
    );
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
