// 자료 요청 예약 메일 dispatch 진입점 — GitHub Actions cron 5분 간격 호출.
// OPS-Console API route `/api/data-requests/dispatch`를 CRON_SECRET 인증으로 호출.
// 사용 (local):
//   OPS_CONSOLE_BASE_URL=http://localhost:3000 CRON_SECRET=... node scripts/data-requests-dispatch.mjs
// 사용 (CI):
//   GitHub Actions secrets로 BASE_URL/CRON_SECRET 주입

import { readFileSync, existsSync } from "node:fs";

const envFromFile = existsSync(".env.local")
  ? readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .reduce((acc, l) => {
        const [k, ...v] = l.split("=");
        if (k) acc[k.trim()] = v.join("=").trim();
        return acc;
      }, {})
  : {};

const env = { ...envFromFile, ...process.env };
const BASE_URL = env.OPS_CONSOLE_BASE_URL;
const CRON_SECRET = env.CRON_SECRET;

if (!BASE_URL || !CRON_SECRET) {
  console.error("Missing required env: OPS_CONSOLE_BASE_URL / CRON_SECRET");
  process.exit(1);
}

const url = `${BASE_URL.replace(/\/$/, "")}/api/data-requests/dispatch`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "x-cron-secret": CRON_SECRET,
    "content-type": "application/json",
  },
});

const text = await res.text();
console.log(`status=${res.status} body=${text}`);

if (!res.ok) {
  process.exit(1);
}
