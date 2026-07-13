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
export const operatorRoleSchema = z.enum([
  "부장",
  "팀장",
  "TL",
  "매니저",
  "본부장",
  "사장",
  "이사",
]);
export const operatorGenderSchema = z.enum(["남", "여"]);

export const operatorPermissionSchema = z.enum([
  "admin",
  "member",
  "viewer",
]);

export type OperatorPermission = z.infer<typeof operatorPermissionSchema>;

export const PERMISSION_LABEL: Record<OperatorPermission, string> = {
  admin: "관리자",
  member: "구성원",
  viewer: "뷰어",
};

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
  permission: operatorPermissionSchema,
  allowed_menus: z.array(z.string()).default([]),
  mail_cc_excluded: z.boolean().default(false),
  leader: z.string().nullable(),
  phone: z.string().nullable().optional(),
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
  permission: operatorPermissionSchema.optional(),
  allowed_menus: z.array(z.string()).optional(),
  mail_cc_excluded: z.boolean().optional(),
  leader: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
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
  permission: operatorPermissionSchema.default("member"),
  allowed_menus: z.array(z.string()).default([]),
  leader: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export type OperatorCreate = z.infer<typeof operatorCreateSchema>;

/** 본인 프로필 update — name만 허용. 권한/팀/역할은 admin 영역. extra key는 strip. */
export const ownProfileUpdateSchema = z.object({
  name: z.string().min(1).max(40),
});

export type OwnProfileUpdate = z.infer<typeof ownProfileUpdateSchema>;
