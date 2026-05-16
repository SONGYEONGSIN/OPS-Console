/**
 * 학년도 계산 — KST 기준, 3월 시작.
 * 예: 2025.03 ~ 2026.02 → 2026학년도.
 *
 * @param now 기준 시각 (default 현재). 외부에서 Date 주입 가능 — 테스트·SSR-stable 용도.
 * @returns 학년도 정수 (예: 2027)
 */
export function currentAcademicYear(now: Date = new Date()): number {
  // Asia/Seoul timezone 강제 — UTC 자정 직전·직후 boundary 안정화
  const kst = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const month = kst.getMonth() + 1; // 1~12
  const year = kst.getFullYear();
  return month >= 3 ? year + 1 : year;
}
