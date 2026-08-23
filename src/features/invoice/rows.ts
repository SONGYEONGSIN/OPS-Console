import type { ClosingRow } from "@/features/closing/schemas";
import { PAYMENT_INVOICE_FIELDS } from "@/app/dashboard/_components/inspector/list-variants/handover/payment-fields";

/**
 * 계산서발행 한 줄 — **정산완료된 서비스**에 발행 기록을 붙인다.
 *
 * 목록 범위(정산완료)는 서버 쿼리가 좁힌다. 여기서는 기록을 붙이기만 하고,
 * 없으면 '아직 발행 안 함'이다.
 */

/**
 * 발행유형 — 인수인계 폼의 선택지를 그대로 쓴다.
 *
 * 문자열을 새로 적으면 그게 두 번째 표준이 되고, 두 곳이 갈라지면 어느 쪽이
 * 맞는지 알 수 없다. DB 의 check 제약도 같은 값을 쓴다.
 */
export const ISSUE_TYPES = PAYMENT_INVOICE_FIELDS[0].options as readonly string[];

export type InvoiceState = {
  settledAt: string | null;
  issuedAt: string | null;
  issueType: string | null;
  billedAmount: number | null;
};

export type InvoiceRow = ClosingRow & InvoiceState;

export function toInvoiceRows(
  services: readonly ClosingRow[],
  byServiceId: Record<number, InvoiceState>,
): InvoiceRow[] {
  return services.map((s) => {
    const state = byServiceId[s.service_id];
    return {
      ...s,
      settledAt: state?.settledAt ?? null,
      issuedAt: state?.issuedAt ?? null,
      issueType: state?.issueType ?? null,
      billedAmount: state?.billedAmount ?? null,
    };
  });
}

/**
 * 청구금액 표기. **없는 값을 0 으로 보여주지 않는다** — Moa 연동 전까지 전부
 * 비어 있고, 0 원으로 보이면 "청구할 게 없다"로 읽혀 발행을 건너뛰게 된다.
 */
export function formatBilledAmount(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString("ko-KR");
}
