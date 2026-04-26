/**
 * Folio 전용 design-sync — design-ref/folio-*.html (mockup) vs 실제 Folio 빌드 시각 회귀.
 *
 * 비교 모드: --from-file (.claude/skills/design-sync/SKILL.md 참조)
 *   1. mockup HTML을 file:// 로 Playwright 렌더 → 기준 스크린샷
 *   2. Folio dev 서버의 같은 페이지 렌더 → 비교 스크린샷
 *   3. pixelmatch로 픽셀 단위 비교 → 싱크율 % 출력
 *   4. 진단용 diff PNG는 .design-sync/ 폴더에 저장
 *
 * 사용법:
 *   1. 별도 터미널: `next dev -p 3010` (또는 `npm run dev -- -p 3010`)
 *   2. 이 터미널: `node scripts/design-sync.mjs`
 *
 * - `/login`: 인증 불필요 → 항상 비교
 * - `/dashboard`: 인증 필요 → `.env.local`의 TEST_USER_*로 사전 로그인 → storageState 주입.
 *   TEST_USER 미설정 시 dashboard는 자동 skip.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// Node 직접 실행이라 .env.local 자동 로드 X — 명시 호출 필요.
loadEnv({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// 기본 3010, 환경변수로 override 가능 (예: LOCAL_BASE=http://localhost:3001 npm run design-sync)
const LOCAL_BASE = process.env.LOCAL_BASE || "http://localhost:3010";
const OUT_DIR = path.join(ROOT, ".design-sync");

/** [vpName, width, height] — mockup의 4-tier 반응형 분기에 맞춰 */
const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "tablet", width: 1000, height: 800 },
  { name: "mobile", width: 393, height: 851 },
];

/** 비교 페어. `authed: true`면 storageState로 사전 로그인 후 캡처. */
const PAIRS = [
  {
    name: "login",
    refUrl: `file://${path.join(ROOT, "design-ref/folio-login.html")}`,
    localPath: "/login",
  },
  {
    name: "dashboard",
    refUrl: `file://${path.join(ROOT, "design-ref/folio-dashboard.html")}`,
    localPath: "/dashboard",
    authed: true,
  },
];

async function disableAnimations(page) {
  await page.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent =
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }";
    document.head.appendChild(s);
  });
}

async function captureUrl(browser, viewport, url, storageState) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ...(storageState ? { storageState } : {}),
  });
  const page = await ctx.newPage();
  await disableAnimations(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  // Pretendard 등 외부 폰트 로드 안정화
  await page.waitForTimeout(800);
  const buf = await page.screenshot({ fullPage: false });
  await ctx.close();
  return buf;
}

/**
 * TEST_USER_* 자격증명으로 한 번 로그인해서 cookie/localStorage state 추출.
 * `authed: true` pair에서 재사용. TEST_USER 미설정 시 null 반환 → 호출부에서 dashboard skip.
 */
async function getAuthStorageState(browser) {
  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    return null;
  }
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await disableAnimations(page);
  await page.goto(`${LOCAL_BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

function compareBuffers(refBuf, localBuf) {
  const ref = PNG.sync.read(refBuf);
  const local = PNG.sync.read(localBuf);
  const w = Math.min(ref.width, local.width);
  const h = Math.min(ref.height, local.height);
  // 같은 크기로 자르기
  const refData = sliceData(ref, w, h);
  const localData = sliceData(local, w, h);
  const diff = new PNG({ width: w, height: h });
  const diffPixels = pixelmatch(refData, localData, diff.data, w, h, {
    threshold: 0.15,
    includeAA: false,
  });
  const total = w * h;
  const sync = ((1 - diffPixels / total) * 100).toFixed(1);
  return {
    width: w,
    height: h,
    diffPixels,
    total,
    sync,
    diffPng: PNG.sync.write(diff),
  };
}

function sliceData(png, w, h) {
  if (png.width === w && png.height === h) return png.data;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    png.data.copy(
      out,
      y * w * 4,
      y * png.width * 4,
      y * png.width * 4 + w * 4
    );
  }
  return out;
}

async function main() {
  // dev server reachable?
  try {
    const res = await fetch(`${LOCAL_BASE}/login`, { method: "HEAD" });
    if (res.status >= 500)
      throw new Error(`HEAD /login → ${res.status}`);
  } catch (e) {
    console.error(
      `\n✗ Folio dev 서버(${LOCAL_BASE})에 접근 불가: ${e.message}`
    );
    console.error(
      `  별도 터미널에서 \`next dev -p 3010\` 실행 후 다시 시도하세요.\n`
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // 인증 필요한 pair용 storageState — 한 번만 로그인해서 모든 viewport에서 재사용
  const authedPairs = PAIRS.filter((p) => p.authed);
  let authState = null;
  if (authedPairs.length > 0) {
    authState = await getAuthStorageState(browser);
    if (!authState) {
      console.warn(
        `\n⚠ TEST_USER_EMAIL/PASSWORD 미설정 — authed pair (${authedPairs
          .map((p) => p.name)
          .join(", ")}) skip\n`
      );
    }
  }

  console.log(`\nFolio design-sync — mockup ↔ Folio (file:// vs ${LOCAL_BASE})\n`);
  console.log(
    `${"page".padEnd(10)} ${"viewport".padEnd(10)} ${"sync%".padStart(7)}  ${"diff".padStart(12)}  artifacts`
  );
  console.log("─".repeat(72));

  const results = [];

  for (const pair of PAIRS) {
    if (pair.authed && !authState) continue;
    for (const vp of VIEWPORTS) {
      try {
        const [refBuf, localBuf] = await Promise.all([
          captureUrl(browser, vp, pair.refUrl), // mockup은 storageState 불필요
          captureUrl(
            browser,
            vp,
            `${LOCAL_BASE}${pair.localPath}`,
            pair.authed ? authState : undefined
          ),
        ]);
        const cmp = compareBuffers(refBuf, localBuf);

        const stem = `${pair.name}-${vp.name}`;
        fs.writeFileSync(path.join(OUT_DIR, `${stem}-ref.png`), refBuf);
        fs.writeFileSync(path.join(OUT_DIR, `${stem}-local.png`), localBuf);
        fs.writeFileSync(path.join(OUT_DIR, `${stem}-diff.png`), cmp.diffPng);

        console.log(
          `${pair.name.padEnd(10)} ${vp.name.padEnd(10)} ${(cmp.sync + "%").padStart(7)}  ${(cmp.diffPixels + "/" + cmp.total).padStart(10)}  ${stem}-{ref,local,diff}.png`
        );
        results.push({
          page: pair.name,
          viewport: vp.name,
          sync: parseFloat(cmp.sync),
          diff: cmp.diffPixels,
          total: cmp.total,
        });
      } catch (e) {
        console.log(
          `${pair.name.padEnd(10)} ${vp.name.padEnd(10)} ${"ERROR".padStart(7)}  ${e.message}`
        );
      }
    }
  }

  await browser.close();

  // 요약
  if (results.length > 0) {
    const avg = (
      results.reduce((s, r) => s + r.sync, 0) / results.length
    ).toFixed(1);
    console.log("─".repeat(70));
    console.log(`평균 싱크율: ${avg}% (${results.length}건)`);
    console.log(`아티팩트:    ${path.relative(ROOT, OUT_DIR)}/`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
