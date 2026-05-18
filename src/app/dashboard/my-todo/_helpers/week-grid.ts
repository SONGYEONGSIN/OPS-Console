import type { TodoRow } from "@/features/todos/schemas";

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

/**
 * 주 시작(월) ymd에서 7일치 ymd 배열 반환.
 */
export function getKstWeekDays(weekStartYmd: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
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
