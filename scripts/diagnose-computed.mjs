/**
 * Task 1 진단용 — mockup HTML과 우리 빌드의 동일 element computed style을 비교.
 *
 * Category A: input/button 크기 원인 (height/padding/box-sizing/font/line-height)
 * Category B: vertical 시프트 원인 (panel/main/grid 높이)
 * Category C: horizontal 시프트 원인 (panel padding + 자식 offset)
 *
 * 사용:
 *   LOCAL_BASE=http://localhost:3001 node scripts/diagnose-computed.mjs
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

/**
 * 페이지 안에서 selector로 element 찾고, 지정된 computed style 키들을 추출.
 * 추가로 boundingClientRect의 x/y/width/height + parent chain (DOM tree 구조 확인용)도 수집.
 */
async function probe(page, label, selector, props, opts = {}) {
  return await page.evaluate(
    ({ label, selector, props, opts }) => {
      const all = document.querySelectorAll(selector);
      let el;
      if (opts.last) el = all[all.length - 1];
      else if (opts.index != null) el = all[opts.index];
      else el = all[0];
      if (!el) return { label, found: false };
      const cs = getComputedStyle(el);
      const styles = {};
      for (const p of props) styles[p] = cs.getPropertyValue(p);
      const rect = el.getBoundingClientRect();
      // parent chain: 자식 자신부터 6단계까지
      const chain = [];
      let cur = el;
      for (let i = 0; i < 6 && cur; i++) {
        chain.push(
          `${cur.tagName.toLowerCase()}${cur.className ? "." + String(cur.className).split(" ").filter(Boolean).slice(0, 4).join(".") : ""}`
        );
        cur = cur.parentElement;
      }
      return {
        label,
        found: true,
        styles,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        chain,
      };
    },
    { label, selector, props, opts }
  );
}

function fmtStyles(s) {
  return Object.entries(s)
    .map(([k, v]) => `${k}=${v.trim()}`)
    .join(", ");
}

