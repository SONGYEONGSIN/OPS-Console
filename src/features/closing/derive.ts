import type { ClosingRow } from "./schemas";

/**
 * closing_services 파생 — 개요 페이지의 "오픈 예정 / 마감 임박" 집합을 순수 함수로 계산.
 * mine 필터는 listClosing(operatorName)가 DB에서 처리하므로 여기선 날짜 기준만 본다.
 * 날짜 비교는 ISO 문자열 앞 10자(YYYY-MM-DD) 사전식 비교 — 입력은 KST offset ISO8601.
 */

const ymd = (iso: string) => iso.slice(0, 10);

/** YYYY-MM-DD 에 일수를 더한 YYYY-MM-DD (UTC 산술로 DST 무관). */
function addDaysYmd(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 작성마감(write_end_at)이 오늘 ~ 오늘+withinDays(기본 3) 인 건. write_end_at 오름차순. */
export function imminentClosings(
  rows: ClosingRow[],
  todayYmd: string,
  withinDays = 3,
): ClosingRow[] {
  const upper = addDaysYmd(todayYmd, withinDays);
  return rows
    .filter((r) => {
      const end = ymd(r.write_end_at);
      return end >= todayYmd && end <= upper;
    })
    .sort((a, b) => a.write_end_at.localeCompare(b.write_end_at));
}

/** 작성시작(write_start_at)이 오늘 이상인 오픈 예정 건. write_start_at 오름차순. */
export function upcomingOpens(
  rows: ClosingRow[],
  todayYmd: string,
): ClosingRow[] {
  return rows
    .filter((r) => !!r.write_start_at && ymd(r.write_start_at) >= todayYmd)
    .sort((a, b) =>
      (a.write_start_at ?? "").localeCompare(b.write_start_at ?? ""),
    );
}
