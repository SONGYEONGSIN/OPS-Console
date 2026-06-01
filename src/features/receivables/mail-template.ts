import type { ReminderGroup } from "./mail-schemas";
import { brandLogoImg } from "@/lib/mail/brand-logo";

/** HTML 특수문자 escape (XSS 방지) */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 통화 — 천 단위 콤마 + "원" 접미사 */
export function formatWon(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

function uniqueCustomers(group: ReminderGroup): string[] {
  return Array.from(
    new Set(group.items.map((it) => it.customerName).filter(Boolean)),
  );
}

/**
 * 본문 인사말에 쓸 발신자명 — 그룹 청구건의 실제 담당 운영자명.
 * 운영자가 유일하면 그 이름, 비어있거나 복수(모호)면 fallback(발송 트리거한 운영자명).
 * 독려메일은 admin이 대신 발송해도 본문은 채권 담당 운영자 이름으로 나가야 한다.
 */
export function resolveSenderName(
  group: ReminderGroup,
  fallback: string,
): string {
  const operators = Array.from(
    new Set(group.items.map((it) => it.operatorLabel?.trim()).filter(Boolean)),
  );
  return operators.length === 1 ? operators[0]! : fallback;
}

/** 메일 제목 */
export function buildReminderSubject(args: {
  group: ReminderGroup;
  companyName: string;
}): string {
  const { group, companyName } = args;
  const customers = uniqueCustomers(group);
  if (customers.length === 1) {
    return `[${companyName}] ${customers[0]} 세금계산서 확인 요청`;
  }
  return `[${companyName}] 세금계산서 확인 요청 (${group.items.length}건)`;
}

/** 메일 본문 HTML 빌더 */
export function buildReminderHtml(args: {
  group: ReminderGroup;
  senderName: string;
  companyName: string;
}): string {
  const { group, senderName, companyName } = args;
  const customers = uniqueCustomers(group);
  const customerLabel = customers.length === 1 ? customers[0] : "귀사";

  const rowsHtml = group.items
    .map(
      (it) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(it.invoiceDate)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(it.customerName)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(it.description)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">D+${it.daysOverdue}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${formatWon(it.amount)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(it.operatorLabel)}</td>
    </tr>`,
    )
    .join("");

  return `
  <div style="font-family:Pretendard,Apple SD Gothic Neo,Noto Sans KR,Malgun Gothic,Arial,sans-serif;color:#222;background:#fff;padding:24px;">

    <div style="text-align:center;margin-bottom:12px;">${brandLogoImg(46)}</div>
    <div style="font-size:22px;font-weight:700;text-align:center;margin-bottom:22px;background:#111827;color:#fff;padding:16px 0;border-radius:3px;">
      😊 세금계산서 확인 요청
    </div>

    <div style="font-size:15px;margin-bottom:12px;line-height:1.5;color:#374151;">
      안녕하세요.<br/>
      ${escapeHtml(companyName)} ${escapeHtml(senderName)}입니다.<br/><br/>

      <strong>${escapeHtml(customerLabel)} 세금계산서 확인 요청 건으로 메일드립니다.</strong><br/>
      아래 청구드린 세금계산서 확인 부탁드립니다.
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:650px;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
            <th style="padding:10px;text-align:center;">청구일자</th>
            <th style="padding:10px;text-align:left;">거래처명</th>
            <th style="padding:10px;text-align:left;">거래내역</th>
            <th style="padding:10px;text-align:center;">경과일수</th>
            <th style="padding:10px;text-align:right;">청구금액</th>
            <th style="padding:10px;text-align:center;">운영자</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>
    </div><br/>

    <div style="font-size:15px;margin-bottom:12px;line-height:1.5;color:#374151;">
      <strong>해당 계산서 입금 완료된 경우 "입금일자" 회신 주시면 내부 처리 진행하겠습니다.</strong><br/>
      감사합니다.
    </div>

    <div style="margin-top:22px;text-align:center;font-size:12px;color:#111;background:#FEF9C3;padding:8px 0;border-radius:3px;">
      ※ 본 세금계산서 확인 요청 메일은 시스템에서 자동 발송되었습니다.
    </div>
  </div>`;
}
