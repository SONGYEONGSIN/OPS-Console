import { z } from "zod";

export const operatorStatusSchema = z.enum([
  "active",
  "inactive",
  "suspended",
  "deleted",
]);

export type OperatorStatus = z.infer<typeof operatorStatusSchema>;

export const STATUS_LABEL: Record<OperatorStatus, string> = {
  active: "활성",
  inactive: "점검중",
  suspended: "정지",
  deleted: "삭제",
};

export const operatorTeamSchema = z.enum(["운영1팀", "운영2팀"]);
export const operatorRoleSchema = z.enum(["부장", "팀장", "TL", "매니저"]);
export const operatorGenderSchema = z.enum(["남", "여"]);

export const operatorRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  team: operatorTeamSchema,
  role: operatorRoleSchema,
  emp_no: z.string().min(1),
  hired_at: z.string(),
  birth_date: z.string(),
  gender: operatorGenderSchema,
  division: z.string(),
  department: z.string(),
  status: operatorStatusSchema,
  leader: z.string().nullable(),
  deleted_reason: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type OperatorRow = z.infer<typeof operatorRowSchema>;

export const operatorUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  team: operatorTeamSchema.optional(),
  role: operatorRoleSchema.optional(),
  emp_no: z.string().min(1).optional(),
  hired_at: z.string().optional(),
  birth_date: z.string().optional(),
  gender: operatorGenderSchema.optional(),
  status: operatorStatusSchema.optional(),
  leader: z.string().nullable().optional(),
  deleted_reason: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
});

export type OperatorUpdate = z.infer<typeof operatorUpdateSchema>;

export const operatorCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  team: operatorTeamSchema,
  role: operatorRoleSchema,
  emp_no: z.string().min(1),
  hired_at: z.string(),
  birth_date: z.string(),
  gender: operatorGenderSchema,
  status: operatorStatusSchema.default("active"),
  leader: z.string().nullable().optional(),
});

export type OperatorCreate = z.infer<typeof operatorCreateSchema>;
