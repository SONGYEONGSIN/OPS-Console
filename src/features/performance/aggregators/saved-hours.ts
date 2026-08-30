import { inRange, type MetricValue, type Period } from "./types";

/**
 * AI·자동화 절감시간 — 본인(author_email) 기간 내 `saved_hours` 합.
 *
 * '내 작업'은 건수만 세고 있었는데, 성과로 말할 때는 "몇 건"보다 **"몇 시간을
 * 아꼈나"** 가 낫다. 값은 이미 쌓여 있었다.
 */
export function aggregateSavedHours(
  rows: { author_email: string; saved_hours: number | null; created_at: string }[],
  email: string,
  p: Period,
): MetricValue {
  const mine = rows.filter(
    (r) => r.author_email === email && inRange(r.created_at, p),
  );
  // saved_hours 는 필수 입력이 아니다. null 을 0 으로 세면 합계는 같지만
  // "몇 건이 근거인가"가 틀어진다 — 근거는 값이 있는 것만 센다.
  const scored = mine.filter((r) => typeof r.saved_hours === "number");
  const sum = scored.reduce((s, r) => s + (r.saved_hours ?? 0), 0);
  return {
    // 0.1 + 0.2 = 0.30000000000000004 을 화면에 내보내지 않는다.
    value: Math.round(sum * 10) / 10,
    unit: "시간",
    detail: `${scored.length}건`,
  };
}
