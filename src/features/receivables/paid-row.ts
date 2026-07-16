/**
 * 관리대장 행의 입금완료(수금) 판정 — 단일 소스.
 * 미수채권 메뉴(_row-mapper)와 운영리포트 미수채권 합산이 공용한다.
 *
 * - 적요에 '입금완료'(공백 허용) 표기 → 수금 (입금매칭 자동화 K열 표기 포함)
 * - 상태 컬럼에 수금/완료/입금 포함 && 미수/미입금 미포함 → 수금
 */
export function isPaidReceivableRow(
  statusText: string,
  remarksText: string,
): boolean {
  return (
    /입금\s*완료/.test(remarksText) ||
    (/수금|완료|입금/.test(statusText) && !/미수|미입금/.test(statusText))
  );
}
