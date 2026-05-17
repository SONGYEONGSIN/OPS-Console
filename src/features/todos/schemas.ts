import { z } from "zod";

export const todoPrioritySchema = z.enum(["low", "medium", "high"]);
export type TodoPriority = z.infer<typeof todoPrioritySchema>;

export const todoRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  done: z.boolean(),
  done_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: todoPrioritySchema,
  assignee_email: z.string().email(),
  created_by_email: z.string().email(),
  source_service_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TodoRow = z.infer<typeof todoRowSchema>;

export const todoCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  priority: todoPrioritySchema.default("medium"),
  due_at: z.string().nullable().optional(),
  assignee_email: z.string().email(),
  created_by_email: z.string().email(),
  source_service_id: z.string().uuid().nullable().optional(),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

export const todoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().nullable().optional(),
  done: z.boolean().optional(),
  done_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: todoPrioritySchema.optional(),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;
