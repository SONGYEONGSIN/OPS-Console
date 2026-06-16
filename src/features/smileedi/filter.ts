import type { SmileEdiRow } from "./types";

/**
 * 발송 대상 필터 — 3조건 AND.
 *   1. 상태 = '미승인' (이미 '승인'된 건은 발송 제외)
 *   2. 이메일오류 ≠ 'Y' (대소문자 무시)
 *   3. 품목키워드 매치 — 행의 텍스트 필드 중 하나라도 키워드 포함
 */
export function filterSendable(
  rows: SmileEdiRow[],
  itemKeywords: string[],
): SmileEdiRow[] {
  return rows.filter((r) => {
    // 상태가 '미승인'인 건만 발송 — '승인'(이미 승인 완료)은 제외.
    if (r.status.trim() !== "미승인") return false;

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
