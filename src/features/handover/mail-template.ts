import { brandLogoImg } from "@/lib/mail/brand-logo";
import { type HandoverFieldKey } from "./categories";

/** 인수인계 내용 데이터 — 첨부 HTML 문서(html-document) 렌더에 사용. */
export type HandoverMailContent = {
  fields: Record<HandoverFieldKey, string | null>;
  contractInfo: {
    title: string;
    type: string;
    progress: string;
    status: string;
    memo: string;
  };
  contractChecklist: { text: string; done: boolean }[];
  docsChecklist: { text: string; done: boolean }[];
  schoolContacts: {
    name: string;
    jobTitle: string | null;
    phone: string | null;
    email: string | null;
  }[];
  paymentFee: { deadline: string; manager: string; memo: string };
  paymentInvoice: { issueType: string; memo: string };
};

export type HandoverMailInput = {
  universityName: string;
  serviceName: string;
  applicationType: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  notes: string | null;
  historyUrl: string;
} & HandoverMailContent;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildHandoverMailSubject(input: {
  universityName: string;
  serviceName: string;
}): string {
  return `[운영부 상황실] 인수인계 요청 — ${input.universityName} · ${input.serviceName}`;
}

export function buildHandoverMailHtml(input: HandoverMailInput): string {
  const uni = escapeHtml(input.universityName);
  const svc = escapeHtml(input.serviceName);
  const appType = escapeHtml(input.applicationType);
  const fromName = escapeHtml(input.fromName);
  const fromEmail = escapeHtml(input.fromEmail);
  const toName = escapeHtml(input.toName);
  const toEmail = escapeHtml(input.toEmail);
  const url = escapeHtml(input.historyUrl);

  const notesBlock = input.notes
    ? `
    <div style="margin-top:20px;padding:12px;border-left:3px solid #b8331e;">
      <div style="font-size:12px;color:#666;margin-bottom:4px;">인계 메모</div>
      <div style="font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.notes)}</div>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <div style="padding-bottom:12px;border-bottom:2px solid #b8331e;margin-bottom:20px;">
      <div style="margin-bottom:8px;">${brandLogoImg(38)}</div>
      <div style="font-size:11px;letter-spacing:1px;color:#b8331e;margin-bottom:4px;">운영부 상황실 · 인수인계</div>
      <h1 style="margin:0;font-size:20px;line-height:1.3;">${uni} · ${svc}</h1>
      <div style="margin-top:4px;font-size:12px;color:#666;">${appType}</div>
    </div>

    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
      <strong>${toName}</strong>님, <strong>${fromName}</strong>님이 위 서비스를 인계 요청하셨습니다.<br>
      첨부된 HTML 파일에 인수인계 내용이 정리되어 있습니다. 파일을 내려받아 확인해 주세요.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;width:30%;">인계자</td>
        <td style="padding:6px 0;font-size:13px;">${fromName} (${fromEmail})</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666;">인수자</td>
        <td style="padding:6px 0;font-size:13px;">${toName} (${toEmail})</td>
      </tr>
    </table>
    ${notesBlock}

    <div style="margin-top:28px;">
      <a href="${url}" style="display:inline-block;padding:10px 20px;border:1px solid #1a1a1a;color:#1a1a1a;text-decoration:none;font-size:13px;letter-spacing:1px;">
        운영부 상황실에서 확인하기 →
      </a>
    </div>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eeeeee;font-size:11px;color:#999;">
      운영부 상황실 자동발송 — 인수 확인은 인수인계 &rsaquo; 인수인계 확인 탭에서 진행해 주세요.
    </div>
  </div>
</body>
</html>`;
}
