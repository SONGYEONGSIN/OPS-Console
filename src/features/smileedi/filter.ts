import type { SmileEdiRow } from "./types";

/**
 * 발송 대상 필터 — Tax_invoice.py `filter_data_by_conditions`의 실제 2조건 AND.
 *   1. 이메일오류 ≠ 'Y' (대소문자 무시)
 *   2. 품목키워드 매치 — 행의 텍스트 필드 중 하나라도 키워드 포함
 *
 * (README가 적은 거래처명≠공백/공급가액≠0/승인번호≠공백 3조건은 실제 코드에 없어 적용하지 않음.)
 */
export function filterSendable(
  rows: SmileEdiRow[],
  itemKeywords: string[],
): SmileEdiRow[] {
  return rows.filter((r) => {
    const emailErrorPass = r.emailError.trim().toUpperCase() !== "Y";
    if (!emailErrorPass) return false;

    // 원본은 모든 컬럼을 스캔 — 파싱된 텍스트 필드를 합쳐 동일 의도로 검사.
    const searchText = [
      r.writeDate,
      r.item,
      r.companyName,
      r.receiverDept,
      r.supplierManager,
      r.approvalNumber,
    ].join(" ");

    return itemKeywords.some((kw) => kw && searchText.includes(kw));
  });
}
