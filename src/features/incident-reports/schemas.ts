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

/** 경위서가 연결 사고의 현재값을 라이브 미러하는지 여부.
 *  승인·발송 전(draft/rejected/pending_approval)은 사고가 단일 진실원 → 라이브 미러.
 *  승인 시 동결 스냅샷이 report 컬럼에 박히므로 approved/sent만 report 값(스냅샷)을 사용한다. */
export function isReportLiveMirrored(status: ReportStatus): boolean {
  return status !== "approved" && status !== "sent";
}

/** 경위서 본문 "3. 처리" 시간/내용 2열 표의 한 행. */
export const handlingRowSchema = z.object({
  time: z.string().max(100),
  content: z.string().max(2000),
});
export type HandlingRow = z.infer<typeof handlingRowSchema>;

export const incidentReportRowSchema = z.object({
  id: z.string().uuid(),
  incident_id: z.string().uuid().nullable(),
  recipient_university: z.string().min(1),
  /** 서비스명 — 승인 시 동결 스냅샷. draft에서는 연결 사고에서 라이브 표시. */
  service_name: z.string().nullable().optional(),
  title: z.string().min(1),
  draft_date: z.string(),
  gyeongwi: z.string().nullable(),
  cause: z.string().nullable(),
  handling: z.string().nullable(),
  handling_rows: z.array(handlingRowSchema).default([]),
  prevention: z.string().nullable(),
  apology: z.string().nullable(),
  /** 공문 1번 인사말·3번 맺음말 — null이면 자동 문구. */
  greeting: z.string().nullable().optional(),
  closing: z.string().nullable().optional(),
  author_name: z.string(),
  author_email: z.string().email(),
  approver_name: z.string().nullable(),
  approver_email: z.string().email().nullable(),
  approver_role: z.string().nullable().default(null),
  director_name: z.string().nullable(),
  director_role: z.string().nullable().default(null),
  ceo_name: z.string().nullable(),
  ceo_role: z.string().nullable().default(null),
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
  incident_id: z.string().uuid("사고 연결 누락"),
  // 수신대학·제목은 사고(incident)에서 파생 — 미지정 시 action에서 사고로부터 채움.
  recipient_university: z.string().min(1, "수신대학 누락").optional(),
  title: z.string().min(1, "제목 누락").max(200).optional(),
  gyeongwi: z.string().max(5000).nullable().optional(),
  cause: z.string().max(5000).nullable().optional(),
  handling: z.string().max(5000).nullable().optional(),
  handling_rows: z.array(handlingRowSchema).max(50).optional(),
  prevention: z.string().max(5000).nullable().optional(),
  apology: z.string().max(5000).nullable().optional(),
  greeting: z.string().max(1000).nullable().optional(),
  closing: z.string().max(1000).nullable().optional(),
});
export type IncidentReportCreate = z.infer<typeof incidentReportCreateSchema>;

export const incidentReportUpdateSchema = incidentReportCreateSchema.partial();
export type IncidentReportUpdate = z.infer<typeof incidentReportUpdateSchema>;

export const incidentReportSendSchema = z.object({
  id: z.string().uuid(),
  recipient_emails: z
    .array(z.string().email())
    .min(1, "수신 이메일을 1개 이상 선택하세요."),
});
export type IncidentReportSend = z.infer<typeof incidentReportSendSchema>;
