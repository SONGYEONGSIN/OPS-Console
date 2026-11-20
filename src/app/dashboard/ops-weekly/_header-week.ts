import type { WeekRow } from "@/features/ops-weekly/schemas";

/**
 * 주 머리띠가 읽는 칸만 — 클라이언트 컴포넌트에 넘긴 객체는 키가 모두 RSC 응답에 실리므로
 * 당번 총평(summary_this·summary_next)처럼 제출 현황 데이터는 여기에 담지 않는다.
 */
export type HeaderWeek = Pick<WeekRow, "week_start" | "status" | "reported_at">;

export function headerWeekOf(week: WeekRow): HeaderWeek {
  return {
    week_start: week.week_start,
    status: week.status,
    reported_at: week.reported_at,
  };
}
