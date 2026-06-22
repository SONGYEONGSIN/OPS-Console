import { z } from "zod";

export const todoPrioritySchema = z.enum(["low", "medium", "high"]);
export type TodoPriority = z.infer<typeof todoPrioritySchema>;

export const todoStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "blocked",
]);
export type TodoStatus = z.infer<typeof todoStatusSchema>;

export const todoRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  done: z.boolean(),
  done_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: todoPrioritySchema,
  category: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  status: todoStatusSchema.nullable().optional(),
  // services 자동 등록 연결 키(멱등) + 자동 등록 항목 soft-delete 표시.
  source_service_id: z.string().uuid().nullable().optional(),
  auto_dismissed: z.boolean().optional(),
  assignee_email: z.string().email(),
  created_by_email: z.string().email(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TodoRow = z.infer<typeof todoRowSchema>;

export const todoCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  priority: todoPrioritySchema.default("medium"),
  due_at: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  status: todoStatusSchema.nullable().optional(),
  source_service_id: z.string().uuid().nullable().optional(),
  assignee_email: z.string().email(),
  created_by_email: z.string().email(),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

export const todoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().nullable().optional(),
  done: z.boolean().optional(),
  done_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: todoPrioritySchema.optional(),
  category: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  status: todoStatusSchema.nullable().optional(),
  auto_dismissed: z.boolean().optional(),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
