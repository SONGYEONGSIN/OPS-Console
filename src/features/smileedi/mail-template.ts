import { brandLogoImg } from "@/lib/mail/brand-logo";
import type { SmileEdiGroup } from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 숫자 문자열 → 천단위 콤마 (Tax_invoice.py format_number 포팅). 숫자 없으면 원문. */
export function formatAmount(raw: string): string {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits).toLocaleString("ko-KR") : (raw ?? "").trim();
}

/** 공급가액 합계 (숫자만 추출해 합산). */
export function sumSupplyAmount(group: SmileEdiGroup): number {
  return group.rows.reduce((sum, r) => {
    const n = Number((r.supplyAmount ?? "").replace(/[^\d]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** 메일 제목 — '운영부 상황실' 브랜드 통일. */
export function buildSmileEdiSubject(managerName: string): string {
  return `[운영부 상황실] 역발행 세금계산서 발행 안내 (${managerName}님)`;
}

/**
 * 담당자별 세금계산서 발행 알림 HTML — 표 형태(작성일자/품목/공급가액/세액/거래처명/담당부서).
 * 브랜드 '운영부 상황실' + 시스템 로고. (Tax_invoice.py create_html_table 포팅)
 */
export function buildSmileEdiHtml(group: SmileEdiGroup): string {
  const rows = group.rows
    .map(
      (r) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;white-space:nowrap;">${escapeHtml(r.writeDate)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.item)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${escapeHtml(formatAmount(r.supplyAmount))}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${escapeHtml(formatAmount(r.taxAmount))}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.companyName)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.receiverDept)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.contactName)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;white-space:nowrap;">${escapeHtml(r.contactPhone)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(r.contactEmail)}</td>
      </tr>`,
    )
    .join("");

  const total = sumSupplyAmount(group).toLocaleString("ko-KR");

  return `
  <div style="font-family:Pretendard,Apple SD Gothic Neo,Noto Sans KR,Malgun Gothic,Arial,sans-serif;color:#222;background:#fff;padding:24px;">
    <div style="text-align:center;margin-bottom:12px;">${brandLogoImg(46)}</div>
    <div style="font-size:22px;font-weight:700;text-align:center;margin-bottom:22px;background:#111827;color:#fff;padding:16px 0;border-radius:3px;">
      역발행 세금계산서 발행 안내
    </div>

    <div style="font-size:15px;margin-bottom:10px;line-height:1.5;color:#374151;">
      안녕하세요. ${escapeHtml(group.managerName)}님,<br/>
      담당 거래처의 역발행 세금계산서 발행 내역입니다. 확인 부탁드립니다. (총 ${group.rows.length}건)
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:640px;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
            <th style="padding:10px;text-align:center;">작성일자</th>
            <th style="padding:10px;text-align:left;">품목</th>
            <th style="padding:10px;text-align:right;">공급가액</th>
            <th style="padding:10px;text-align:right;">세액</th>
            <th style="padding:10px;text-align:left;">거래처명</th>
            <th style="padding:10px;text-align:left;">담당부서</th>
            <th style="padding:10px;text-align:left;">담당자명</th>
            <th style="padding:10px;text-align:left;">담당자연락처</th>
            <th style="padding:10px;text-align:left;">담당자이메일</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:12px;font-size:14px;font-weight:700;text-align:right;color:#b8331e;">
      공급가액 합계: ${total}원
    </div>

    <div style="margin-top:18px;font-size:13px;line-height:1.8;color:#374151;">
      ※ 역발행 세금계산서 내용 확인하여 K시스템 전표 작성해 주세요.<br/>
      ※ K시스템 전표 작성 후 김승현 매니저에게 작성완료 메일 회신해 주세요.
    </div>

    <div style="margin-top:22px;text-align:center;font-size:12px;color:#111;background:#FEF9C3;padding:8px 0;border-radius:3px;">
      ※ 본 알림 메일은 운영부 상황실에서 자동 발송되었습니다.
    </div>
  </div>`;
}
