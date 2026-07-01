import { brandLogoImg } from "@/lib/mail/brand-logo";
import { HANDOVER_CATEGORIES, type HandoverFieldKey } from "./categories";
import { isHandoverFieldComplete } from "./completion";

/** 메일 본문에 펼침(<details>)으로 노출할 인수인계 내용 (PDF와 동일 데이터). */
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

/** escape된 텍스트의 http(s) URL을 클릭 가능한 <a>로 + 줄바꿈 <br>. */
function textHtml(s: string): string {
  return escapeHtml(s)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" style="color:#1d4ed8;">$1</a>',
    )
    .replace(/\n/g, "<br>");
}

export function buildHandoverMailSubject(input: {
  universityName: string;
  serviceName: string;
}): string {
  return `[운영부 상황실] 인수인계 요청 — ${input.universityName} · ${input.serviceName}`;
}

/** 필드별 본문 HTML — 구조화 필드는 데이터로 렌더, 빈 필드는 (미작성). */
function fieldBodyHtml(
  input: HandoverMailInput,
  data: Record<string, unknown>,
  key: HandoverFieldKey,
): string {
  if (!isHandoverFieldComplete(data, key)) {
    return `<div style="color:#bbb;font-size:12px;">(미작성)</div>`;
  }
  const line = (s: string) =>
    `<div style="font-size:13px;line-height:1.6;">${s}</div>`;

  if (key === "contract_info_md") {
    const c = input.contractInfo;
    return [
      c.title && `제목 : ${textHtml(c.title)}`,
      c.type && `형태 : ${textHtml(c.type)}`,
      c.progress && `진행 : ${textHtml(c.progress)}`,
      c.status && `상태 : ${textHtml(c.status)}`,
      c.memo && `메모 : ${textHtml(c.memo)}`,
    ]
      .filter(Boolean)
      .map((s) => line(s as string))
      .join("");
  }
  if (key === "contract_data_md" || key === "docs_md") {
    const isDocs = key === "docs_md";
    const list = isDocs ? input.docsChecklist : input.contractChecklist;
    const memo = (input.fields[key] ?? "").trim();
    const items = list
      .filter((c) => c.text.trim())
      .map((c) => line(`${c.done ? "☑" : "☐"} ${textHtml(c.text)}`))
      .join("");
    return items + (memo ? line(`메모: ${textHtml(memo)}`) : "");
  }
  if (key === "payment_fee_md") {
    const p = input.paymentFee;
    return [
      p.deadline && `정산기한 : ${textHtml(p.deadline)}`,
      p.manager && `담당자 : ${textHtml(p.manager)}`,
      p.memo && `메모 : ${textHtml(p.memo)}`,
    ]
      .filter(Boolean)
      .map((s) => line(s as string))
      .join("");
  }
  if (key === "payment_invoice_md") {
    const p = input.paymentInvoice;
    return [
      p.issueType && `발행유형 : ${textHtml(p.issueType)}`,
      p.memo && `메모 : ${textHtml(p.memo)}`,
    ]
      .filter(Boolean)
      .map((s) => line(s as string))
      .join("");
  }
  if (key === "school_contact_md") {
    return input.schoolContacts
      .map((c) =>
        line(
          `${escapeHtml(c.name)}${c.jobTitle ? ` (${escapeHtml(c.jobTitle)})` : ""}` +
            `${c.phone ? ` · ${escapeHtml(c.phone)}` : ""}` +
            `${c.email ? ` · ${escapeHtml(c.email)}` : ""}`,
        ),
      )
      .join("");
  }
  return line(textHtml((input.fields[key] ?? "").trim()));
}

/**
 * 인수인계 내용 — 카테고리별 <details> 접기 섹션.
 * 클릭 시 펼침을 지원하는 메일 클라이언트(Apple Mail/Outlook 등)에선 토글로,
 * <details>를 제거하는 Gmail에선 내용이 펼쳐진 채로 표시(폴백)된다.
 */
function contentHtml(input: HandoverMailInput): string {
  const data: Record<string, unknown> = {
    ...input.fields,
    contract_info: input.contractInfo,
    contract_data_checklist: input.contractChecklist,
    docs_checklist: input.docsChecklist,
    payment_fee: input.paymentFee,
    payment_invoice: input.paymentInvoice,
    school_contacts: input.schoolContacts,
  };
  const sections = HANDOVER_CATEGORIES.map((cat) => {
    const total = cat.fields.length;
    const filled = cat.fields.filter((f) =>
      isHandoverFieldComplete(data, f.key),
    ).length;
    const body = cat.fields
      .map(
        (f) => `
        <div style="margin:8px 0;padding-left:10px;border-left:2px solid #eee;">
          <div style="font-size:12px;font-weight:700;color:#b8331e;margin-bottom:3px;">${escapeHtml(f.label)}</div>
          ${fieldBodyHtml(input, data, f.key)}
        </div>`,
      )
      .join("");
    return `
      <details style="border:1px solid #e7e0d0;margin-bottom:6px;">
        <summary style="cursor:pointer;padding:10px 12px;font-size:13px;font-weight:700;border-bottom:1px solid #e7e0d0;">
          ${escapeHtml(cat.label)} <span style="color:#999;font-weight:400;">${filled}/${total}</span>
        </summary>
        <div style="padding:8px 12px 12px;">${body}</div>
      </details>`;
  }).join("");
  return `
    <div style="margin-top:8px;">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px;">인수인계 내용</div>
      ${sections}
    </div>`;
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
      아래 인수인계 내용을 펼쳐 확인하실 수 있고, 첨부 HTML 파일에도 동일하게 정리되어 있습니다.
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

    ${contentHtml(input)}

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
