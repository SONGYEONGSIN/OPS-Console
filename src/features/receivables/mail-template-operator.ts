import type { OperatorReminderGroup } from "./operator-mail-grouping";
import { escapeHtml, formatWon } from "./mail-template";

/**
 * 운영자용 메일에 한국 사이트 톤의 미수 회수 격려 인용구를 랜덤 1개 삽입.
 * GAS의 FUN_QUOTES 핵심 패턴을 압축하여 30개로 큐레이션.
 */
const FUN_QUOTES: readonly string[] = [
  "오늘도 회수의 신이 강림했습니다.",
  "통장은 거짓말을 하지 않습니다.",
  "입금이 곧 평화입니다.",
  "미수 없는 세상, 얼마나 아름다울까요?",
  "이번엔 진짜 진짜로 입금!",
  "이건 사랑이 아니라 미수입니다.",
  "정산 완료, 그것만이 진리.",
  "통장에 꽃이 피었습니다.",
  "입금은 사랑의 또 다른 표현입니다.",
  "이번 달도 슬기로운 미수생활.",
  "오늘도 입금 체크 리스트 완료?",
  "입금은 곧 신뢰입니다.",
  "미수 0%, 행복 100%",
  "송금은 최고의 매너입니다.",
  "입금이 곧 진심입니다.",
  "오늘도 채권의 평화를 위하여.",
  "정산은 미루는 게 아닙니다.",
  "입금은 인격입니다.",
  "통장도 사람입니다. 기분이 있습니다.",
  "정산 완료는 최고의 선물입니다.",
  "입금은 약속의 또 다른 이름.",
  "오늘의 키워드: #입금완료",
  "미수 없는 인생을 꿈꾸며.",
  "정산은 언제나 옳습니다.",
  "입금으로 세상을 밝히세요.",
  "입금의 미학, 완벽합니다.",
  "오늘도 즐거운 정산 되세요.",
  "통장이 말합니다. '드디어!'",
  "입금 완료, 회사의 희망입니다.",
  "정산 완료, 우리 모두의 목표입니다.",
];

function pickQuote(seed?: number): string {
  const idx = seed != null
    ? seed % FUN_QUOTES.length
    : Math.floor(Math.random() * FUN_QUOTES.length);
  return FUN_QUOTES[idx];
}

/** 메일 제목 — '운영부 상황실' 브랜드 통일 */
export function buildOperatorReminderSubject(): string {
  return "[운영부 상황실] 미수채권 확인 알림";
}

type BuildHtmlArgs = {
  group: OperatorReminderGroup;
  /** 입금완료 버튼 base URL (PR-3에서 receivables inline action으로 교체). 미지정 시 placeholder. */
  paidActionBase?: string;
  /** 테스트 결정성 위해 인용구 인덱스 고정 */
  quoteSeed?: number;
};

/**
 * 운영자 본인용 미수채권 알림 메일 HTML.
 * GAS `buildMailHtml_` 톤 유지 — Pretendard + vermilion 강조 + FUN_QUOTES 인용구.
 * 입금완료 버튼은 PR-1에서는 placeholder URL, PR-3에서 inline action으로 교체.
 */
export function buildOperatorReminderHtml(args: BuildHtmlArgs): string {
  const { group, paidActionBase = "/dashboard/receivables", quoteSeed } = args;
  const quote = pickQuote(quoteSeed);
  const operatorName = escapeHtml(group.operator.name);

  const rowsHtml = group.items
    .map((it) => {
      const paidHref =
        `${paidActionBase}?date=${encodeURIComponent(it.invoiceDate)}` +
        `&cust=${encodeURIComponent(it.customerName)}` +
        `&desc=${encodeURIComponent(it.description)}` +
        `&amt=${encodeURIComponent(String(it.amount))}`;
      return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(it.invoiceDate)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(it.customerName)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(it.description)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">D+${it.daysOverdue}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;">${formatWon(it.amount)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">
          <a href="${escapeHtml(paidHref)}" target="_blank" style="text-decoration:none;">
            <span style="display:inline-block;padding:6px 10px;border:1px solid #E5E7EB;border-radius:3px;background:#E5E7EB;color:#111;font-size:12px;">입금완료</span>
          </a>
        </td>
      </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Pretendard,Apple SD Gothic Neo,Noto Sans KR,Malgun Gothic,Arial,sans-serif;color:#222;background:#fff;padding:24px;">
    <div style="font-size:22px;font-weight:700;text-align:center;margin-bottom:22px;background:#111827;color:#fff;padding:16px 0;border-radius:3px;">
      [운영부 상황실] 미수채권 확인 알림
    </div>

    <div style="background:#FEF9C3;border-left:5px solid #FACC15;padding:14px 10px;margin-bottom:22px;border-radius:3px;font-size:14px;text-align:center;line-height:1.4;">
      <em>💬 "${escapeHtml(quote)}"</em>
    </div>

    <div style="font-size:15px;margin-bottom:12px;line-height:1.5;color:#374151;">
      안녕하세요. ${operatorName}님,<br/>
      본인 담당 미수채권을 확인하여 30일이 경과되지 않도록 조치해 주세요.
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:600px;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
            <th style="padding:10px;text-align:center;">청구일자</th>
            <th style="padding:10px;text-align:left;">거래처명</th>
            <th style="padding:10px;text-align:left;">거래내역</th>
            <th style="padding:10px;text-align:center;">경과일수</th>
            <th style="padding:10px;text-align:right;">청구금액</th>
            <th style="padding:10px;text-align:center;">입금여부</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div style="margin-top:22px;text-align:center;font-size:12px;color:#111;background:#FEF9C3;padding:8px 0;border-radius:3px;">
      ※ 본 알림 메일은 OPS-Console 자동화에서 자동 발송되었습니다.
    </div>
  </div>`;
}
