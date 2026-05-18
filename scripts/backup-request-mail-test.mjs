#!/usr/bin/env node
// 백업 요청 메일 발송 single-shot 테스트
//   node scripts/backup-request-mail-test.mjs                 # 1명 일괄
//   MODE=per-service node scripts/backup-request-mail-test.mjs # 서비스별 (그룹별 1통씩)
//   TARGET_EMAIL=... TARGET_EMAIL_2=... node scripts/backup-request-mail-test.mjs
//
// 실 Graph API 호출 + PDF 첨부. DB 변경 없음.
// per-service 모드: 서비스별 substitute_email 다름 → groupServicesBySubstitute 그룹화 → 그룹별 발송.

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const MODE = process.env.MODE ?? "bulk"; // 'bulk' | 'per-service'
const TARGET_EMAIL = process.env.TARGET_EMAIL ?? "ys1114@jinhakapply.com";
const TARGET_NAME = process.env.TARGET_NAME ?? "송영신";
const TARGET_EMAIL_2 = process.env.TARGET_EMAIL_2 ?? "ysong2526@gmail.com";
const TARGET_NAME_2 = process.env.TARGET_NAME_2 ?? "송영석";
const SENDER_EMAIL = TARGET_EMAIL; // 발송자 (mailbox)

// 1) Pretendard 폰트 + PDF 렌더 (lib/pdf/backup-request-pdf.tsx 패턴 mirror)
const { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } =
  await import("@react-pdf/renderer");
const React = (await import("react")).default;
const path = await import("node:path");

Font.register({
  family: "Pretendard",
  fonts: [
    {
      src: path.join(process.cwd(), "public", "fonts", "Pretendard-Regular.ttf"),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), "public", "fonts", "Pretendard-Bold.otf"),
      fontWeight: 700,
    },
  ],
});

// 합성 input (테스트용). MODE=per-service면 서비스별 substitute 다름.
const services = [
  {
    id: "svc-1",
    service_id: 1001,
    university_name: "한국예술종합학교",
    service_name: "8월 입시(정원내 예술사)",
    contacts: ["입학팀 — 김행정 (02-1234-5678)"],
    note_md: "8/15 마감. 원서 접수 문의는 학교 입학팀으로 직접 전달.",
    substitute_email: TARGET_EMAIL,
    substitute_name: TARGET_NAME,
  },
  {
    id: "svc-2",
    service_id: 1002,
    university_name: "한양대학교(ERICA)",
    service_name: "Graduate School",
    contacts: ["대학원처 — 박관리"],
    note_md: null,
    substitute_email: MODE === "per-service" ? TARGET_EMAIL_2 : TARGET_EMAIL,
    substitute_name: MODE === "per-service" ? TARGET_NAME_2 : TARGET_NAME,
  },
];

const baseFixture = {
  requesterName: TARGET_NAME,
  requesterEmail: SENDER_EMAIL,
  leaveStartDate: "2026-05-20",
  leaveEndDate: "2026-05-22",
  summaryMd:
    "5월 20일~22일 휴가 동안 아래 서비스의 응대를 부탁드립니다.\n- 학교 연락은 즉시 전화 회신\n- 운영 시트는 일일 업데이트 부탁",
  createdAt: new Date().toISOString(),
};

// groupServicesBySubstitute (mail-template.ts 동일 로직)
const groups = new Map();
for (const s of services) {
  const existing = groups.get(s.substitute_email);
  if (existing) {
    existing.services.push(s);
  } else {
    groups.set(s.substitute_email, { name: s.substitute_name, services: [s] });
  }
}
console.log(`[mode] ${MODE} — ${groups.size} 그룹`);

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
  section: { marginBottom: 20 },
  sectionLabelChip: {
    fontSize: 12,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#b8331e",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 6 },
  metaItem: { flexDirection: "row", gap: 6 },
  metaLabel: { color: "#666" },
  metaValue: { color: "#1a1a1a" },
  serviceCard: {
    borderWidth: 1,
    borderColor: "#eee",
    padding: 12,
    marginBottom: 10,
  },
  serviceHeader: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  serviceMetaLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#b8331e",
    marginTop: 6,
    marginBottom: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
  },
  noteBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
    paddingLeft: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  noteText: { fontSize: 10, lineHeight: 1.7, color: "#444" },
  summaryBox: {
    borderLeftWidth: 2,
    borderLeftColor: "#b8331e",
    paddingLeft: 12,
    paddingVertical: 4,
  },
  summaryText: { fontSize: 11, lineHeight: 1.7 },
});

