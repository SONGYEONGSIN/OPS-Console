import { z } from "zod";

/** PR-6: 구분 — services.application_type과 별개의 incidents 전용 분류. PR-7로 PIMS 추가 */
export const APP_TYPE_VALUES = [
  "공통원서",
  "일반원서",
  "공공원서",
  "PIMS",
] as const;

/** PR-6: 담당부서 — operators.team(운영1팀/운영2팀)에 "운영부-" prefix 적용한 표시값 */
export const DEPARTMENT_VALUES = [
  "운영부-운영1팀",
  "운영부-운영2팀",
] as const;

/** PR-6: 현재상황 — 4단계 */
export const STATUS_VALUES = [
  "미처리",
  "처리중",
  "처리완료",
  "보류",
] as const;

export const appTypeSchema = z.enum(APP_TYPE_VALUES);
export const departmentSchema = z.enum(DEPARTMENT_VALUES);
export const statusSchema = z.enum(STATUS_VALUES);

export type IncidentAppType = z.infer<typeof appTypeSchema>;
export type IncidentDepartment = z.infer<typeof departmentSchema>;
export type IncidentStatus = z.infer<typeof statusSchema>;

/**
 * DB row 형상. RLS authenticated 모두 read.
 */
export const incidentRowSchema = z.object({
  id: z.string().uuid(),
  year: z.number().int().min(2000).max(3000),
  university_name: z.string().min(1).nullable(),
  app_type: appTypeSchema,
  category: z.string().min(1),
  occurred_date: z.string().nullable().optional(),
  resolved_date: z.string().nullable().optional(),
  title: z.string().min(1),
  cause_summary: z.string().nullable().optional(),
  root_cause: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  prevention: z.string().nullable().optional(),
  department: departmentSchema,
  assignee_email: z.string().email().nullable(),
  assignee_name: z.string().min(1).nullable(),
  reporter_email: z.string().email(),
  reporter_name: z.string().min(1),
  status: statusSchema.default("미처리"),
  created_at: z.string(),
  updated_at: z.string(),
});

export type IncidentRow = z.infer<typeof incidentRowSchema>;

/**
 * 신규 등록 입력. assignee_*는 server action에서 본인으로 자동, reporter_*는 부서별 매핑.
 */
export const incidentCreateSchema = z.object({
  year: z.number().int().min(2000).max(3000),
  university_name: z.string().min(1, "대학명 누락"),
  app_type: appTypeSchema,
  category: z.string().min(1, "카테고리 누락").max(50),
  occurred_date: z.string().min(1).nullable().optional(),
  resolved_date: z.string().min(1).nullable().optional(),
  title: z.string().min(1, "사고제목 누락").max(200),
  cause_summary: z.string().max(5000).nullable().optional(),
  root_cause: z.string().max(5000).nullable().optional(),
  resolution: z.string().max(5000).nullable().optional(),
  prevention: z.string().max(5000).nullable().optional(),
  department: departmentSchema,
  status: statusSchema.default("미처리"),
});

export type IncidentCreate = z.infer<typeof incidentCreateSchema>;

export const incidentUpdateSchema = incidentCreateSchema.partial();
export type IncidentUpdate = z.infer<typeof incidentUpdateSchema>;
