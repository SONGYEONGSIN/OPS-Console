import { z } from "zod";

export const REPORT_STATUS_VALUES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "sent",
] as const;
export const reportStatusSchema = z.enum(REPORT_STATUS_VALUES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "작성중",
  pending_approval: "승인대기",
  approved: "승인완료",
  rejected: "반려",
  sent: "발송완료",
};

export const incidentReportRowSchema = z.object({
  id: z.string().uuid(),
  incident_id: z.string().uuid().nullable(),
  recipient_university: z.string().min(1),
  title: z.string().min(1),
  draft_date: z.string(),
  gyeongwi: z.string().nullable(),
  cause: z.string().nullable(),
  handling: z.string().nullable(),
  prevention: z.string().nullable(),
  apology: z.string().nullable(),
  author_name: z.string(),
  author_email: z.string().email(),
  approver_name: z.string().nullable(),
  approver_email: z.string().email().nullable(),
  director_name: z.string().nullable(),
  ceo_name: z.string().nullable(),
  status: reportStatusSchema,
  reject_reason: z.string().nullable(),
  approved_at: z.string().nullable(),
  recipient_emails: z.array(z.string()),
  doc_number: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IncidentReportRow = z.infer<typeof incidentReportRowSchema>;

export const incidentReportCreateSchema = z.object({
  incident_id: z.string().uuid().nullable().optional(),
  recipient_university: z.string().min(1, "수신대학 누락"),
  title: z.string().min(1, "제목 누락").max(200),
  gyeongwi: z.string().max(5000).nullable().optional(),
  cause: z.string().max(5000).nullable().optional(),
  handling: z.string().max(5000).nullable().optional(),
  prevention: z.string().max(5000).nullable().optional(),
  apology: z.string().max(5000).nullable().optional(),
});
export type IncidentReportCreate = z.infer<typeof incidentReportCreateSchema>;

export const incidentReportUpdateSchema = incidentReportCreateSchema.partial();
export type IncidentReportUpdate = z.infer<typeof incidentReportUpdateSchema>;

export const incidentReportSendSchema = z.object({
  id: z.string().uuid(),
  recipient_emails: z.array(z.string().email()).min(1, "수신 이메일을 1개 이상 선택하세요."),
});
export type IncidentReportSend = z.infer<typeof incidentReportSendSchema>;
