import type { ServiceDetail } from "./schemas";
import { brandLogoImg } from "@/lib/mail/brand-logo";

export type BackupMailInput = {
  requesterName: string;
  requesterEmail: string;
  substituteName: string;
  substituteEmail: string;
  leaveStartDate: string | null;
  leaveEndDate: string | null;
  /** PR-2/4: services join 결과. 원소마다 contacts/note_md (PR-4) 포함 */
  services: ServiceDetail[];
  /** 공통 메모 (전체 휴가 컨텍스트). 서비스별 메모는 services[*].note_md */
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
    return `[운영부 상황실] ${input.requesterName} 백업 요청`;
  }
  return `[운영부 상황실] ${input.requesterName} 백업 요청 — ${range}`;
}

/**
 * PR-5: 연락처 chip 한 줄 텍스트 렌더 — "{학교} — {이름}  {이메일} · {전화} · 내선 {ext}"
 * 이메일/전화/내선은 모두 nullable. 값이 있는 항목만 합쳐 표시.
 */
function contactChipsHtml(items: ServiceDetail["contacts"]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;">${items
    .map((c) => {
      const label = `${escapeHtml(c.university_name)} — ${escapeHtml(c.customer_name)}`;
      const meta: string[] = [];
      if (c.email) meta.push(escapeHtml(c.email));
      if (c.phone) meta.push(escapeHtml(c.phone));
      if (c.ext) meta.push(`내선 ${escapeHtml(c.ext)}`);
      const metaText =
        meta.length > 0
          ? ` <span style="color:#666;">${meta.join(" · ")}</span>`
          : "";
      return `<span style="border:1px solid #ddd;padding:2px 6px;font-size:11px;color:#1a1a1a;">${label}${metaText}</span>`;
    })
    .join("")}</div>`;
}

/**
 * 서비스 카드 HTML.
 * 헤더 (대학명 — 서비스명) + 연락처 (있을 때만) + 메모 (있을 때만).
 * 빈 contacts/note_md는 섹션 자체를 출력하지 않음 (DOM 최소화).
 */
function serviceCardHtml(s: ServiceDetail): string {
  const header = `<div style="font-size:13px;color:#1a1a1a;font-weight:500;margin-bottom:6px;">${escapeHtml(s.university_name)} — ${escapeHtml(s.service_name)}</div>`;
  const contactsBlock =
    s.contacts.length > 0
      ? `<div style="margin-top:6px;"><span style="font-size:11px;color:#666;">연락처:</span> ${contactChipsHtml(s.contacts)}</div>`
      : "";
  const noteBlock = s.note_md
    ? `<div style="margin-top:6px;font-size:12px;color:#444;border-left:2px solid #b8331e;padding:2px 10px;white-space:pre-wrap;">${escapeHtml(s.note_md)}</div>`
    : "";
  return `<div style="border:1px solid #eee;padding:10px 12px;margin-bottom:8px;">${header}${contactsBlock}${noteBlock}</div>`;
}

/**
 * services를 서비스 카드로 렌더. 빈 배열은 "(없음)" 플레이스홀더.
 */
function serviceCardsHtml(items: ServiceDetail[]): string {
  if (items.length === 0)
    return '<p style="color:#666;font-size:13px;">(없음)</p>';
  return items.map(serviceCardHtml).join("");
}

/**
 * PR-3: services를 substitute_email별로 그룹화.
 * 미지정 행은 default substitute_email로 fallback.
 * back-compat: 모든 서비스가 동일 substitute_email이면 단일 그룹 (1명 일괄 케이스 동일 동작).
 */
export function groupServicesBySubstitute(
  services: ServiceDetail[],
  defaultSubstituteEmail: string,
  defaultSubstituteName: string,
): Map<string, { name: string; services: ServiceDetail[] }> {
  const groups = new Map<string, { name: string; services: ServiceDetail[] }>();
  for (const s of services) {
    const email = s.substitute_email ?? defaultSubstituteEmail;
    const name = s.substitute_name ?? defaultSubstituteName;
    const existing = groups.get(email);
    if (existing) {
      existing.services.push(s);
    } else {
      groups.set(email, { name, services: [s] });
    }
  }
  return groups;
}

/** 메일 본문 HTML — PR-4: 공통 메모 상단 + 서비스 카드(연락처/메모 포함) 본문 */
export function buildBackupMailHtml(input: BackupMailInput): string {
  const range = leaveRangeLabel(input);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>백업 요청</title>
</head>
<body style="font-family:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:24px;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="padding-bottom:12px;border-bottom:2px solid #b8331e;margin-bottom:20px;">
      <div style="margin-bottom:8px;">${brandLogoImg(38)}</div>
      <div style="font-size:11px;letter-spacing:1px;color:#b8331e;margin-bottom:4px;">운영부 상황실 · 백업 요청</div>
      <h1 style="margin:0;font-size:20px;line-height:1.3;">백업 요청</h1>
    </div>

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
      <p style="font-size:11px;color:#b8331e;letter-spacing:1px;margin:0 0 8px 0;font-weight:bold;">공통 메모</p>
      <div style="border-left:3px solid #b8331e;padding:6px 12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.summaryMd)}</div>
    </div>

    <div style="margin-bottom:20px;">
      <p style="font-size:11px;color:#b8331e;letter-spacing:1px;margin:0 0 8px 0;font-weight:bold;">백업 서비스</p>
      ${serviceCardsHtml(input.services)}
    </div>

    <p style="font-size:12px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
      운영부 상황실 자동발송 — 동일 내용의 PDF 파일이 첨부되어 있습니다.
    </p>
  </div>
</body>
</html>`;
}
