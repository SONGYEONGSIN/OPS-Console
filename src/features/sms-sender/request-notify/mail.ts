import { escapeHtml } from "@/features/receivables/mail-template";
import type { NoticeKind, RequestItem } from "./types";

const NOTICE = "이 메일은 SMS 발신번호 사전등록 신청 목록을 보고 자동으로 보냈습니다.";
const NEW_LEAD = "SMS 발신번호 사전등록 신청이 들어왔습니다.";
const DONE_LEAD = "신청하신 SMS 발신번호 사전등록 처리가 완료됐습니다.";

// Outlook 은 wrapper div 의 글꼴을 table/td 로 상속하지 않아 요소마다 명시한다.
const FONT = "font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;";
const TEXT_STYLE = `${FONT}font-size:14px;`;
const NOTICE_STYLE = `${FONT}font-size:12px;color:#888;`;

const ITEM_SUFFIX = /\/(\d+)_\.000$/;

/** Graph listItem webUrl(`.../<id>_.000`)은 파일처럼 내려받아지므로 항목 화면(DispForm)으로 바꾼다. */
export function itemDisplayUrl(webUrl: string): string {
  const match = ITEM_SUFFIX.exec(webUrl);
  if (!match) return webUrl;
  return webUrl.replace(ITEM_SUFFIX, `/DispForm.aspx?ID=${match[1]}`);
}

function row(label: string, value: string): string {
  return `<tr><td style="${TEXT_STYLE}padding:4px 12px 4px 0;color:#666;">${escapeHtml(label)}</td><td style="${TEXT_STYLE}padding:4px 0;">${escapeHtml(value)}</td></tr>`;
}

export function buildRequestMail(
  kind: NoticeKind,
  item: RequestItem,
): { subject: string; html: string } {
  const university = item.university.replace(/\s+/g, " ").trim();
  const label = kind === "new" ? "신청" : "완료";
  const subject = `[내부관리자] SMS 발신번호 사전등록 ${label} — ${university}`;

  const rows = [
    row("대학명", item.university),
    row("구분", item.kind),
    row("ServiceID", item.serviceId),
    ...(kind === "new" ? [row("신청자", item.applicantName || "-")] : []),
  ].join("");

  const link =
    item.webUrl && item.webUrl.startsWith("https://")
      ? `<p style="${TEXT_STYLE}"><a href="${escapeHtml(itemDisplayUrl(item.webUrl))}" style="${TEXT_STYLE}">신청 목록에서 보기</a></p>`
      : "";

  const html = `<div style="color:#222;">
<p style="${TEXT_STYLE}">${kind === "new" ? NEW_LEAD : DONE_LEAD}</p>
<table style="border-collapse:collapse;">${rows}</table>
${link}
<p style="${NOTICE_STYLE}">${NOTICE}</p>
</div>`;
  return { subject, html };
}
