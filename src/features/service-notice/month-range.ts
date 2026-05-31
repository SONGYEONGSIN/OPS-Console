/**
 * "다음 달" 작성시작 필터용 KST 경계 + 월 키.
 * services.write_start_at은 ISO timestamp(UTC offset 포함)이므로, KST 기준 다음 달의
 * 첫 순간(00:00 KST)과 그다음 달 첫 순간을 UTC ISO로 계산해 범위 쿼리에 쓴다.
 */

const KST_YM = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
});

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 해당 KST 연·월의 1일 00:00 KST에 대응하는 UTC instant. */
function firstOfMonthKSTasUTC(year: number, month1: number): Date {
  // Date.UTC(y, monthIdx, 1) = 00:00 UTC → 9시간 빼면 00:00 KST 동일 순간.
  return new Date(Date.UTC(year, month1 - 1, 1) - KST_OFFSET_MS);
}

export function nextMonthRangeKST(now: Date): {
  startISO: string;
  endISO: string;
  monthKey: string;
} {
  const [y, m] = KST_YM.format(now).split("-").map(Number);
  let ny = y;
  let nm = m + 1;
  if (nm === 13) {
    nm = 1;
    ny = y + 1;
  }
  let ey = ny;
  let em = nm + 1;
  if (em === 13) {
    em = 1;
    ey = ny + 1;
  }
  return {
    startISO: firstOfMonthKSTasUTC(ny, nm).toISOString(),
    endISO: firstOfMonthKSTasUTC(ey, em).toISOString(),
    monthKey: `${ny}-${String(nm).padStart(2, "0")}`,
  };
}
