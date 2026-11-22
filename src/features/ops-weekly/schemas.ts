// 주간업무보고 DB 행 스키마 — 마이그레이션 컬럼과 같다. 권한 판정용 변환은 `weekStateOf` 하나다.
import { z } from "zod";
import { normEmail } from "./email";
import {
  AREAS,
  AUTO_AREAS,
  PROJECT_KINDS,
  PROJECT_STAGES,
  REPORT_STATUSES,
  WEEK_STATUSES,
} from "./constants";
import {
  APPLICATION_GROUP_KEYS,
  autoSnapshotSchema,
  PIMS_GROUP_KEYS,
} from "./merge";
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

/** 권한 판정에는 당번 이메일도 정규화한 키로 넘긴다 — 읽는 쪽마다 따로 하지 않는다. */
export function normalizedWeekStateOf(row: WeekRow): WeekState {
  const state = weekStateOf(row);
  return {
    ...state,
    dutyEmail: state.dutyEmail === null ? null : normEmail(state.dutyEmail),
  };
}

// ── 작성 입력 — server action 이 폼 값을 그대로 믿지 않도록 경계에서 검사한다 ──

const reportIdSchema = z.uuid("보고서 id 가 올바르지 않습니다.");
const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다.");

export const areaNoteInputSchema = z.object({
  reportId: reportIdSchema,
  area: z.enum(AREAS, "영역이 올바르지 않습니다."),
  thisWeek: z.string().max(4000, "금주 메모는 4,000자 이하입니다."),
  nextWeek: z.string().max(4000, "차주 메모는 4,000자 이하입니다."),
});

export const itemOverrideInputSchema = z.object({
  reportId: reportIdSchema,
  itemKey: z
    .string()
    .regex(
      /^(closing|pims|leave:(br|se)):[\w-]+$/,
      "항목 키가 올바르지 않습니다.",
    ),
  area: z.enum(AUTO_AREAS, "영역이 올바르지 않습니다."),
  note: z.string().max(1000, "메모는 1,000자 이하입니다.").optional(),
  excluded: z.boolean().optional(),
});

const inKeys = (keys: readonly string[], key: string | null): boolean =>
  key !== null && keys.includes(key);

export const manualItemInputSchema = z
  .object({
    reportId: reportIdSchema,
    area: z.enum(AUTO_AREAS, "영역이 올바르지 않습니다."),
    groupKey: z.string().nullable(),
    title: z
      .string()
      .trim()
      .min(1, "제목을 입력하세요.")
      .max(200, "제목은 200자 이하입니다."),
    note: z.string().max(1000, "메모는 1,000자 이하입니다.").optional(),
    periodStart: ymdSchema.nullable().optional(),
    periodEnd: ymdSchema.nullable().optional(),
    leaveKind: z.string().max(20, "구분은 20자 이하입니다.").nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.area === "application" && !inKeys(APPLICATION_GROUP_KEYS, v.groupKey)) {
      ctx.addIssue({ code: "custom", path: ["groupKey"], message: "묶음을 고르세요." });
    }
    if (v.area === "pims" && !inKeys(PIMS_GROUP_KEYS, v.groupKey)) {
      ctx.addIssue({ code: "custom", path: ["groupKey"], message: "묶음을 고르세요." });
    }
    if (v.area === "leave" && !v.periodStart) {
      ctx.addIssue({ code: "custom", path: ["periodStart"], message: "시작일을 입력하세요." });
    }
  });

// 정화 전 상한 — 정화 정규식이 입력 길이에 비례해 돌아, 상한이 없으면 한 요청이 CPU 를 오래 붙잡는다.
const rawProjectHtmlSchema = z
  .string()
  .max(200_000, "내용이 너무 깁니다(200,000자 이하).");

/** 금주·차주 HTML 은 `toStoredNoteHtml` 로 정화한 **뒤** `storedProjectHtmlSchema` 로 길이를 본다. */
export const projectEntryInputSchema = z.object({
  reportId: reportIdSchema,
  projectId: z.uuid("프로젝트 id 가 올바르지 않습니다."),
  stage: z.enum(PROJECT_STAGES, "진행 단계가 올바르지 않습니다.").nullable(),
  thisWeek: rawProjectHtmlSchema,
  nextWeek: rawProjectHtmlSchema,
});

export const storedProjectHtmlSchema = z
  .string()
  .max(50_000, "내용이 너무 깁니다(50,000자 이하).");

export const manualItemRefInputSchema = z.object({
  reportId: reportIdSchema,
  itemId: z.uuid("항목 id 가 올바르지 않습니다."),
});

export const tabCheckInputSchema = z.object({
  reportId: reportIdSchema,
  area: z.enum(AREAS, "영역이 올바르지 않습니다."),
});

export const imageUploadInputSchema = z.object({
  reportId: reportIdSchema,
  dataUrl: z.string(),
});

// ── 관리자 설정 입력 ──

const emailSchema = z
  .string()
  .trim()
  .max(254, "이메일이 너무 깁니다.")
  .pipe(z.email("이메일 형식이 올바르지 않습니다."))
  .transform((v) => v.toLowerCase());

export const emailInputSchema = z.object({ email: emailSchema });

export const rotationInputSchema = z.object({
  emails: z.array(emailSchema).max(100, "순번표가 너무 깁니다."),
  anchorWeekStart: ymdSchema.nullable(),
});

export const excludedWritersInputSchema = z.object({
  emails: z.array(emailSchema).max(200, "제외 목록이 너무 깁니다."),
});

export const includedWritersInputSchema = z.object({
  emails: z.array(emailSchema).max(50, "포함 목록이 너무 깁니다."),
});

export const projectInputSchema = z.object({
  id: z.uuid("프로젝트 id 가 올바르지 않습니다.").optional(),
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력하세요.")
    .max(50, "이름은 50자 이하입니다."),
  kind: z.enum(PROJECT_KINDS, "구분이 올바르지 않습니다."),
  sortOrder: z.number().int("정렬 순서는 정수입니다.").min(0).max(10_000),
  active: z.boolean(),
});

export const projectOwnersInputSchema = z.object({
  projectId: z.uuid("프로젝트 id 가 올바르지 않습니다."),
  emails: z.array(emailSchema).max(100, "담당자가 너무 많습니다."),
});

export const weekDutyInputSchema = z.object({
  weekId: z.uuid("주 id 가 올바르지 않습니다."),
  dutyEmail: emailSchema,
});
