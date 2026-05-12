import type { ListRow, Filter } from "../../../patterns/ListPattern";

export const SCHEDULE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "shift", label: "시프트" },
  { value: "event", label: "이벤트" },
  { value: "leave", label: "휴가" },
  { value: "training", label: "교육" },
];

export function blankScheduleRow(): ListRow {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    scheduleType: "event",
    start_at: now.toISOString(),
    end_at: inOneHour.toISOString(),
    allDay: false,
    assigneeEmail: null,
  };
}
