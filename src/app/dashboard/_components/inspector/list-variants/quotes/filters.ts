import type { ListRow } from "../../../patterns/ListPattern";

/** 견적서 상태 필터 칩 (ScopeChips 옆). value=QuoteStatus. */
export const QUOTE_FILTERS = [
  { value: "draft", label: "작성중" },
  { value: "sent", label: "발송" },
  { value: "won", label: "수주" },
  { value: "lost", label: "실주" },
] as const;

/** '+ 새 견적서' 신규 행 factory. registry는 currentUserName을 넘기고,
 * page는 currentUserEmail을 넘긴다(담당=operators.email). 둘 다 허용. */
export function blankQuoteRow(opts?: {
  currentUserName?: string;
  currentUserEmail?: string;
}): ListRow {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  }); // YYYY-MM-DD KST
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserEmail ?? "",
    quoteCustomer: "",
    quoteDate: today,
    quoteAmount: null,
    quoteOwner: opts?.currentUserEmail ?? "",
    quoteStatus: "draft",
    quoteValidUntil: null,
    quoteNote: null,
  };
}

/** 금액 KRW 천단위 콤마. null/undefined → "—". */
export function formatKrw(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return amount.toLocaleString("ko-KR") + "원";
}
