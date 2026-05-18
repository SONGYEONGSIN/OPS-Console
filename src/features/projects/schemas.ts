import { z } from "zod";

export const projectPrioritySchema = z.enum(["low", "medium", "high"]);
export type ProjectPriority = z.infer<typeof projectPrioritySchema>;

export const projectStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "blocked",
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "YYYY-MM-DD 형식",
});

export const projectRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  owner_email: z.string().email(),
  start_at: dateString.nullable().optional(),
  end_at: dateString.nullable().optional(),
  priority: projectPrioritySchema,
  progress: z.number().int().min(0).max(100),
  status: projectStatusSchema,
  created_by_email: z.string().email(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProjectRow = z.infer<typeof projectRowSchema>;

export const projectCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  owner_email: z.string().email(),
  start_at: dateString.nullable().optional(),
  end_at: dateString.nullable().optional(),
  priority: projectPrioritySchema.default("medium"),
  progress: z.number().int().min(0).max(100).default(0),
  status: projectStatusSchema.default("todo"),
  created_by_email: z.string().email(),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  owner_email: z.string().email().optional(),
  start_at: dateString.nullable().optional(),
  end_at: dateString.nullable().optional(),
  priority: projectPrioritySchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: projectStatusSchema.optional(),
});

export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;

// ─── project_tasks (1단계 sub-task)

export const projectTaskRowSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1),
  assignee_email: z.string().email().nullable().optional(),
  start_at: dateString.nullable().optional(),
  end_at: dateString.nullable().optional(),
  priority: projectPrioritySchema,
  progress: z.number().int().min(0).max(100),
  status: projectStatusSchema,
  created_by_email: z.string().email(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ProjectTaskRow = z.infer<typeof projectTaskRowSchema>;

export const projectTaskCreateSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  assignee_email: z.string().email().nullable().optional(),
  start_at: dateString.nullable().optional(),
  end_at: dateString.nullable().optional(),
  priority: projectPrioritySchema.default("medium"),
  progress: z.number().int().min(0).max(100).default(0),
  status: projectStatusSchema.default("todo"),
  created_by_email: z.string().email(),
});

export type ProjectTaskCreate = z.infer<typeof projectTaskCreateSchema>;

export const projectTaskUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  assignee_email: z.string().email().nullable().optional(),
  start_at: dateString.nullable().optional(),
  end_at: dateString.nullable().optional(),
  priority: projectPrioritySchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: projectStatusSchema.optional(),
});

export type ProjectTaskUpdate = z.infer<typeof projectTaskUpdateSchema>;
