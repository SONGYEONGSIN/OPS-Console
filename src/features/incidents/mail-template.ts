import { brandLogoImg } from "@/lib/mail/brand-logo";

export type IncidentMailInput = {
  year: number;
  universityName: string | null;
  appType: string;
  category: string;
  title: string;
  occurredDate: string | null;
  resolvedDate: string | null;
  causeSummary: string | null;
  rootCause: string | null;
  resolution: string | null;
  prevention: string | null;
  department: string;
  assigneeName: string;
  assigneeEmail: string;
  reporterName: string;
  reporterEmail: string;
  status: string;
};

/** HTML 특수문자 escape (XSS 방지) */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dateRangeLabel(input: IncidentMailInput): string {
  if (input.occurredDate && input.resolvedDate) {
    return `${input.occurredDate} ~ ${input.resolvedDate}`;
  }
  if (input.occurredDate) return `${input.occurredDate} ~`;
  return "미지정";
}

/** 메일 제목 — [운영부 상황실] {category} / {대학명?} / {title} */
export function buildIncidentMailSubject(input: IncidentMailInput): string {
  const parts = [input.category];
  if (input.universityName) parts.push(input.universityName);
  parts.push(input.title);
  return `[운영부 상황실] 사고보고 — ${parts.join(" / ")}`;
}

function bodySection(label: string, value: string | null): string {
  const inner = value
    ? `<div style="border-left:3px solid #b8331e;padding:6px 12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(value)}</div>`
    : `<div style="font-size:12px;color:#999999;">(작성된 내용 없음)</div>`;
  return `<div style="margin-bottom:18px;">
      <p style="font-size:11px;color:#b8331e;letter-spacing:1px;margin:0 0 8px 0;font-weight:bold;">${escapeHtml(label)}</p>
      ${inner}
    </div>`;
}

/** 메일 본문 HTML */
export function buildIncidentMailHtml(input: IncidentMailInput): string {
  const range = dateRangeLabel(input);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>사고보고</title>
</head>
<body style="font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:24px;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="padding-bottom:12px;border-bottom:2px solid #b8331e;margin-bottom:20px;">
      <div style="margin-bottom:8px;">${brandLogoImg(38)}</div>
      <div style="font-size:11px;letter-spacing:1px;color:#b8331e;margin-bottom:4px;">운영부 상황실 · 사고보고</div>
      <h1 style="margin:0;font-size:20px;line-height:1.3;">${escapeHtml(input.title)}</h1>
    </div>

    <p style="font-size:14px;line-height:1.6;margin:0 0 20px 0;">
      안녕하세요 <strong>${escapeHtml(input.reporterName)}</strong>님,<br>
      <strong>${escapeHtml(input.assigneeName)}</strong>님이 작성한 사고보고를 전달드립니다.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;width:30%;">구분</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.appType)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">카테고리</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.category)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">대학명</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.universityName ?? "미지정")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">연도</td>
        <td style="padding:6px 0;font-size:13px;">${String(input.year)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">발생/처리 일자</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(range)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">담당부서</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.department)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">담당자</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.assigneeName)} (${escapeHtml(input.assigneeEmail)})</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">보고자</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.reporterName)} (${escapeHtml(input.reporterEmail)})</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">현재상황</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.status)}</td>
      </tr>
    </table>

    ${bodySection("사고경위", input.causeSummary)}
    ${bodySection("사고원인", input.rootCause)}
    ${bodySection("사고처리", input.resolution)}
    ${bodySection("사고대책", input.prevention)}

    <p style="font-size:12px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
      운영부 상황실 자동발송 — 동일 내용의 PDF 파일이 첨부되어 있습니다.
    </p>
  </div>
</body>
</html>`;
}
