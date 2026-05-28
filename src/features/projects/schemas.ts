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

/**
 * 체크리스트 항목 — 하위 업무의 세부 작업 체크리스트.
 * 최대 10개. 체크 완료 비율로 progress 자동 산출 (actions.ts).
 */
export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(200),
  done: z.boolean().default(false),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const CHECKLIST_MAX = 10;

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
  checklist: z.array(checklistItemSchema).max(CHECKLIST_MAX).default([]),
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
  checklist: z.array(checklistItemSchema).max(CHECKLIST_MAX).default([]),
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
  checklist: z.array(checklistItemSchema).max(CHECKLIST_MAX).optional(),
});

export type ProjectTaskUpdate = z.infer<typeof projectTaskUpdateSchema>;

/**
 * 체크리스트 기반 progress 산출.
 * - 체크리스트가 있으면 (완료 개수 / 전체 개수) × 100
 * - 체크리스트가 비어있으면 입력값 그대로 (manualProgress fallback)
 */
export function computeProgressFromChecklist(
  checklist: ChecklistItem[],
  manualProgress: number,
): number {
  if (checklist.length === 0) return manualProgress;
  const done = checklist.filter((c) => c.done).length;
  return Math.round((done / checklist.length) * 100);
}
