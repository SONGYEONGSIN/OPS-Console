import { z } from "zod";

export const MEETING_TYPES = ["regular", "field", "project", "memo", "urgent"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  regular: "정기회의",
  field: "외근·출장 보고",
  project: "프로젝트·킥오프",
  memo: "1:1·간단 메모",
  urgent: "긴급·이슈 대응",
};

export const MEETING_STATUSES = ["draft", "sent"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  draft: "작성중",
  sent: "발송완료",
};

export const meetingRowSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(MEETING_TYPES),
  title: z.string(),
  meeting_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  attendees: z.array(z.string()).default([]),
  author_email: z.string(),
  status: z.enum(MEETING_STATUSES),
  // v1=BlockNote 블록 배열 / v2=MeetingDoc 양식 객체. 둘 다 허용.
  content: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .default([]),
  sharepoint_url: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MeetingRow = z.infer<typeof meetingRowSchema>;

export const meetingMetaSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요"),
  meeting_date: z.string().nullable(),
  location: z.string().nullable(),
  attendees: z.array(z.string()),
});
export type MeetingMetaInput = z.infer<typeof meetingMetaSchema>;