const leaveRange =
  baseFixture.leaveStartDate && baseFixture.leaveEndDate
    ? `${baseFixture.leaveStartDate} ~ ${baseFixture.leaveEndDate}`
    : baseFixture.leaveStartDate
      ? `${baseFixture.leaveStartDate} ~`
      : "미지정";

function buildPdfDoc({ substituteName, substituteEmail, groupServices }) {
  const headerLine = `백업 요청 · ${baseFixture.requesterName}`;
  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(View, { fixed: true, style: styles.runningHeader },
        React.createElement(Text, { style: styles.runningHeaderLeft }, headerLine),
        React.createElement(Text, { style: styles.runningHeaderRight }, "운영부 상황실 · 백업 요청"),
      ),
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, "백업 요청"),
        React.createElement(Text, { style: styles.subtitle },
          `발송 ${new Date().toLocaleDateString("ko-KR")} · 운영부 상황실`),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionLabelChip }, "요청자 / 백업자"),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(View, { style: styles.metaItem },
            React.createElement(Text, { style: styles.metaLabel }, "요청자"),
            React.createElement(Text, { style: styles.metaValue },
              `${baseFixture.requesterName} (${baseFixture.requesterEmail}) [TEST]`),
          ),
        ),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(View, { style: styles.metaItem },
            React.createElement(Text, { style: styles.metaLabel }, "백업자"),
            React.createElement(Text, { style: styles.metaValue },
              `${substituteName} (${substituteEmail})`),
          ),
        ),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionLabelChip }, "휴가 / 외근 기간"),
        React.createElement(Text, { style: styles.metaValue }, leaveRange),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionLabelChip, minPresenceAhead: 40 }, "공통 메모"),
        React.createElement(View, { style: styles.summaryBox },
          React.createElement(Text, { style: styles.summaryText }, baseFixture.summaryMd),
        ),
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionLabelChip, minPresenceAhead: 40 }, "담당 서비스"),
        ...groupServices.map((s) =>
          React.createElement(View, { key: s.id, style: styles.serviceCard },
            React.createElement(Text, { style: styles.serviceHeader },
              `${s.university_name} — ${s.service_name}`),
            s.contacts.length > 0 && React.createElement(React.Fragment, null,
              React.createElement(Text, { style: styles.serviceMetaLabel }, "연락처"),
              React.createElement(View, { style: styles.chipRow },
                ...s.contacts.map((c, i) =>
                  React.createElement(Text, { key: i, style: styles.chip }, c)),
              ),
            ),
            s.note_md && React.createElement(View, { style: styles.noteBox },
              React.createElement(Text, { style: styles.noteText }, s.note_md),
            ),
          )
        ),
      ),
      React.createElement(View, { fixed: true, style: styles.runningFooter },
        React.createElement(Text, null, "운영부 상황실 자동발송"),
        React.createElement(Text, {
          render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
        }),
      ),
    )
  );
}

