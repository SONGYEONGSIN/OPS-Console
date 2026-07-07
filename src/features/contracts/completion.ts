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

/** 'YYYY-MM'의 직전 월 (연 경계 처리). */
export function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}
