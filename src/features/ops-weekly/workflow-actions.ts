"use server";

/**
 * 주간업무보고 상태 전환 action — 제출·다시 작성·당번 요약·최종 보고·정정.
 * 폼을 믿지 않는다: 세션·보고서·주·명단을 DB 에서 다시 읽고 판정한다.
 * 전환은 전부 **조건부 update**(현재 상태를 where 에 건다)이고 0행이면 '이미 된 일'이다 —
 * 두 번 클릭·낡은 화면이 겹쳐도 전환과 이벤트는 한 번이다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canViewMenu } from "@/features/auth/permission";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./actions";
import { loadAutoSnapshot } from "./auto-queries";
import { OPS_WEEKLY_PATH, OPS_WEEKLY_SLUG } from "./constants";
import { normEmail } from "./email";
import { emitOpsWeeklyEvent } from "./events";
import {
  canEditDutySummary,
  canReopenWeek,
  canReturnReport,
  canSubmitReport,
  checkFinalize,
  type Actor,
  type FinalizeCheck,
} from "./permissions";
import { listPendingWriters, listReports } from "./report-queries";
import {
  reportRowSchema,
  normalizedWeekStateOf,
  type ReportRow,
  type WeekRow,
} from "./schemas";
import { shiftWeek } from "./week";
import { ensureWeek, getWeekById, listWriters, rowOf } from "./week-queries";

type Fail = { ok: false; error: string };
type ReportCtx = { actor: Actor; report: ReportRow; week: WeekRow };
type WeekCtx = { actor: Actor; week: WeekRow };

const OK: ActionResult = { ok: true };
const failOf = (error: string): Fail => ({ ok: false, error });
const isFail = <T extends object>(v: T | Fail): v is Fail =>
  "ok" in v && v.ok === false;

const LOCKED = "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요.";
const FORBIDDEN = "당번 또는 관리자만 할 수 있습니다.";
const ALREADY_SUBMITTED = "이미 제출한 보고서입니다.";
const NOT_SUBMITTED = "제출된 보고서만 다시 작성 요청할 수 있습니다.";

const reportIdSchema = z.object({
  reportId: z.uuid("보고서 id 가 올바르지 않습니다."),
});
const weekIdSchema = z.object({
  weekId: z.uuid("주 id 가 올바르지 않습니다."),
});
const returnSchema = reportIdSchema.extend({
  reason: z.string().trim().max(1000, "사유는 1,000자 이하입니다.").optional(),
});
const summarySchema = weekIdSchema.extend({
  thisWeek: z.string().max(4000, "금주 요약은 4,000자 이하입니다."),
  nextWeek: z.string().max(4000, "차주 요약은 4,000자 이하입니다."),
});

/** 세션 + 메뉴 권한 — 판정 전에 늘 다시 본다. */
async function currentActor(): Promise<Actor | Fail> {
  const me = await getCurrentOperator();
  if (!me) return failOf("로그인이 필요합니다.");
  if (!canViewMenu(OPS_WEEKLY_SLUG, me)) {
    return failOf("권한 없음 — 주간업무보고 메뉴를 볼 수 없습니다.");
  }
  return { email: normEmail(me.email), isAdmin: me.permission === "admin" };
}

const stateOf = normalizedWeekStateOf;

const changedRows = (data: unknown): number =>
  ((data as unknown[] | null) ?? []).length;

async function readReport(reportId: string): Promise<ReportRow | null> {
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  const row = rowOf<unknown>("ops_weekly_reports", res);
  return row === null ? null : reportRowSchema.parse(row);
}

async function loadReportCtx(
  input: unknown,
  schema: z.ZodType<{ reportId: string }>,
): Promise<ReportCtx | Fail> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const actor = await currentActor();
  if (isFail(actor)) return actor;
  const report = await readReport(parsed.data.reportId);
  const week = report === null ? null : await getWeekById(report.week_id);
  if (report === null || week === null) {
    return failOf("보고서를 찾을 수 없습니다.");
  }
  return { actor, report, week };
}

async function loadWeekCtx(input: unknown): Promise<WeekCtx | Fail> {
  const parsed = weekIdSchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const actor = await currentActor();
  if (isFail(actor)) return actor;
  const week = await getWeekById(parsed.data.weekId);
  if (week === null) return failOf("주를 찾을 수 없습니다.");
  return { actor, week };
}

