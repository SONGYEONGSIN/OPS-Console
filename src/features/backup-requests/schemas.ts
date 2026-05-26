import { z } from "zod";

export const MAIL_STATUS_VALUES = [
  "pending",
  "scheduled",
  "sending",
  "sent",
  "mail_failed",
  "dry_run",
] as const;

export const mailStatusSchema = z.enum(MAIL_STATUS_VALUES);
export type MailStatus = z.infer<typeof mailStatusSchema>;

/**
 * PR-5: 서비스별 연락처 — contacts 테이블 row의 스냅샷.
 * 객체 배열 jsonb로 저장. 메일/PDF 본문에 이메일·전화 표시 위해 객체화.
 * contact row가 추후 갱신/삭제돼도 메일 이력은 시점 데이터 유지 (audit).
 */
export const contactDetailSchema = z.object({
  contact_id: z.string().uuid(),
  customer_name: z.string().min(1),
  university_name: z.string().min(1),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
});

export type ContactDetail = z.infer<typeof contactDetailSchema>;

/**
 * services join row 상세 — PR-2: backup_request_services join + services 본체에서 필요한 필드만.
 * View/Table/메일 본문 렌더에 사용.
 * PR-3: 서비스별 백업자 (substitute_email/name) 추가. 미지정 시 backup_requests.substitute_*가 fallback.
 * PR-5: contacts는 contactDetailSchema 객체 배열. 메일/PDF에 이메일·전화 노출.
 */
export const serviceDetailSchema = z.object({
  id: z.string().uuid(),
  service_id: z.number().int().nonnegative(),
  service_name: z.string().min(1),
  university_name: z.string().min(1),
  substitute_email: z.string().email().nullable().optional(),
  substitute_name: z.string().min(1).nullable().optional(),
  contacts: z.array(contactDetailSchema).max(20).default([]),
  note_md: z.string().nullable().default(null),
});

export type ServiceDetail = z.infer<typeof serviceDetailSchema>;

/**
 * DB row 형상 (RLS authenticated 모두 read 가능).
 * PR-2: services text[] 컬럼 제거 + services_detail (join 결과) 추가.
 */
export const backupRequestRowSchema = z.object({
  id: z.string().uuid(),
  requester_email: z.string().email(),
  requester_team: z.string().nullable().optional(),
  substitute_email: z.string().email(),
  substitute_name: z.string().min(1),
  /** PR-7: 사용자 지정 제목. NULL이면 deriveTitle() fallback */
  title: z.string().nullable().optional(),
  services_detail: z.array(serviceDetailSchema).default([]),
  summary_md: z.string().min(1),
  leave_start_date: z.string().nullable().optional(),
  leave_end_date: z.string().nullable().optional(),
  mail_status: mailStatusSchema,
  mail_sent_at: z.string().nullable().optional(),
  mail_error: z.string().nullable().optional(),
  /** PR-6: 예약 발송 시각 (timestamptz). scheduled 상태일 때만 의미 있음. */
  scheduled_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type BackupRequestRow = z.infer<typeof backupRequestRowSchema>;

/**
 * 신규 등록 입력. requester_email/_team은 server action에서 현재 operator로 채움.
 * PR-3: services 입력은 {service_id, substitute_email?, substitute_name?}[] 튜플 배열.
 * substitute_* 미지정 시 default(backup_requests.substitute_email)가 server action에서 채움.
 * PR-5: contacts는 contactDetailSchema 객체 배열 (이전 string[] 라벨에서 변경).
 */
export const backupRequestServiceInputSchema = z.object({
  service_id: z.string().uuid(),
  substitute_email: z.string().email().nullable().optional(),
  substitute_name: z.string().min(1).nullable().optional(),
  contacts: z.array(contactDetailSchema).max(20).default([]),
  note_md: z.string().nullable().optional(),
});

export type BackupRequestServiceInput = z.infer<
  typeof backupRequestServiceInputSchema
>;

export const backupRequestCreateSchema = z
  .object({
    substitute_email: z.string().email("백업자 이메일 형식 오류"),
    substitute_name: z.string().min(1, "백업자 이름 누락"),
    /** PR-7: 사용자 지정 제목. 빈 문자열이면 deriveTitle fallback */
    title: z.string().max(120).optional(),
    services: z.array(backupRequestServiceInputSchema).max(20).default([]),
    summary_md: z
      .string()
      .min(1, "백업 내용은 비울 수 없습니다")
      .max(5000, "백업 내용 5000자 초과"),
    leave_start_date: z.string().min(1).nullable().optional(),
    leave_end_date: z.string().min(1).nullable().optional(),
    // 요청자 self 차단을 위해 server action에 전달되는 컨텍스트 (선택적)
    requester_email: z.string().email().optional(),
    /** PR-6: 발송 모드 — now=즉시, schedule=예약 (scheduledAt 필수) */
    mode: z.enum(["now", "schedule"]).default("now"),
    /** PR-6: datetime-local KST 문자열. mode=schedule일 때 필수. parseScheduledAtKst로 UTC Date 변환 */
    scheduledAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.requester_email &&
      data.substitute_email === data.requester_email
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["substitute_email"],
        message: "본인을 백업자로 지정할 수 없습니다",
      });
    }
    if (
      data.leave_start_date &&
      data.leave_end_date &&
      data.leave_end_date < data.leave_start_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leave_end_date"],
        message: "종료일은 시작일 이후여야 합니다",
      });
    }
    if (data.mode === "schedule" && !data.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "예약 시각은 비울 수 없습니다",
      });
    }
  });

export type BackupRequestCreate = z.infer<typeof backupRequestCreateSchema>;

export const backupRequestUpdateSchema = z
  .object({
    substitute_email: z.string().email().optional(),
    substitute_name: z.string().min(1).optional(),
    /** PR-7: 제목 갱신. null이면 deriveTitle fallback으로 되돌림 */
    title: z.string().max(120).nullable().optional(),
    services: z.array(backupRequestServiceInputSchema).max(20).optional(),
    summary_md: z.string().min(1).max(5000).optional(),
    leave_start_date: z.string().min(1).nullable().optional(),
    leave_end_date: z.string().min(1).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.leave_start_date &&
      data.leave_end_date &&
      data.leave_end_date < data.leave_start_date
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["leave_end_date"],
        message: "종료일은 시작일 이후여야 합니다",
      });
    }
  });

export type BackupRequestUpdate = z.infer<typeof backupRequestUpdateSchema>;

export const sendBackupMailInputSchema = z.object({
  backup_request_id: z.string().uuid(),
});

export type SendBackupMailInput = z.infer<typeof sendBackupMailInputSchema>;
