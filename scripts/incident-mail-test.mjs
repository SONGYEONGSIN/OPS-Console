#!/usr/bin/env node
// 사고보고 메일 발송 single-shot 테스트
//   node scripts/incident-mail-test.mjs                              # 가장 최근 incident 1건
//   INCIDENT_ID=<uuid> node scripts/incident-mail-test.mjs           # 특정 incident
//   TARGET_EMAIL=ys1114@jinhakapply.com node scripts/incident-mail-test.mjs
//
// 실 Graph API 호출 + PDF 첨부. DB(incident_mail_sends) 변경 없음.
// 본인 메일박스 → 본인 메일박스로 발송하여 시각 검증.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const TARGET_EMAIL = process.env.TARGET_EMAIL ?? "ys1114@jinhakapply.com";
const TARGET_NAME = process.env.TARGET_NAME ?? "송영신";
const SENDER_EMAIL = TARGET_EMAIL; // 본인 → 본인 (단순 테스트)
const INCIDENT_ID = process.env.INCIDENT_ID ?? null;

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 1) incident fetch
let query = supabase
  .from("incidents")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(1);
if (INCIDENT_ID) {
  query = supabase.from("incidents").select("*").eq("id", INCIDENT_ID).limit(1);
}
const { data, error } = await query;
if (error) {
  console.error("[fatal] fetch fail:", error.message);
  process.exit(1);
}
const incident = data?.[0];
if (!incident) {
  console.error("[fatal] incident 없음");
  process.exit(1);
}
console.log(
  `[target] ${incident.id} · ${incident.category} · ${incident.title}`,
);
console.log(
  `[mapping] reporter=${incident.reporter_email} (${incident.reporter_name}) · dept=${incident.department}`,
);

// 2) Pretendard 등록 + PDF render (incident-pdf.tsx와 동등 구조)
const { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } =
  await import("@react-pdf/renderer");
const React = (await import("react")).default;
const path = await import("node:path");

Font.register({
  family: "Pretendard",
  fonts: [
    {
      src: path.join(
        process.cwd(),
        "public",
        "fonts",
        "Pretendard-Regular.ttf",
      ),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), "public", "fonts", "Pretendard-Bold.otf"),
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 11,
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 42,
    lineHeight: 1.6,
    color: "#1a1a1a",
  },
  runningHeader: {
    position: "absolute",
    top: 18,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  runningHeaderLeft: { color: "#b8331e" },
  runningHeaderRight: { color: "#999" },
  runningFooter: {
    position: "absolute",
    bottom: 18,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
  },
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 10, color: "#666" },
  section: { marginBottom: 18 },
  sectionLabelChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    backgroundColor: "#b8331e",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 6 },
  metaItem: { flexDirection: "row", gap: 6 },
  metaLabel: { color: "#666" },
  metaValue: { color: "#1a1a1a" },
  bodyBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
    paddingLeft: 12,
    paddingVertical: 4,
  },
  bodyText: { fontSize: 11, lineHeight: 1.7 },
  bodyEmpty: { fontSize: 10, color: "#999" },
});

const dateRange =
  incident.occurred_date && incident.resolved_date
    ? `${incident.occurred_date} ~ ${incident.resolved_date}`
    : incident.occurred_date
      ? `${incident.occurred_date} ~`
      : "미지정";

const sections = [
  ["사고경위", incident.cause_summary],
  ["사고원인", incident.root_cause],
  ["사고처리", incident.resolution],
  ["사고대책", incident.prevention],
];

const doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: "A4", style: styles.page },
    React.createElement(
      View,
      { fixed: true, style: styles.runningHeader },
      React.createElement(
        Text,
        { style: styles.runningHeaderLeft },
        `사고보고 · ${incident.title}`,
      ),
      React.createElement(
        Text,
        { style: styles.runningHeaderRight },
        "운영부 상황실 · 사고보고",
      ),
    ),
    React.createElement(
      View,
      { style: styles.header },
      React.createElement(Text, { style: styles.title }, "사고보고"),
      React.createElement(
        Text,
        { style: styles.subtitle },
        `발송 ${new Date().toLocaleDateString("ko-KR")} · 운영부 상황실 [TEST]`,
      ),
    ),
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(Text, { style: styles.sectionLabelChip }, "사고 개요"),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "제목"),
          React.createElement(Text, { style: styles.metaValue }, incident.title),
        ),
      ),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "구분"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            incident.app_type,
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "카테고리"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            incident.category,
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "연도"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            String(incident.year),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "대학명"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            incident.university_name ?? "미지정",
          ),
        ),
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "기간"),
          React.createElement(Text, { style: styles.metaValue }, dateRange),
        ),
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "현재상황"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            incident.status,
          ),
        ),
      ),
    ),
    React.createElement(
      View,
      { style: styles.section },
      React.createElement(
        Text,
        { style: styles.sectionLabelChip },
        "담당 / 보고",
      ),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "담당부서"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            incident.department,
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "담당자"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            `${incident.assignee_name ?? ""} (${incident.assignee_email ?? ""})`,
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.metaRow },
        React.createElement(
          View,
          { style: styles.metaItem },
          React.createElement(Text, { style: styles.metaLabel }, "보고자"),
          React.createElement(
            Text,
            { style: styles.metaValue },
            `${incident.reporter_name} (${incident.reporter_email}) [TEST → ${TARGET_EMAIL}]`,
          ),
        ),
      ),
    ),
    ...sections.map(([label, value]) =>
      React.createElement(
        View,
        { key: label, style: styles.section },
        React.createElement(
          Text,
          { style: styles.sectionLabelChip, minPresenceAhead: 40 },
          label,
        ),
        value
          ? React.createElement(
              View,
              { style: styles.bodyBox },
              React.createElement(Text, { style: styles.bodyText }, value),
            )
          : React.createElement(
              Text,
              { style: styles.bodyEmpty },
              "(작성된 내용 없음)",
            ),
      ),
    ),
    React.createElement(
      View,
      { fixed: true, style: styles.runningFooter },
      React.createElement(Text, null, "운영부 상황실 자동발송"),
      React.createElement(Text, {
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
      }),
    ),
  ),
);