// HTML 본문 (mail-template.ts와 같은 톤)
const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function buildHtml({ substituteName, substituteEmail, groupServices }) {
  const serviceCardsHtml = groupServices.length === 0
    ? '<p style="color:#666;font-size:13px;">(없음)</p>'
    : groupServices.map((s) => {
        const header = `<div style="font-size:13px;color:#1a1a1a;font-weight:500;margin-bottom:6px;">${escapeHtml(s.university_name)} — ${escapeHtml(s.service_name)}</div>`;
        const contactsBlock = s.contacts.length > 0
          ? `<div style="margin-top:6px;font-size:11px;color:#666;">연락처: ${s.contacts.map(c => `<span style="border:1px solid #ddd;padding:2px 6px;font-size:11px;color:#1a1a1a;">${escapeHtml(c)}</span>`).join(" ")}</div>`
          : "";
        const noteBlock = s.note_md
          ? `<div style="margin-top:6px;font-size:12px;color:#444;border-left:2px solid #b8331e;padding:2px 10px;white-space:pre-wrap;">${escapeHtml(s.note_md)}</div>`
          : "";
        return `<div style="border:1px solid #eee;padding:10px 12px;margin-bottom:8px;">${header}${contactsBlock}${noteBlock}</div>`;
      }).join("");

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:'Pretendard',sans-serif;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="padding-bottom:12px;border-bottom:2px solid #b8331e;margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:1px;color:#b8331e;">운영부 상황실 · 백업 요청</div>
      <h1 style="margin:4px 0 0;font-size:20px;">백업 요청 (테스트)</h1>
    </div>
    <p style="font-size:14px;line-height:1.6;">
      안녕하세요 <strong>${escapeHtml(substituteName)}</strong>님,<br>
      <strong>${escapeHtml(baseFixture.requesterName)}</strong>님이 휴가 기간 동안 아래 서비스의 백업을 부탁드립니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#666;width:30%;">요청자</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(baseFixture.requesterName)} (${escapeHtml(baseFixture.requesterEmail)})</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">백업자</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(substituteName)} (${escapeHtml(substituteEmail)})</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">기간</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(leaveRange)}</td></tr>
    </table>
    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#b8331e;letter-spacing:1px;margin:0 0 8px 0;font-weight:bold;">공통 메모</p>
      <div style="border-left:3px solid #b8331e;padding:6px 12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(baseFixture.summaryMd)}</div>
    </div>
    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#b8331e;letter-spacing:1px;margin:0 0 8px 0;font-weight:bold;">담당 서비스</p>
      ${serviceCardsHtml}
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">운영부 상황실 자동발송 — 동일 내용의 PDF 파일이 첨부되어 있습니다.</div>
  </div>
</body></html>`;
}

// Graph token (1회)
const tenant = process.env.AZURE_AD_TENANT_ID;
const clientId = process.env.AZURE_AD_CLIENT_ID;
const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
if (!tenant || !clientId || !clientSecret) {
  console.error("[fatal] AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET 누락");
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
const tokenJson = await tokenRes.json();
const accessToken = tokenJson.access_token;
console.log("[graph] token OK");

// 그룹별 발송 loop (옵션 B — PDF도 그룹별 본인 담당만)
for (const [recipientEmail, group] of groups) {
  console.log(`[pdf] rendering for ${recipientEmail} (${group.services.length} services)…`);
  const pdfBuf = await renderToBuffer(buildPdfDoc({
    substituteName: group.name,
    substituteEmail: recipientEmail,
    groupServices: group.services,
  }));
  console.log(`[pdf] ${pdfBuf.length} bytes`);

  const html = buildHtml({
    substituteName: group.name,
    substituteEmail: recipientEmail,
    groupServices: group.services,
  });
  const subject = `[운영부 상황실] ${baseFixture.requesterName} 백업 요청 — ${leaveRange}`;
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`;
  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: recipientEmail, name: group.name } }],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: `backup-request-${MODE}.pdf`,
          contentType: "application/pdf",
          contentBytes: pdfBuf.toString("base64"),
        },
      ],
    },
    saveToSentItems: true,
  };

  console.log(`[send] to=${recipientEmail} subject="${subject}"`);
  const sendRes = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!sendRes.ok) {
    console.error(`[fail] sendMail to ${recipientEmail}:`, sendRes.status, await sendRes.text());
    continue;
  }
  console.log(`[OK] ${recipientEmail} 발송 성공 (${sendRes.status})`);
}
console.log(`\n[done] ${groups.size} group(s) sent`);
