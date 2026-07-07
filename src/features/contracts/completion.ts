/**
 * 계약 '완료' 판정 + 월 계산 (순수함수, UI/DB 무관).
 */

/** 계약진행현황 값이 '완료'인지 — 계약완료/체결완료 및 그 변형(계약완료(영업) 등). 미완료는 제외. */
export function isContractCompleted(status: string): boolean {
  const s = status.trim();
  if (s === "") return false;
  if (/미완료/.test(s)) return false;
  return /완료/.test(s);
}

/** 서비스여부 값이 'Y'인지 (공백/대소문자 허용). */
export function isServiceActive(value: string): boolean {
  return value.trim().toUpperCase() === "Y";
}

/**
 * 시트별 완료/전체 건수를 sheets 순서대로 집계 (0건 시트 포함).
 * rows는 sheet/status만 있으면 되므로 ContractRow 부분집합으로 받는다.
 */
export function tallyBySheet<S extends string>(
  rows: { sheet: S; status: string }[],
  sheets: readonly S[],
): { sheet: S; completed: number; total: number }[] {
  return sheets.map((sheet) => {
    const sheetRows = rows.filter((r) => r.sheet === sheet);
    return {
      sheet,
      completed: sheetRows.filter((r) => isContractCompleted(r.status)).length,
      total: sheetRows.length,
    };
  });
}

/** 완료율(%) = 완료/전체 × 100 (소수 1자리). 전체 0이면 null. */
export function completionRate(
  completed: number,
  total: number,
): number | null {
  if (total <= 0) return null;
  return Math.round((completed / total) * 1000) / 10;
}

/** 'YYYY-MM'의 직전 월 (연 경계 처리). */
export function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}