function submitRejection(ctx: ReportCtx, isWriter: boolean): string {
  const { actor, report, week } = ctx;
  if (week.status !== "open") return LOCKED;
  if (report.status === "submitted") return ALREADY_SUBMITTED;
  if (actor.email !== normEmail(report.operator_email)) {
    return "본인 보고서만 제출할 수 있습니다.";
  }
  return isWriter ? "제출할 수 없는 상태입니다." : "작성 대상이 아닙니다.";
}

/** 전환은 끝났다 — 전원 제출이면 이벤트를 낸다. 확인이 실패하면 숨기지 않고 알린다. */
async function afterSubmit(week: WeekRow): Promise<ActionResult> {
  revalidatePath(OPS_WEEKLY_PATH);
  try {
    const pending = await listPendingWriters(week.id);
    if (pending.length === 0) {
      await emitOpsWeeklyEvent({
        type: "all-submitted",
        weekId: week.id,
        weekStart: week.week_start,
        dutyEmail: week.duty_email === null ? null : normEmail(week.duty_email),
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return failOf(`제출은 끝났지만 전원 제출 확인에 실패했습니다: ${msg}`);
  }
  return OK;
}

export async function submitReport(input: {
  reportId: string;
}): Promise<ActionResult> {
  const ctx = await loadReportCtx(input, reportIdSchema);
  if (isFail(ctx)) return ctx;
  const { actor, report, week } = ctx;
  const ownerEmail = normEmail(report.operator_email);
  const writers = await listWriters();
  const self = writers.find((w) => w.email === ownerEmail);
  const allowed = canSubmitReport(
    actor,
    stateOf(week),
    ownerEmail,
    self !== undefined,
    report.status,
  );
  if (!allowed || self === undefined) {
    return failOf(submitRejection(ctx, self !== undefined));
  }
  const now = new Date();
  const snapshot = await loadAutoSnapshot({
    weekStart: week.week_start,
    operatorEmail: ownerEmail,
    operatorName: self.name,
    writerNames: new Set(writers.map((w) => w.name)),
    now,
  });
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .update({
      status: "submitted",
      submitted_at: now.toISOString(),
      snapshot,
      updated_by: actor.email,
    })
    .eq("id", report.id)
    .in("status", ["draft", "returned"])
    .select("id");
  if (res.error) return failOf(`제출에 실패했습니다: ${res.error.message}`);
  if (changedRows(res.data) === 0) return failOf(ALREADY_SUBMITTED);
  return afterSubmit(week);
}

export async function returnReport(input: {
  reportId: string;
  reason?: string;
}): Promise<ActionResult> {
  const ctx = await loadReportCtx(input, returnSchema);
  if (isFail(ctx)) return ctx;
  const { actor, report, week } = ctx;
  const state = stateOf(week);
  if (state.status !== "open") return failOf(LOCKED);
  if (!canReturnReport(actor, state, report.status)) {
    const privileged = actor.isAdmin || actor.email === state.dutyEmail;
    return failOf(privileged ? NOT_SUBMITTED : FORBIDDEN);
  }
  const reason = returnSchema.parse(input).reason || null;
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .update({
      status: "returned",
      snapshot: null,
      returned_at: new Date().toISOString(),
      returned_by: actor.email,
      return_reason: reason,
      updated_by: actor.email,
    })
    .eq("id", report.id)
    .eq("status", "submitted")
    .select("id");
  if (res.error) {
    return failOf(`다시 작성 요청에 실패했습니다: ${res.error.message}`);
  }
  if (changedRows(res.data) === 0) return failOf(NOT_SUBMITTED);
  revalidatePath(OPS_WEEKLY_PATH);
  await emitOpsWeeklyEvent({
    type: "report-returned",
    weekId: week.id,
    weekStart: week.week_start,
    operatorEmail: normEmail(report.operator_email),
    returnedBy: actor.email,
    reason,
  });
  return OK;
}

export async function saveDutySummary(input: {
  weekId: string;
  thisWeek: string;
  nextWeek: string;
}): Promise<ActionResult> {
  const parsed = summarySchema.safeParse(input);
  if (!parsed.success) return failOf(parsed.error.issues[0].message);
  const ctx = await loadWeekCtx(parsed.data);
  if (isFail(ctx)) return ctx;
  const { actor, week } = ctx;
  if (week.status !== "open") return failOf(LOCKED);
  if (!canEditDutySummary(actor, stateOf(week))) return failOf(FORBIDDEN);
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .update({
      summary_this: parsed.data.thisWeek,
      summary_next: parsed.data.nextWeek,
    })
    .eq("id", week.id)
    .eq("status", "open")
    .select("id");
  if (res.error)
    return failOf(`요약 저장에 실패했습니다: ${res.error.message}`);
  if (changedRows(res.data) === 0) return failOf(LOCKED);
  revalidatePath(OPS_WEEKLY_PATH);
  return OK;
}

function finalizeRejection(
  check: Exclude<FinalizeCheck, { ok: true }>,
  names: ReadonlyMap<string, string>,
): string {
  if (check.reason === "forbidden") return FORBIDDEN;
  if (check.reason === "locked") return LOCKED;
  if (check.reason === "empty-roster") {
    return "작성 대상 명단을 읽지 못했습니다. 관리자 설정을 확인하세요.";
  }
  const who = check.pending.map((e) => names.get(e) ?? e).join(", ");
  return `아직 제출하지 않은 사람이 있습니다: ${who}`;
}

/** 이미 보고됐다 — 다음 주 행 생성이 실패해도 보고는 되돌리지 않는다(다음 접근이 만든다). */
async function openNextWeek(weekStart: string): Promise<void> {
  try {
    await ensureWeek(shiftWeek(weekStart, 1));
  } catch {
    // 지연 생성: 그 주에 처음 들어오는 사람의 접근이 같은 함수를 부른다.
  }
}

export async function finalizeWeek(input: {
  weekId: string;
}): Promise<ActionResult> {
  const ctx = await loadWeekCtx(input);
  if (isFail(ctx)) return ctx;
  const { actor, week } = ctx;
  // 명단·제출 조회 실패는 던진다 — 빈 명단으로 [최종 보고]가 켜지지 않는다.
  const writers = await listWriters();
  const submitted = new Set(
    (await listReports(week.id))
      .filter((r) => r.status === "submitted")
      .map((r) => normEmail(r.operator_email)),
  );
  const check = checkFinalize(
    actor,
    stateOf(week),
    writers.map((w) => w.email),
    submitted,
  );
  if (!check.ok) {
    const names = new Map(writers.map((w) => [w.email, w.name]));
    return failOf(finalizeRejection(check, names));
  }
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .update({
      status: "reported",
      reported_at: new Date().toISOString(),
      reported_by: actor.email,
    })
    .eq("id", week.id)
    .eq("status", "open")
    .select("id");
  if (res.error)
    return failOf(`최종 보고에 실패했습니다: ${res.error.message}`);
  if (changedRows(res.data) === 0) return failOf("이미 보고된 주입니다.");
  revalidatePath(OPS_WEEKLY_PATH);
  await emitOpsWeeklyEvent({
    type: "week-reported",
    weekId: week.id,
    weekStart: week.week_start,
    reportedBy: actor.email,
    correction: week.reopened_at !== null,
  });
  await openNextWeek(week.week_start);
  return OK;
}

export async function reopenWeek(input: {
  weekId: string;
}): Promise<ActionResult> {
  const ctx = await loadWeekCtx(input);
  if (isFail(ctx)) return ctx;
  const { actor, week } = ctx;
  if (!canReopenWeek(actor, stateOf(week))) {
    return failOf(
      actor.isAdmin
        ? "보고된 주만 정정할 수 있습니다."
        : "관리자만 정정할 수 있습니다.",
    );
  }
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .update({
      status: "open",
      reopened_at: new Date().toISOString(),
      reopened_by: actor.email,
    })
    .eq("id", week.id)
    .eq("status", "reported")
    .select("id");
  if (res.error) return failOf(`정정에 실패했습니다: ${res.error.message}`);
  if (changedRows(res.data) === 0) return failOf("이미 다시 열린 주입니다.");
  revalidatePath(OPS_WEEKLY_PATH);
  return OK;
}
