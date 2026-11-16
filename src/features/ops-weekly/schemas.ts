// 주간업무보고 DB 행 스키마 — 마이그레이션 컬럼과 같다. 권한 판정용 변환은 `weekStateOf` 하나다.
import { z } from "zod";
import { AREAS, REPORT_STATUSES, WEEK_STATUSES } from "./constants";
import { autoSnapshotSchema } from "./merge";
import type { WeekState } from "./permissions";

export const weekRowSchema = z.object({
  id: z.string(),
  week_start: z.string(),
  label_year: z.number().int(),
  label_month: z.number().int(),
  label_week: z.number().int(),
  duty_email: z.string().nullable(),
  summary_this: z.string(),
  summary_next: z.string(),
  status: z.enum(WEEK_STATUSES),
  reported_at: z.string().nullable(),
  reported_by: z.string().nullable(),
  reopened_at: z.string().nullable(),
  reopened_by: z.string().nullable(),
});
export type WeekRow = z.infer<typeof weekRowSchema>;

// 스냅샷은 스키마 버전이 바뀐 옛 행이면 읽히지 않는다. 그때는 null 로 두어 살아 있는 계산으로 돌아간다(의도된 규칙).
const snapshotSchema = z.unknown().transform((value) => {
  const parsed = autoSnapshotSchema.nullable().safeParse(value ?? null);
  return parsed.success ? parsed.data : null;
});

export const reportRowSchema = z.object({
  id: z.string(),
  week_id: z.string(),
  operator_email: z.string(),
  status: z.enum(REPORT_STATUSES),
  submitted_at: z.string().nullable(),
  returned_at: z.string().nullable(),
  returned_by: z.string().nullable(),
  return_reason: z.string().nullable(),
  snapshot: snapshotSchema,
  checked_tabs: z.array(z.enum(AREAS)),
});
export type ReportRow = z.infer<typeof reportRowSchema>;

/** `WeekRow` 를 권한 판정(`permissions.ts`)에 넘기는 유일한 변환이다. */
export function weekStateOf(row: WeekRow): WeekState {
  return {
    status: row.status,
    dutyEmail: row.duty_email,
    reopenedAt: row.reopened_at,
  };
}