function printPair(label, ref, ours) {
  console.log(`\n● ${label}`);
  if (!ref?.found) console.log(`  mockup: (없음)`);
  else {
    console.log(`  mockup rect: ${JSON.stringify(ref.rect)}`);
    console.log(`  mockup css : ${fmtStyles(ref.styles)}`);
    console.log(`  mockup DOM : ${ref.chain.join(" > ")}`);
  }
  if (!ours?.found) console.log(`  ours  : (없음)`);
  else {
    console.log(`  ours rect  : ${JSON.stringify(ours.rect)}`);
    console.log(`  ours css   : ${fmtStyles(ours.styles)}`);
    console.log(`  ours DOM   : ${ours.chain.join(" > ")}`);
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });

  const refPage = await ctx.newPage();
  await refPage.goto(`file://${path.join(ROOT, "design-ref/folio-login.html")}`, { waitUntil: "networkidle" });
  await refPage.waitForTimeout(1500);

  const ourPage = await ctx.newPage();
  await ourPage.goto(`${LOCAL_BASE}/login`, { waitUntil: "networkidle" });
  await ourPage.waitForTimeout(1500);

  console.log(`\n========== Computed style 진단 (mockup ↔ ${LOCAL_BASE}/login, ${VIEWPORT.width}x${VIEWPORT.height}) ==========`);

  const inputProps = [
    "height",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "box-sizing",
    "font-size",
    "line-height",
    "border-top-width",
    "border-bottom-width",
    "display",
  ];

  // ───────── Category A: input ─────────
  console.log(`\n========== Category A: input ==========`);
  const refEmail = await probe(refPage, "email input", `input[name="email"]`, inputProps);
  const ourEmail = await probe(ourPage, "email input", `input[name="email"]`, inputProps);
  printPair("email input", refEmail, ourEmail);

  const refPw = await probe(refPage, "password input", `input[name="password"]`, inputProps);
  const ourPw = await probe(ourPage, "password input", `input[name="password"]`, inputProps);
  printPair("password input", refPw, ourPw);

  // input의 부모 .field input-wrap (mockup) / 부모 div (ours)
  const _wrapProps = ["height", "padding-top", "padding-bottom", "border-bottom-width", "display"];
  const _refWrap = await probe(refPage, "email input wrap", `input[name="email"]`, [], {});
  // 별도 selector — wrap은 input의 parent
  const refWrapInfo = await refPage.evaluate(() => {
    const el = document.querySelector(`input[name="email"]`);
    if (!el || !el.parentElement) return null;
    const p = el.parentElement;
    const cs = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    return {
      tag: p.tagName.toLowerCase(),
      cls: p.className,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      height: cs.height,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      borderBottomWidth: cs.borderBottomWidth,
      display: cs.display,
    };
  });
  const ourWrapInfo = await ourPage.evaluate(() => {
    const el = document.querySelector(`input[name="email"]`);
    if (!el || !el.parentElement) return null;
    const p = el.parentElement;
    const cs = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    return {
      tag: p.tagName.toLowerCase(),
      cls: p.className,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      height: cs.height,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      borderBottomWidth: cs.borderBottomWidth,
      display: cs.display,
    };
  });
  console.log(`\n● email input parent wrap`);
  console.log(`  mockup: ${JSON.stringify(refWrapInfo)}`);
  console.log(`  ours  : ${JSON.stringify(ourWrapInfo)}`);

  // 입실 버튼
  const btnProps = [
    "height",
    "min-height",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "box-sizing",
    "font-size",
    "line-height",
    "border-top-width",
    "border-bottom-width",
  ];
  const refBtn = await probe(refPage, "submit btn", `button.btn-primary`, btnProps);
  const ourBtn = await probe(ourPage, "submit btn", `form button[type="submit"]`, btnProps);
  printPair("submit (입실) button", refBtn, ourBtn);

  // SSO 버튼
  const refSso = await probe(refPage, "sso btn", `button.btn-sso`, btnProps);
  const ourSso = await probe(ourPage, "sso btn", `button[aria-label*="Microsoft"]`, btnProps);
  printPair("SSO button", refSso, ourSso);

  // ───────── Category B: panel/main heights ─────────
  console.log(`\n========== Category B: panel/main heights ==========`);
  const containerProps = [
    "height",
    "min-height",
    "display",
    "grid-template-rows",
    "grid-template-columns",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "justify-content",
    "align-items",
    "box-sizing",
  ];

  // mockup: .app, .main, .brand, .auth
  const refApp = await probe(refPage, "app shell", `.app`, containerProps);
  const refMain = await probe(refPage, "main grid", `.main`, containerProps);
  const refBrand = await probe(refPage, "brand panel", `aside.brand`, containerProps);
  const refAuth = await probe(refPage, "auth panel", `main.auth`, containerProps);

  // ours: outer grid (div.grid.h-screen.grid-rows-...), main element, aside, section
  const ourApp = await probe(ourPage, "app shell", `body > div`, containerProps);
  const ourMain = await probe(ourPage, "main grid", `body > div > main`, containerProps);
  const ourBrand = await probe(ourPage, "brand panel", `body > div > main > aside`, containerProps);
  const ourAuth = await probe(ourPage, "auth panel", `body > div > main > section`, containerProps);

  printPair("app shell (outer)", refApp, ourApp);
  printPair("main grid (2col panels)", refMain, ourMain);
  printPair("brand panel (aside)", refBrand, ourBrand);
  printPair("auth panel (section/main)", refAuth, ourAuth);

  // body / html
  const refBody = await probe(refPage, "body", `body`, ["height", "min-height", "display"]);
  const ourBody = await probe(ourPage, "body", `body`, ["height", "min-height", "display"]);
  printPair("body", refBody, ourBody);

  // ───────── Category C: brand horizontal ─────────
  console.log(`\n========== Category C: brand panel padding + child offset ==========`);

  // brand panel padding
  const refBrandPad = await probe(refPage, "brand pad", `aside.brand`, [
    "padding-left",
    "padding-right",
    "padding-top",
    "padding-bottom",
    "width",
  ]);
  const ourBrandPad = await probe(ourPage, "brand pad", `body > div > main > aside`, [
    "padding-left",
    "padding-right",
    "padding-top",
    "padding-bottom",
    "width",
  ]);
  printPair("brand panel padding", refBrandPad, ourBrandPad);

  // brand 첫 자식 (입실 헤딩 — h1.brand-title)
  const refH1 = await probe(refPage, "h1 입실 헤딩", `h1.brand-title`, ["margin-left", "padding-left"]);
  const ourH1 = await probe(ourPage, "h1 입실 헤딩", `body > div > main > aside h1`, ["margin-left", "padding-left"]);
  printPair("h1 (입실 헤딩)", refH1, ourH1);

  // brand-center wrapper
  const refBC = await probe(refPage, "brand-center", `.brand-center`, [
    "max-width",
    "padding-left",
    "padding-right",
    "margin-left",
    "margin-right",
    "width",
  ]);
  const ourBCInfo = await ourPage.evaluate(() => {
    // h1의 부모: max-w-[440px] div
    const h1 = document.querySelector(`body > div > main > aside h1`);
    if (!h1 || !h1.parentElement) return null;
    const p = h1.parentElement;
    const cs = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    return {
      tag: p.tagName.toLowerCase(),
      cls: p.className,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      maxWidth: cs.maxWidth,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      width: cs.width,
    };
  });
  printPair("brand-center wrapper", refBC, null);
  console.log(`  ours brand-center (h1 parent): ${JSON.stringify(ourBCInfo)}`);

  // 기록·응대·해결 tagline
  const refTag = await probe(refPage, "tagline", `.tagline`, ["margin-left", "padding-left"]);
  const ourTagInfo = await ourPage.evaluate(() => {
    // 텍스트로 찾기
    const all = Array.from(document.querySelectorAll("aside *"));
    const el = all.find((e) => e.textContent?.trim() === "기록 · 응대 · 해결");
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      marginLeft: cs.marginLeft,
      paddingLeft: cs.paddingLeft,
    };
  });
  printPair("tagline (기록·응대·해결)", refTag, null);
  console.log(`  ours tagline: ${JSON.stringify(ourTagInfo)}`);

  // brand panel과 첫 자식 사이의 wrapper 단계
  const refTree = await refPage.evaluate(() => {
    const aside = document.querySelector("aside.brand");
    if (!aside) return [];
    return Array.from(aside.children).map((c) => `${c.tagName.toLowerCase()}${c.className ? "." + String(c.className).split(" ").filter(Boolean).slice(0, 3).join(".") : ""}`);
  });
  const ourTree = await ourPage.evaluate(() => {
    const aside = document.querySelector("body > div > main > aside");
    if (!aside) return [];
    return Array.from(aside.children).map((c) => `${c.tagName.toLowerCase()}${c.className ? "." + String(c.className).split(" ").filter(Boolean).slice(0, 3).join(".") : ""}`);
  });
  console.log(`\n● brand <aside> 직접 자식 list`);
  console.log(`  mockup: ${JSON.stringify(refTree, null, 2)}`);
  console.log(`  ours  : ${JSON.stringify(ourTree, null, 2)}`);

  // ───────── extra: html, body, viewport ─────────
  const refHtml = await refPage.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { height: cs.height, minHeight: cs.minHeight };
  });
  const ourHtml = await ourPage.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { height: cs.height, minHeight: cs.minHeight };
  });
  console.log(`\n● html element`);
  console.log(`  mockup: ${JSON.stringify(refHtml)}`);
  console.log(`  ours  : ${JSON.stringify(ourHtml)}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
