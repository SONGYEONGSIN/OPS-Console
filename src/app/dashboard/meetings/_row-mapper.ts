import type { ListRow } from "../_components/patterns/ListPattern";
import type { MeetingRow } from "@/features/meetings/schemas";

/**
 * MeetingRow → ListRow 매핑. meetings variant의 Table/View가 읽는 meeting* 필드를 채운다.
 * status는 ListRow 공통 enum(meeting의 draft/sent와 다름)이라 중립값 "active" 고정 —
 * 작성상태 필터·표시는 meetingStatus로 분리한다.
 */
export function meetingToListRow(meeting: MeetingRow): ListRow {
  return {
    id: meeting.id,
    name: meeting.title || "(제목 없음)",
    status: "active",
    owner: meeting.author_email,
    meetingType: meeting.type,
    meetingTitle: meeting.title,
    meetingDate: meeting.meeting_date ?? null,
    meetingAuthor: meeting.author_email,
    meetingStatus: meeting.status,
  };
}
