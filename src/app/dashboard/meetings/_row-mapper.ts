import type { ListRow } from "../_components/patterns/ListPattern";
import type { MeetingRow } from "@/features/meetings/schemas";

/**
 * MeetingRow → ListRow 매핑. meetings variant의 Table/View가 읽는 meeting* 필드를 채운다.
 * status는 ListRow 공통 enum(meeting의 draft/sent와 다름)이라 중립값 "active" 고정 —
 * 작성상태 필터·표시는 meetingStatus로 분리한다.
 *
 * authorName: operators 마스터에서 해석한 작성자 등록 이름. 미해석 시 이메일로 폴백.
 * owner는 내부 식별용이므로 이메일을 유지한다.
 */
export function meetingToListRow(
  meeting: MeetingRow,
  authorName?: string,
): ListRow {
  return {
    id: meeting.id,
    name: meeting.title || "(제목 없음)",
    status: "active",
    owner: meeting.author_email,
    meetingType: meeting.type,
    meetingTitle: meeting.title,
    meetingDate: meeting.meeting_date ?? null,
    meetingAuthor: authorName || meeting.author_email,
    meetingStatus: meeting.status,
  };
}
