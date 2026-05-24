import type { ScheduleEventRow, ScheduleType } from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";

export type CalendarCategory =
  | "service-start"
  | "service-end"
  | ScheduleType; // shift / event / leave / training

export type CalendarSourceVariant = "schedule" | "services";

export type CalendarItem = {
  id: string;
  ymd: string;
  category: CalendarCategory;
  label: string;
  /** 정렬 키: all_day=true는 그대로 "", false면 시작 시각 KST HH:mm */
  sortKey: string;
  all_day: boolean;
  sourceVariant: CalendarSourceVariant;
  /** Inspector에 전달할 원본 row (variant에 따라 ScheduleEventRow 또는 ServicesRow) */
  rowRef: ScheduleEventRow | ServicesRow;
};

export type CalendarCell = {
  /** KST 기준 자정의 Date (정렬·비교 용) */
  date: Date;
  /** KST YYYY-MM-DD */
  ymd: string;
  /** 표시 월에 속하는지 (전/익월이면 false) */
  inMonth: boolean;
};

const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function toKstYmd(iso: string): string {
  return YMD_FORMATTER.format(new Date(iso));
}

function toKstSortKey(iso: string, allDay: boolean): string {
  if (allDay) return "";
  // 24h HH:mm — 정렬에 그대로 사용 가능
  return TIME_FORMATTER.format(new Date(iso));
}

/**
 * 주어진 month의 1일 KST 기준으로 직전 일요일부터 시작하는 42셀(6주) 그리드를 만든다.
 * 일관성을 위해 6주 고정 — 다음달 일부 셀이 포함될 수 있다.
 */
export function buildMonthGrid(year: number, month0: number): CalendarCell[] {
  // UTC noon을 앵커로 — 어떤 시간대에서도 정오는 같은 calendar day.
  // KST(UTC+9) 기준 정오 UTC = 21시 KST이지만, 날짜는 동일.
  const firstNoonUtc = new Date(Date.UTC(year, month0, 1, 12));
  const dow = firstNoonUtc.getUTCDay(); // 0=일

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - dow;
    const d = new Date(Date.UTC(year, month0, 1 + offset, 12));
    const ymd = YMD_FORMATTER.format(d);
    const month0OfCell = Number(ymd.slice(5, 7)) - 1;
    cells.push({
      date: d,
      ymd,
      inMonth: month0OfCell === month0,
    });
  }
  return cells;
}

export function groupItemsByDay(
  events: ScheduleEventRow[],
  services: ServicesRow[],
): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();

  const push = (ymd: string, item: CalendarItem) => {
    const list = map.get(ymd);
    if (list) list.push(item);
    else map.set(ymd, [item]);
  };

  for (const e of events) {
    const startYmd = toKstYmd(e.start_at);
    push(startYmd, {
      id: e.id,
      ymd: startYmd,
      category: e.type,
      label: e.title,
      sortKey: toKstSortKey(e.start_at, e.all_day),
      all_day: e.all_day,
      sourceVariant: "schedule",
      rowRef: e,
    });
    // 멀티데이 일정: 종료일이 시작일과 다르면 종료 ymd에도 push (services 패턴 정합).
    // rowRef는 동일 event라 두 셀에서 인스펙터 열어도 같은 row 표시.
    if (e.end_at) {
      const endYmd = toKstYmd(e.end_at);
      if (endYmd !== startYmd) {
        push(endYmd, {
          id: `${e.id}::end`,
          ymd: endYmd,
          category: e.type,
          label: e.title,
          sortKey: toKstSortKey(e.end_at, e.all_day),
          all_day: e.all_day,
          sourceVariant: "schedule",
          rowRef: e,
        });
      }
    }
  }

  for (const s of services) {
    if (s.write_start_at) {
      const ymd = toKstYmd(s.write_start_at);
      push(ymd, {
        id: `${s.id}::start`,
        ymd,
        category: "service-start",
        label: s.service_name,
        sortKey: "",
        all_day: true,
        sourceVariant: "services",
        rowRef: s,
      });
    }
    if (s.write_end_at) {
      const ymd = toKstYmd(s.write_end_at);
      push(ymd, {
        id: `${s.id}::end`,
        ymd,
        category: "service-end",
        label: s.service_name,
        sortKey: "",
        all_day: true,
        sourceVariant: "services",
        rowRef: s,
      });
    }
  }

  // 셀별 정렬: all_day 먼저, 그 다음 sortKey 오름차순 (안정 정렬)
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return a.sortKey.localeCompare(b.sortKey);
    });
  }

  return map;
}