console.log("[pdf] rendering…");
const pdfBuf = await renderToBuffer(doc);
console.log(`[pdf] ${pdfBuf.length} bytes`);

// 3) HTML 본문 (mail-template.ts 동등 구조 축약)
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodySection(label, value) {
  const inner = value
    ? `<div style="border-left:3px solid #b8331e;padding:6px 12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(value)}</div>`
    : `<div style="font-size:12px;color:#999;">(작성된 내용 없음)</div>`;
  return `<div style="margin-bottom:18px;">
      <p style="font-size:11px;color:#b8331e;letter-spacing:1px;margin:0 0 8px 0;font-weight:bold;">${escapeHtml(label)}</p>
      ${inner}
    </div>`;
}

const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;font-family:'Pretendard',sans-serif;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="padding-bottom:12px;border-bottom:2px solid #b8331e;margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:1px;color:#b8331e;">운영부 상황실 · 사고보고 [TEST]</div>
      <h1 style="margin:4px 0 0;font-size:20px;">${escapeHtml(incident.title)}</h1>
    </div>
    <p style="font-size:14px;">
      [TEST] 사고보고 메일 알림 기능 검증 발송입니다.<br>
      원 보고자 매핑: <strong>${escapeHtml(incident.reporter_name)} (${escapeHtml(incident.reporter_email)})</strong>
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#666;width:30%;">구분</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(incident.app_type)}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">카테고리</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(incident.category)}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">대학명</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(incident.university_name ?? "미지정")}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">연도</td><td style="padding:6px 0;font-size:13px;">${incident.year}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">발생/처리</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(dateRange)}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">담당부서</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(incident.department)}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">담당자</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(incident.assignee_name ?? "")} (${escapeHtml(incident.assignee_email ?? "")})</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">현재상황</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(incident.status)}</td></tr>
    </table>
    ${bodySection("사고경위", incident.cause_summary)}
    ${bodySection("사고원인", incident.root_cause)}
    ${bodySection("사고처리", incident.resolution)}
    ${bodySection("사고대책", incident.prevention)}
    <p style="font-size:12px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
      운영부 상황실 자동발송 [TEST] — 동일 내용 PDF 첨부.
    </p>
  </div>
</body></html>`;

// 4) Graph token + sendMail
const tenant = process.env.AZURE_AD_TENANT_ID;
const clientId = process.env.AZURE_AD_CLIENT_ID;
const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
if (!tenant || !clientId || !clientSecret) {
  console.error(
    "[fatal] AZURE_AD_TENANT_ID / CLIENT_ID / CLIENT_SECRET 누락",
  );
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
  console.error(
    "[fatal] token fetch fail:",
    tokenRes.status,
    await tokenRes.text(),
  );
  process.exit(1);
}
const tokenJson = await tokenRes.json();
const accessToken = tokenJson.access_token;
console.log("[graph] token OK");

const subjectParts = [incident.category];
if (incident.university_name) subjectParts.push(incident.university_name);
subjectParts.push(incident.title);
const subject = `[운영부 상황실] 사고보고 [TEST] — ${subjectParts.join(" / ")}`;
const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`;
const payload = {
  message: {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: [
      { emailAddress: { address: TARGET_EMAIL, name: TARGET_NAME } },
    ],
    attachments: [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `incident-${incident.id.slice(0, 8)}.pdf`,
        contentType: "application/pdf",
        contentBytes: pdfBuf.toString("base64"),
      },
    ],
  },
  saveToSentItems: true,
};

console.log(`[send] to=${TARGET_EMAIL} subject="${subject}"`);
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
if (res.status === 202 || res.status === 200) {
  console.log(`[OK] 메일 발송 성공 (${res.status})`);
  console.log(`[inbox] ${TARGET_EMAIL} 받은편지함 확인`);
} else {
  const txt = await res.text();
  console.error(`[fail] ${res.status} ${txt.slice(0, 500)}`);
  process.exit(1);
}
