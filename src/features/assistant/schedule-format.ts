/**
 * 일정 시각을 KST로 바꿔 모델에 넘긴다.
 *
 * 도구가 `2027-09-11T14:59:00+00:00`을 그대로 넘기고 있었다. 그러자 답변이
 * **"14:59+00:00로 저장돼 있어 표기 기준(KST면 23:59)에 따라 달라질 수 있습니다"**
 * 처럼 나왔다(2026-08-19 실측). 마감 시각을 묻는 사람에게 이런 답은 쓸모가 없다.
 *
 * DB는 정상이다 — `timestamptz`로 제대로 들어 있다. 모델에게 UTC 원본을 주면서
 * 해석을 떠넘긴 게 문제였다. 여기서 KST로 확정해 넘긴다.
 *
 * **원본은 함께 넘기지 않는다.** 둘 다 보이면 모델이 다시 헷갈린다.
 */

export type ScheduleRow = {
  type: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  assignee_email: string | null;
};

export type KstEvent = {
  type: string;
  title: string;
  description: string | null;
  /** KST 기준 "YYYY-MM-DD HH:mm" (종일이면 "YYYY-MM-DD") */
  start_kst: string;
  end_kst?: string;
  all_day: boolean;
  assignee_email: string | null;
};

/** KST로 찍는다. 서버 표준시가 무엇이든 결과가 같아야 한다. */
function kst(iso: string, withTime: boolean): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  if (!withTime) return date;
  // Intl 은 자정을 "24"로 줄 수 있다 — 날짜는 이미 다음날이므로 시각만 바로잡는다.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${date} ${hour}:${get("minute")}`;
}

export function toKstEvent(row: ScheduleRow): KstEvent {
  const withTime = !row.all_day;
  return {
    type: row.type,
    title: row.title,
    description: row.description,
    start_kst: kst(row.start_at, withTime),
    // 종료가 없으면 칸 자체를 만들지 않는다 — 빈 값은 "없음"과 "모름"이 섞인다.
    ...(row.end_at ? { end_kst: kst(row.end_at, withTime) } : {}),
    all_day: row.all_day,
    assignee_email: row.assignee_email,
  };
}
