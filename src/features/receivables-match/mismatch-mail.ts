import "server-only";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { escapeHtml, formatWon } from "@/features/receivables/mail-template";
import type { MismatchPair } from "./types";

const ADMIN_EMAIL = "ys1114@jinhakapply.com";
const SENDER_USER_ID = ADMIN_EMAIL; // 시스템 발송이라 admin 본인 mailbox로 발신

export type MismatchMailResult = {
  ok: boolean;
  count: number;
  dryRun?: boolean;
  skipped?: boolean;
  errorMessage?: string;
};

function buildHtml(rows: MismatchPair[]): string {
  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.misuDate)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.misuCustomer)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatWon(r.amount)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.depDate)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(r.depContent)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatWon(r.amount)}</td>
    </tr>`,
    )
    .join("");

  return `
  <div style="font-family:Pretendard,Apple SD Gothic Neo,Noto Sans KR,Malgun Gothic,Arial,sans-serif;color:#222;padding:24px;">
    <h3 style="background:#111827;color:#fff;padding:14px;border-radius:3px;text-align:center;">
      ⚠️ 입금 매칭 — 금액 일치 / 거래처명 불일치 확인 요청
    </h3>
    <p style="font-size:14px;color:#374151;line-height:1.6;">
      자동 매칭 잡(<code>receivables-deposit-match</code>)이 금액은 일치하지만 거래처명이
      달라 자동 매칭하지 않은 건입니다. 수동 확인 후 적요 표기 부탁드립니다.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <th style="padding:8px;text-align:left;">청구일</th>
          <th style="padding:8px;text-align:left;">미수 거래처</th>
          <th style="padding:8px;text-align:right;">청구금액</th>
          <th style="padding:8px;text-align:left;">입금일</th>
          <th style="padding:8px;text-align:left;">입금 거래내용</th>
          <th style="padding:8px;text-align:right;">입금금액</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="margin-top:18px;text-align:center;font-size:12px;color:#111;background:#FEF9C3;padding:8px;border-radius:3px;">
      ※ 본 알림 메일은 운영부 상황실에서 자동 발송되었습니다.
    </p>
  </div>`;
}

/**
 * GAS `notifyAmountMismatch_` 대응 — 금액 일치 / 거래처명 불일치 건을 admin에게 표 형식으로 알림.
 * - 빈 배열 → 발송 skip
 * - dryRun=true → 메일 호출 skip
 */
export async function sendMismatchReport(
  rows: MismatchPair[],
  options: { dryRun: boolean },
): Promise<MismatchMailResult> {
  if (rows.length === 0) {
    return { ok: true, count: 0, skipped: true };
  }
  if (options.dryRun) {
    return { ok: true, count: rows.length, dryRun: true };
  }

  const res = await sendGraphMail({
    senderUserId: SENDER_USER_ID,
    toEmail: ADMIN_EMAIL,
    subject: "[운영부 상황실] 입금 매칭 — 금액일치/거래처명 불일치 확인 요청",
    html: buildHtml(rows),
  });

  if (res.ok) {
    return { ok: true, count: rows.length };
  }
  return {
    ok: false,
    count: rows.length,
    errorMessage: res.error,
  };
}
