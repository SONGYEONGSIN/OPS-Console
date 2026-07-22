import { z } from "zod";

export const DEPARTMENTS = [
  "기획파트",
  "운영부",
  "고객지원팀",
  "개발부",
  "영업부",
] as const;
export const STATUSES = ["done", "in_progress", "todo", "na"] as const;

export type Department = (typeof DEPARTMENTS)[number];
export type ItemStatus = (typeof STATUSES)[number];

export const departmentSchema = z.enum(DEPARTMENTS);
export const statusSchema = z.enum(STATUSES);

export const itemPatchSchema = z.object({
  status: statusSchema.nullable().optional(),
  note: z.string().max(2000).optional(),
  title: z.string().min(1).max(500).optional(),
  category: z.string().max(200).optional(),
});
export type ItemPatch = z.infer<typeof itemPatchSchema>;

export const createRoundSchema = z.object({
  title: z.string().min(1).max(200),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  seed: z.enum(["template", "clone", "empty"]),
  cloneFromRoundId: z.string().uuid().optional(),
});
export type CreateRoundInput = z.infer<typeof createRoundSchema>;

export type ChecklistRound = {
  id: string;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: "draft" | "active" | "closed";
  createdBy: string | null;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  roundId: string;
  department: Department;
  category: string;
  title: string;
  status: ItemStatus | null;
  note: string;
  sortOrder: number;
  attachments: string[];
};

// 공유 토큰: fill = 전 부서 통합 작성 링크, report = 임원 보고(읽기) 링크. (각 회차당 1개씩)
export type ShareToken = {
  id: string;
  roundId: string;
  kind: "fill" | "report";
  department: Department | null;
  token: string;
  enabled: boolean;
};
