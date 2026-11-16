import "server-only";

/**
 * 작성 action 의 판정 — server action 은 라우트 가드를 물려받지 않고 폼 값도 믿지 않는다.
 * 세션 → 보고서 행 → 주 행을 **DB 에서** 다시 읽고 판정한다. 그래서 [최종 보고] 뒤에
 * 열어 둔 낡은 화면이 보낸 저장도 여기서 잠긴 주로 거절된다.
 */
import { canViewMenu } from "@/features/auth/permission";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPS_WEEKLY_SLUG } from "./constants";
import { normEmail } from "./email";
import { canEditReport, type Actor } from "./permissions";
import {
  reportRowSchema,
  normalizedWeekStateOf,
  type ReportRow,
  type WeekRow,
} from "./schemas";
import { getWeekById, rowOf } from "./week-queries";

export type EditContext = { actor: Actor; report: ReportRow; week: WeekRow };

export type EditAuth =
  { ok: true; ctx: EditContext } | { ok: false; error: string };

const NOT_FOUND = "보고서를 찾을 수 없습니다.";

async function readReportById(reportId: string): Promise<ReportRow | null> {
  const res = await createAdminClient()
    .from("ops_weekly_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  const row = rowOf<unknown>("ops_weekly_reports", res);
  return row === null ? null : reportRowSchema.parse(row);
}

export async function authorizeReportEdit(reportId: string): Promise<EditAuth> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다." };
  if (!canViewMenu(OPS_WEEKLY_SLUG, me)) {
    return {
      ok: false,
      error: "권한 없음 — 주간업무보고 메뉴를 볼 수 없습니다.",
    };
  }
  const actor: Actor = {
    email: normEmail(me.email),
    isAdmin: me.permission === "admin",
  };
  const report = await readReportById(reportId);
  if (report === null) return { ok: false, error: NOT_FOUND };
  const week = await getWeekById(report.week_id);
  if (week === null) return { ok: false, error: NOT_FOUND };

  const state = normalizedWeekStateOf(week);
  if (canEditReport(actor, state, normEmail(report.operator_email))) {
    return { ok: true, ctx: { actor, report, week } };
  }
  return {
    ok: false,
    error:
      state.status !== "open"
        ? "보고가 끝난 주입니다. 관리자에게 정정을 요청하세요."
        : "본인 보고서만 수정할 수 있습니다.",
  };
}
