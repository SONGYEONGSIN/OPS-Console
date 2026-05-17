#!/usr/bin/env node
// 인수인계 메일 발송 single-shot 테스트
//   node scripts/handover-mail-test.mjs                       # 기본 (첫 ready record)
//   TARGET_EMAIL=ys1114@jinhakapply.com node scripts/handover-mail-test.mjs
//   SERVICE_ID=6007001 node scripts/handover-mail-test.mjs    # service_id 지정
//
// 실 Graph API 호출 + PDF 첨부. DB 변경 없음. 본인 메일박스에서 본인에게 발송.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const TARGET_EMAIL = process.env.TARGET_EMAIL ?? "ys1114@jinhakapply.com";
const TARGET_NAME = process.env.TARGET_NAME ?? "송영신";
const SENDER_EMAIL = TARGET_EMAIL; // 본인 → 본인 (단순 테스트)
const SERVICE_ID_FILTER = process.env.SERVICE_ID
  ? Number(process.env.SERVICE_ID)
  : null;

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 1) ready record + service fetch
let query = supabase
  .from("handover_records")
  .select(
    "contract_info_md, contract_data_md, work_basic_md, work_generator_md, work_site_md, work_output_md, work_rate_md, work_file_md, work_etc_md, payment_fee_md, payment_invoice_md, school_contact_md, docs_md, notes_md, services(service_id, university_name, service_name, application_type)",
  )
  .eq("status", "ready")
  .limit(1);
const { data, error } = await query;
if (error) {
  console.error("[fatal] fetch fail:", error.message);
  process.exit(1);
}
let target = data?.[0];
if (SERVICE_ID_FILTER) {
  const { data: filtered } = await supabase
    .from("handover_records")
    .select(
      "contract_info_md, contract_data_md, work_basic_md, work_generator_md, work_site_md, work_output_md, work_rate_md, work_file_md, work_etc_md, payment_fee_md, payment_invoice_md, school_contact_md, docs_md, notes_md, services!inner(service_id, university_name, service_name, application_type)",
    )
    .eq("status", "ready")
    .eq("services.service_id", SERVICE_ID_FILTER)
    .limit(1);
  target = filtered?.[0];
}
if (!target || !target.services) {
  console.error("[fatal] 작성완료(ready) handover record 없음");
  process.exit(1);
}
const svc = target.services;
console.log(`[target] ${svc.service_id} ${svc.university_name} · ${svc.service_name}`);

// 2) Pretendard 폰트 등록 + PDF render
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

const HANDOVER_CATEGORIES = [
  { key: "contract", label: "계약", fields: [
    { key: "contract_info_md", label: "계약정보" },
    { key: "contract_data_md", label: "계약자료" },
  ]},
  { key: "work", label: "작업", fields: [
    { key: "work_basic_md", label: "기초작업" },
    { key: "work_generator_md", label: "생성툴" },
    { key: "work_site_md", label: "사이트·페이지" },
    { key: "work_output_md", label: "출력물" },
    { key: "work_rate_md", label: "경쟁률" },
    { key: "work_file_md", label: "전산파일" },
    { key: "work_etc_md", label: "기타" },
  ]},
  { key: "payment", label: "정산", fields: [
    { key: "payment_fee_md", label: "전형료" },
    { key: "payment_invoice_md", label: "계산서" },
  ]},
  { key: "contact", label: "연락처", fields: [{ key: "school_contact_md", label: "학교담당자" }]},
  { key: "docs", label: "서류제출", fields: [{ key: "docs_md", label: "서류제출" }]},
  { key: "etc", label: "기타", fields: [{ key: "notes_md", label: "특이사항" }]},
];

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 10,
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
  header: {
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#b8331e",
  },
  title: { fontSize: 19, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 9, color: "#666" },
  meta: { marginBottom: 24, padding: 12, backgroundColor: "#f4eddd" },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { fontSize: 9, color: "#666", width: 70 },
  metaValue: { fontSize: 10, flex: 1 },
  cat: { marginBottom: 20 },
  catTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: "#b8331e",
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  field: {
    marginBottom: 14,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#eee",
  },
  fLabel: { fontSize: 11, fontWeight: 700, color: "#b8331e", marginBottom: 5 },
  fVal: { fontSize: 10, lineHeight: 1.7 },
  fEmpty: { fontSize: 9, color: "#bbb" },
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
});

