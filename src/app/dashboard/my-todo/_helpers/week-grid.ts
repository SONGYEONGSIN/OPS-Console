import type { TodoRow } from "@/features/todos/schemas";
import type { ServicesRow } from "@/features/services/schemas";

const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toKstYmd(iso: string): string {
  return KST_YMD.format(new Date(iso));
}

/**
 * 입력 ymd가 속한 주의 월요일 ymd 반환 (KST 기준).
 */
export function getKstWeekStart(ymd: string): string {
  // 정오 anchor — 시간대 경계 안전
  const anchor = new Date(`${ymd}T12:00:00+09:00`);
  const day = anchor.getUTCDay(); // 0=일, 1=월, ... 6=토
  const diff = day === 0 ? -6 : 1 - day; // 일요일이면 -6, 그 외 (1-day)
  const start = new Date(anchor.getTime() + diff * 24 * 60 * 60 * 1000);
  return KST_YMD.format(start);
}

/** 주간 그리드 표시 일수 (월~일 × 2주 = 14일). */
export const WEEK_GRID_DAYS = 14;

/**
 * 주 시작(월) ymd에서 14일치(2주) ymd 배열 반환.
 */
export function getKstWeekDays(weekStartYmd: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < WEEK_GRID_DAYS; i++) {
    const d = new Date(`${weekStartYmd}T12:00:00+09:00`);
    d.setUTCDate(d.getUTCDate() + i);
    result.push(KST_YMD.format(d));
  }
  return result;
}

/**
 * todos를 due_at의 KST 날짜 기준으로 7일 셀에 분배.
 * due_at이 null이거나 주 범위 밖이면 어느 셀에도 들어가지 않음.
 */
export function bucketTodosByDay(
  todos: TodoRow[],
  days: string[],
): Record<string, TodoRow[]> {
  const buckets: Record<string, TodoRow[]> = Object.fromEntries(
    days.map((d) => [d, [] as TodoRow[]]),
  );
  for (const t of todos) {
    if (!t.due_at) continue;
    const key = toKstYmd(t.due_at);
    if (buckets[key]) buckets[key].push(t);
  }
  return buckets;
}

export type DayService = { kind: "start" | "end"; service: ServicesRow };

/**
 * services의 write_start_at / write_end_at을 days 범위 안에서 ymd 키로 bucket.
 * 한 service가 start/end 둘 다 가지면 2개 entry 생성 (각각 kind 다름).
 */
export function bucketServicesByDay(
  services: ServicesRow[],
  days: string[],
): Record<string, DayService[]> {
  const buckets: Record<string, DayService[]> = Object.fromEntries(
    days.map((d) => [d, [] as DayService[]]),
  );
  for (const s of services) {
    if (s.write_start_at) {
      const key = toKstYmd(s.write_start_at);
      if (buckets[key]) buckets[key].push({ kind: "start", service: s });
    }
    if (s.write_end_at) {
      const key = toKstYmd(s.write_end_at);
      if (buckets[key]) buckets[key].push({ kind: "end", service: s });
    }
  }
  return buckets;
}
