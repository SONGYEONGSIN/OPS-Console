import type { ServiceDetail } from "./schemas";

export type BackupMailInput = {
  requesterName: string;
  requesterEmail: string;
  substituteName: string;
  substituteEmail: string;
  leaveStartDate: string | null;
  leaveEndDate: string | null;
  /** PR-2: services는 join 결과 — 대학명·서비스명 정규화 표기에 사용 */
  services: ServiceDetail[];
  contacts: string[];
  summaryMd: string;
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

function leaveRangeLabel(input: BackupMailInput): string {
  if (input.leaveStartDate && input.leaveEndDate) {
    return `${input.leaveStartDate} ~ ${input.leaveEndDate}`;
  }
  if (input.leaveStartDate) return `${input.leaveStartDate} ~`;
  return "미지정";
}

/** 메일 제목 */
export function buildBackupMailSubject(input: BackupMailInput): string {
  const range = leaveRangeLabel(input);
  if (range === "미지정") {
    return `[Folio] ${input.requesterName} 백업 요청`;
  }
  return `[Folio] ${input.requesterName} 백업 요청 — ${range}`;
}

function textChipsHtml(items: string[]): string {
  if (items.length === 0)
    return '<p style="color:#666;font-size:13px;">(없음)</p>';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">${items
    .map(
      (s) =>
        `<span style="background:#f4eddd;padding:3px 8px;border-radius:4px;font-size:12px;color:#1a1a1a;">${escapeHtml(s)}</span>`,
    )
    .join("")}</div>`;
}

/**
 * services chips — PR-2 정규화 표기 "대학명 — 서비스명".
 * 빈 배열은 "(없음)" 플레이스홀더. escapeHtml 양쪽 적용.
 */
function serviceChipsHtml(items: ServiceDetail[]): string {
  if (items.length === 0)
    return '<p style="color:#666;font-size:13px;">(없음)</p>';
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">${items
    .map(
      (s) =>
        `<span style="background:#f4eddd;padding:3px 8px;border-radius:4px;font-size:12px;color:#1a1a1a;">${escapeHtml(s.university_name)} — ${escapeHtml(s.service_name)}</span>`,
    )
    .join("")}</div>`;
}

/** 메일 본문 HTML */
export function buildBackupMailHtml(input: BackupMailInput): string {
  const range = leaveRangeLabel(input);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>백업 요청</title>
</head>
<body style="font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;background:#f7f4ec;margin:0;padding:24px;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;border-top:3px solid #b8331e;">
    <h1 style="font-size:20px;margin:0 0 4px 0;">백업 요청</h1>
    <p style="color:#666;font-size:13px;margin:0 0 24px 0;">Folio</p>

    <p style="font-size:14px;line-height:1.6;margin:0 0 20px 0;">
      안녕하세요 <strong>${escapeHtml(input.substituteName)}</strong>님,<br>
      <strong>${escapeHtml(input.requesterName)}</strong>님이 휴가·외근 기간 동안의 백업을 부탁드립니다.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;width:30%;">요청자</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.requesterName)} (${escapeHtml(input.requesterEmail)})</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">백업자</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(input.substituteName)} (${escapeHtml(input.substituteEmail)})</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">기간</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(range)}</td>
      </tr>
    </table>

    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">담당 서비스</p>
      ${serviceChipsHtml(input.services)}
    </div>

    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">대학 연락처</p>
      ${textChipsHtml(input.contacts)}
    </div>

    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px 0;">백업 내용</p>
      <div style="background:#f4eddd;padding:16px;border-radius:4px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.summaryMd)}</div>
    </div>

    <p style="font-size:12px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
      이 메일은 Folio에서 자동 발송되었습니다. 동일 내용의 PDF 파일이 첨부되어 있습니다.
    </p>
  </div>
</body>
</html>`;
}
