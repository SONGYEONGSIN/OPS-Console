#!/usr/bin/env node
// 개선요청 메일 발송 single-shot 테스트
//   node scripts/feedback-mail-test.mjs                     # owner + status 둘 다
//   MODE=owner  node scripts/feedback-mail-test.mjs         # 담당자(송영신) 알림만
//   MODE=status node scripts/feedback-mail-test.mjs         # 등록자(ysong2526) 알림만
//
// 실 Graph API 호출. DB 변경 없음 (feedback_mail_sends 미적재).
// 발신자: ys1114 본인 메일박스 (Microsoft 365 테넌트 제약 — Gmail 발신 불가).
// src/features/posts/mailer.ts 의 subject/body 빌더를 inline mirror.

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const MODE = (process.env.MODE ?? "both").toLowerCase();
const SENDER_EMAIL = process.env.SENDER_EMAIL ?? "ys1114@jinhakapply.com";
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "ys1114@jinhakapply.com";   // 담당자(송영신)
const OWNER_NAME = process.env.OWNER_NAME ?? "송영신";
const AUTHOR_EMAIL = process.env.AUTHOR_EMAIL ?? "ysong2526@gmail.com";    // 등록자
const AUTHOR_NAME = process.env.AUTHOR_NAME ?? "ysong";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.FOLIO_BASE_URL ??
  "http://localhost:3000";

const FAKE_POST = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "FB-TEST",
  title: "[테스트] 검색창 자동완성 추가 요청",
  body: "현재 메뉴 검색이 정확 일치만 매칭됨.\n부분 매칭(자동완성)이 있으면 좋겠습니다.",
  author_email: AUTHOR_EMAIL,
};

const FEEDBACK_STATUS_LABEL = {
  urgent: "요청",
  review: "확인",
  active: "처리중",
  approved: "처리완료",
};

const STATUS_TO = (process.env.STATUS_TO ?? "active").toLowerCase();
if (!FEEDBACK_STATUS_LABEL[STATUS_TO]) {
  console.error(`[fatal] STATUS_TO 값 오류: ${STATUS_TO} (urgent|review|active|approved)`);
  process.exit(1);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function nl2br(s) {
  return s.replace(/\n/g, "<br>");
}

function buildOwnerNotifySubject(title) {
  return `[운영부 상황실] 새 개선요청: ${title}`;
}
function buildOwnerNotifyBody({ post, authorName, appUrl }) {
  const link = `${appUrl}/dashboard/feedback`;
  const bodyText = (post.body ?? "").trim();
  const bodySection = bodyText
    ? `<p style="margin:16px 0 4px;color:#374151;font-weight:600;">본문 미리보기</p>
       <div style="padding:12px 14px;background:#f9fafb;border-left:3px solid #d1d5db;color:#4b5563;font-size:14px;line-height:1.6;">${nl2br(escapeHtml(bodyText))}</div>`
    : "";
  return `<div style="font-family:-apple-system,'Pretendard',sans-serif;color:#111827;font-size:14px;line-height:1.7;max-width:560px;">
  <p style="margin:0 0 12px;color:#6b7280;font-size:12px;letter-spacing:0.04em;">[운영부 상황실]</p>
  <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;">새 개선요청이 등록되었습니다</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:80px;">번호</td><td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(post.slug)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">등록자</td><td style="padding:6px 0;color:#111827;">${escapeHtml(authorName)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">제목</td><td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(post.title)}</td></tr>
  </table>
  ${bodySection}
  <p style="margin:20px 0 0;"><a href="${link}" style="color:#dc2626;text-decoration:none;font-weight:600;">개선요청 게시판 열기 →</a></p>
  <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">본 메일은 OPS Console에서 자동 발송되었습니다. [TEST]</p>
</div>`;
}

function buildStatusNotifySubject(title, statusTo) {
  return `[운영부 상황실] 개선요청 ${FEEDBACK_STATUS_LABEL[statusTo]}: ${title}`;
}
function buildStatusNotifyBody({ post, statusTo, changerName, appUrl }) {
  const label = FEEDBACK_STATUS_LABEL[statusTo];
  const link = `${appUrl}/dashboard/feedback`;
  return `<div style="font-family:-apple-system,'Pretendard',sans-serif;color:#111827;font-size:14px;line-height:1.7;max-width:560px;">
  <p style="margin:0 0 12px;color:#6b7280;font-size:12px;letter-spacing:0.04em;">[운영부 상황실]</p>
  <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;">개선요청 상태가 <span style="color:#dc2626;">${escapeHtml(label)}</span>(으)로 변경되었습니다</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:80px;">번호</td><td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(post.slug)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">제목</td><td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(post.title)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">변경자</td><td style="padding:6px 0;color:#111827;">${escapeHtml(changerName)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">현재 상태</td><td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(label)}</td></tr>
  </table>
  <p style="margin:20px 0 0;"><a href="${link}" style="color:#dc2626;text-decoration:none;font-weight:600;">개선요청 게시판 열기 →</a></p>
  <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">본 메일은 OPS Console에서 자동 발송되었습니다. [TEST]</p>
</div>`;
}

// Graph token
const tenant = process.env.AZURE_AD_TENANT_ID;
const clientId = process.env.AZURE_AD_CLIENT_ID;
const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
if (!tenant || !clientId || !clientSecret) {
  console.error("[fatal] AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET 누락 (.env.local 확인)");
  process.exit(1);
}
const tokenRes = await fetch(
  `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  },
);
if (!tokenRes.ok) {
  console.error("[fatal] token fetch fail:", tokenRes.status, await tokenRes.text());
  process.exit(1);
}
const accessToken = (await tokenRes.json()).access_token;
console.log("[graph] token OK");

async function sendMail({ toEmail, toName, subject, html }) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`;
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: toName ? { address: toEmail, name: toName } : { address: toEmail } }],
    },
    saveToSentItems: true,
  };
  console.log(`[send] from=${SENDER_EMAIL} to=${toEmail} subject="${subject}"`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 202 || res.status === 200) {
    console.log(`[OK] ${res.status} — ${toEmail}`);
    return true;
  }
  console.error(`[FAIL] ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return false;
}

let okCount = 0;
let totalCount = 0;

if (MODE === "owner" || MODE === "both") {
  totalCount++;
  const subject = buildOwnerNotifySubject(FAKE_POST.title);
  const html = buildOwnerNotifyBody({ post: FAKE_POST, authorName: AUTHOR_NAME, appUrl: APP_URL });
  console.log("\n=== OWNER NOTIFY (신규 등록 → 담당자) ===");
  if (await sendMail({ toEmail: OWNER_EMAIL, toName: OWNER_NAME, subject, html })) okCount++;
}

if (MODE === "status" || MODE === "both") {
  totalCount++;
  const subject = buildStatusNotifySubject(FAKE_POST.title, STATUS_TO);
  const html = buildStatusNotifyBody({
    post: FAKE_POST,
    statusTo: STATUS_TO,
    changerName: OWNER_NAME,
    appUrl: APP_URL,
  });
  console.log(`\n=== STATUS NOTIFY (상태=${STATUS_TO}/${FEEDBACK_STATUS_LABEL[STATUS_TO]} → 등록자) ===`);
  if (await sendMail({ toEmail: AUTHOR_EMAIL, toName: AUTHOR_NAME, subject, html })) okCount++;
}

console.log(`\n[done] ${okCount}/${totalCount} 성공`);
process.exit(okCount === totalCount ? 0 : 1);
