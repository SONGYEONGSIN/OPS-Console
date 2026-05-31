// 월별 서비스 알림 — GitHub Actions cron 진입점.
// OPS-Console API route `/api/automations/run`를 CRON_SECRET 인증으로 호출하여
// feature 모듈 runServiceNoticeMail을 단일 실행. 매일 돌아도 잡 내부에서
// 주말·공휴일 차단 + 월 단위 idempotency로 "이번 달 첫 영업일 1회"만 발송된다.
// 사용 (local):
//   OPS_CONSOLE_BASE_URL=http://localhost:3000 CRON_SECRET=... node scripts/service-notice-mail.mjs

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

const url = `${BASE_URL.replace(/\/$/, "")}/api/automations/run?jobId=service-notice-mail`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${CRON_SECRET}`,
    "content-type": "application/json",
  },
});
const text = await res.text();
console.log(`status=${res.status} body=${text}`);
if (!res.ok) process.exit(1);
