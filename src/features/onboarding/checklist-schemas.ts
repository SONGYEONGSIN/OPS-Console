import { z } from "zod";

export const checklistItemRowSchema = z.object({
  id: z.string().uuid(),
  cohort_id: z.string().uuid(),
  section_key: z.string().min(1),
  item_key: z.string().min(1),
  checked: z.boolean(),
  checked_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ChecklistItemRow = z.infer<typeof checklistItemRowSchema>;

export const checklistToggleSchema = z.object({
  cohort_id: z.string().uuid(),
  section_key: z.string().min(1),
  item_key: z.string().min(1),
  checked: z.boolean(),
});

export type ChecklistToggle = z.infer<typeof checklistToggleSchema>;