const headerLine = `${svc.university_name} · ${svc.service_name}`;

const doc = React.createElement(Document, null,
  React.createElement(Page, { size: "A4", style: styles.page },
    React.createElement(View, { fixed: true, style: styles.runningHeader },
      React.createElement(Text, { style: styles.runningHeaderLeft }, headerLine),
      React.createElement(Text, { style: styles.runningHeaderRight }, "운영부 상황실 · 인수인계"),
    ),
    React.createElement(View, { style: styles.header },
      React.createElement(Text, { style: styles.title }, `인수인계 — ${svc.university_name} · ${svc.service_name}`),
      React.createElement(Text, { style: styles.subtitle }, `${svc.application_type} · 발송 ${new Date().toLocaleDateString("ko-KR")} · 운영부 상황실`),
    ),
    React.createElement(View, { style: styles.meta },
      React.createElement(View, { style: styles.metaRow },
        React.createElement(Text, { style: styles.metaLabel }, "인계자"),
        React.createElement(Text, { style: styles.metaValue }, `${TARGET_NAME} (${SENDER_EMAIL}) [TEST]`),
      ),
      React.createElement(View, { style: styles.metaRow },
        React.createElement(Text, { style: styles.metaLabel }, "인수자"),
        React.createElement(Text, { style: styles.metaValue }, `${TARGET_NAME} (${TARGET_EMAIL})`),
      ),
    ),
    ...HANDOVER_CATEGORIES.map((cat) =>
      React.createElement(View, { key: cat.key, style: styles.cat, minPresenceAhead: 100 },
        React.createElement(Text, { style: styles.catTitle }, cat.label),
        ...cat.fields.map((f) => {
          const v = (target[f.key] ?? "").trim();
          return React.createElement(View, { key: f.key, style: styles.field },
            React.createElement(Text, { style: styles.fLabel }, f.label),
            v
              ? React.createElement(Text, { style: styles.fVal }, v)
              : React.createElement(Text, { style: styles.fEmpty }, "(미작성)"),
          );
        }),
      )
    ),
    React.createElement(View, { fixed: true, style: styles.runningFooter },
      React.createElement(Text, null, "운영부 상황실 자동발송"),
      React.createElement(Text, {
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`,
      }),
    ),
  )
);

console.log("[pdf] rendering…");
const pdfBuf = await renderToBuffer(doc);
console.log(`[pdf] ${pdfBuf.length} bytes`);

// 3) HTML 본문
const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:'Pretendard',sans-serif;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="padding-bottom:12px;border-bottom:2px solid #b8331e;margin-bottom:20px;">
      <div style="font-size:11px;letter-spacing:1px;color:#b8331e;">운영부 상황실 · 인수인계</div>
      <h1 style="margin:4px 0 0;font-size:20px;">${svc.university_name} · ${svc.service_name}</h1>
      <div style="margin-top:4px;font-size:12px;color:#666;">${svc.application_type}</div>
    </div>
    <p style="font-size:14px;">테스트 발송입니다. 첨부 PDF에 14개 항목이 정리되어 있습니다.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#666;width:30%;">인계자</td><td style="padding:6px 0;font-size:13px;">${TARGET_NAME} (${SENDER_EMAIL})</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#666;">인수자</td><td style="padding:6px 0;font-size:13px;">${TARGET_NAME} (${TARGET_EMAIL})</td></tr>
    </table>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">운영부 상황실 자동발송</div>
  </div>
</body></html>`;

// 4) Graph sendMail — client_credentials 직접 호출 (src/lib/microsoft/auth.ts 미러)
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

const subject = `[운영부 상황실] 인수인계 요청 — ${svc.university_name} · ${svc.service_name}`;
const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_EMAIL)}/sendMail`;
const payload = {
  message: {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: [{ emailAddress: { address: TARGET_EMAIL, name: TARGET_NAME } }],
    attachments: [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `handover-${svc.service_id}-${svc.university_name}.pdf`,
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
} else {
  const txt = await res.text();
  console.error(`[fail] ${res.status} ${txt.slice(0, 500)}`);
  process.exit(1);
}
