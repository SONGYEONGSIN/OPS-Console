import { escapeHtml } from "@/features/receivables/mail-template";
import type { NoticeKind, RequestItem } from "./types";

const NOTICE = "이 메일은 SMS 발신번호 사전등록 신청 목록을 보고 자동으로 보냈습니다.";
const NEW_LEAD = "SMS 발신번호 사전등록 신청이 들어왔습니다.";
const DONE_LEAD = "신청하신 SMS 발신번호 사전등록 처리가 완료됐습니다.";

function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#666;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`;
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
      ? `<p><a href="${escapeHtml(item.webUrl)}">신청 목록에서 보기</a></p>`
      : "";

  const html = `<div style="font-family:sans-serif;font-size:14px;color:#222;">
<p>${kind === "new" ? NEW_LEAD : DONE_LEAD}</p>
<table style="border-collapse:collapse;">${rows}</table>
${link}
<p style="color:#888;font-size:12px;">${NOTICE}</p>
</div>`;
  return { subject, html };
}
