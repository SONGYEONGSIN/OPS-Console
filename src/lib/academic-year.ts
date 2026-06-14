/**
 * 학년도(academic year) 범위 계산.
 *
 * 학년도는 3월 1일 시작 ~ 익년 2월 말 종료. 예: 2027학년도 = 2026-03-01 ~ 2027-02-28.
 * 시작연도(3/1 기준)의 +1이 학년도 라벨이다.
 *
 * @param todayYmd "YYYY-MM-DD" (KST 기준 권장)
 * @returns { start: "YYYY-03-01", end: "YYYY-03-01"(exclusive), label: 학년도 }
 */
export function academicYearRange(todayYmd: string): {
  start: string;
  end: string;
  label: number;
} {
  const [year, month] = todayYmd.split("-").map(Number);
  const startYear = month >= 3 ? year : year - 1;
  return {
    start: `${startYear}-03-01`,
    end: `${startYear + 1}-03-01`,
    label: startYear + 1,
  };
}
