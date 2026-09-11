/**
 * 차주 — **이번 주 기준 다음 주 월요일~일요일**, 한국 날짜로.
 *
 * 일요일은 아직 이번 주라 다음 날부터가 차주이고, 월요일에 보면 오늘이 아니라
 * 그다음 월요일부터다. 주말에 여는 건도 있어 금요일에서 끊지 않는다.
 *
 * 날짜는 **KST 로 잘라서** 비교한다. `write_start_at` 이 UTC 로 저장돼 있어
 * 월요일 오전 9시 이전에 여는 건은 UTC 로는 일요일이라, 시각을 그대로 견주면
 * 차주 첫날 건이 빠진다.
 */

/** 기계용 키 `YYYY-MM-DD` — 표기가 아니라 비교용 값이다. */
const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type WeekRange = { startYmd: string; endYmd: string };

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function nextWeekRange(now: Date = new Date()): WeekRange {
  const today = KST_YMD.format(now);
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일 … 6=토
  const startYmd = addDaysYmd(today, dow === 0 ? 1 : 8 - dow);
  return { startYmd, endYmd: addDaysYmd(startYmd, 6) };
}

/** 작성시작이 차주 안에 드는가. 날짜가 없거나 깨졌으면 들지 않는다. */
export function opensNextWeek(
  writeStartAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!writeStartAt) return false;
  const t = new Date(writeStartAt);
  if (Number.isNaN(t.getTime())) return false;
  const ymd = KST_YMD.format(t);
  const { startYmd, endYmd } = nextWeekRange(now);
  return ymd >= startYmd && ymd <= endYmd;
}
