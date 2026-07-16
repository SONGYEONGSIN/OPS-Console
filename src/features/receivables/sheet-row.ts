/**
 * 관리대장 데이터 행 판정 — 단일 소스.
 * 미수채권 메뉴(isReceivablesDataRow)와 운영리포트 합산이 공용한다.
 *
 * - 셀 어딘가에 합계/소계/총계류 라벨이 있으면 요약 행 → 제외
 * - 청구일자가 비어 있으면 데이터 행 아님 → 제외
 */
const SUMMARY_RE = /^\s*(소\s*계|합\s*계|총\s*계|부분\s*합|누\s*계|총합|합산)/;

export function isReceivablesDataCells(
  cells: readonly string[],
  dateText: string,
): boolean {
  for (const c of cells) {
    if (SUMMARY_RE.test(String(c ?? ""))) return false;
  }
  return dateText.trim() !== "";
}
