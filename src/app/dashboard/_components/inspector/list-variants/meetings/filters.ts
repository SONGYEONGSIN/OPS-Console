import type { ListRow, Filter } from "../../../patterns/ListPattern";
import {
  MEETING_TYPES,
  MEETING_TYPE_LABELS,
  MEETING_STATUSES,
  MEETING_STATUS_LABELS,
} from "@/features/meetings/schemas";

/** 회의록 filter chip — 전체 + 유형(5) + 상태(2). value는 Filter union의 MeetingFilter. */
export const MEETING_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  ...MEETING_TYPES.map((t) => ({ value: t, label: MEETING_TYPE_LABELS[t] })),
  ...MEETING_STATUSES.map((s) => ({
    value: s,
    label: MEETING_STATUS_LABELS[s],
  })),
];

/** '+ 회의록 작성' 신규 행 factory. 작성자는 page.tsx에서 currentUserName 주입. */
export function blankMeetingRow(opts?: { currentUserName?: string }): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: opts?.currentUserName ?? "",
    meetingType: "regular",
    meetingTitle: "",
    meetingDate: null,
    meetingAuthor: opts?.currentUserName ?? "",
    meetingStatus: "draft",
  };
}

const TYPE_VALUES = new Set<string>(MEETING_TYPES);
const STATUS_VALUES = new Set<string>(MEETING_STATUSES);

/** meetings variant 필터 적용 — 유형(meetingType) 또는 상태(meetingStatus) 매칭. */
export function applyMeetingFilter(
  rows: ListRow[],
  filter: Filter,
): ListRow[] {
  if (filter === "all") return rows;
  if (TYPE_VALUES.has(filter))
    return rows.filter((r) => r.meetingType === filter);
  if (STATUS_VALUES.has(filter))
    return rows.filter((r) => r.meetingStatus === filter);
  return rows;
}
