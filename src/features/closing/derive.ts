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

/** 결제마감(pay_end_at)이 오늘 ~ 오늘+withinDays(기본 3) 인 건. pay_end_at 오름차순. */
export function imminentClosings(
  rows: ClosingRow[],
  todayYmd: string,
  withinDays = 3,
): ClosingRow[] {
  const upper = addDaysYmd(todayYmd, withinDays);
  return rows
    .filter((r) => {
      const end = r.pay_end_at ? ymd(r.pay_end_at) : "";
      return !!end && end >= todayYmd && end <= upper;
    })
    .sort((a, b) => (a.pay_end_at ?? "").localeCompare(b.pay_end_at ?? ""));
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

/**
 * 작성시작(write_start_at)이 오늘 ~ 오늘+withinDays(기본 7) 범위인 오픈 예정 건.
 * 긴급도 분류(triage)의 '오늘'·'이번 주' 버킷 노출용 — 건수 제한 없이 전부 포함하되,
 * 그보다 먼 미래 오픈은 '추적중' 비대를 막기 위해 제외한다. write_start_at 오름차순.
 */
export function openingsWithin(
  rows: ClosingRow[],
  todayYmd: string,
  withinDays = 7,
): ClosingRow[] {
  const upper = addDaysYmd(todayYmd, withinDays);
  return rows
    .filter((r) => {
      const start = r.write_start_at ? ymd(r.write_start_at) : "";
      return !!start && start >= todayYmd && start <= upper;
    })
    .sort((a, b) =>
      (a.write_start_at ?? "").localeCompare(b.write_start_at ?? ""),
    );
}
