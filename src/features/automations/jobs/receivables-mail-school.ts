import "server-only";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { groupSchoolByOperator } from "@/features/receivables/school-mail-grouping";
import { sendSchoolReminders } from "@/features/receivables/school-mail-actions";
import { canSendOn } from "@/features/receivables/mail-schedule";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import type { AutomationRunResult } from "../types";

function readDryRun(): boolean {
  return (process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true";
}

/**
 * AutomationJob.run — 학교담당자 마일스톤 자동 독려 메일.
 *
 * 1. 주말·공휴일 차단 (canSendOn)
 * 2. SharePoint Excel sheet fetch
 * 3. (운영자, 학교담당자)별 그룹화 — SCHOOL_TARGET_DAYS 마일스톤 정확 일치 +
 *    학교담당자 메일주소가 있는 행만 (없으면 발송 안 함)
 * 4. sendSchoolReminders — 담당 운영자 메일박스에서 발송 + 이력 + '메일발송일자' 기록
 *
 * 환경: MAIL_DRY_RUN=true → Graph 호출 없이 이력만(dry_run).
 * cron(cron-job.org) + 자동화 메뉴 manual trigger 양쪽에서 동일 호출.
 */
export async function runReceivablesMailSchool(): Promise<AutomationRunResult> {
  const now = new Date();
  const holidays = await fetchKoreanHolidays();
  if (!canSendOn(now, holidays)) {
    return { ok: true, message: "주말·공휴일 — 발송 안 함." };
  }

  const sheet = await fetchReceivablesSheet();
  if (!sheet) {
    return {
      ok: false,
      message:
        "SharePoint 미수채권 시트를 가져오지 못했습니다. SHAREPOINT_RECEIVABLES_* 환경변수 확인 필요.",
    };
  }

  const { groups, excluded } = groupSchoolByOperator(sheet, now);
  if (groups.length === 0) {
    return {
      ok: true,
      message: `발송 대상 없음 (마일스톤 해당 없음, excluded ${excluded.length}건).`,
      details: { groups: 0, excluded: excluded.length },
    };
  }

  const dryRun = readDryRun();
  const result = await sendSchoolReminders(groups, sheet, { dryRun });

  const mode = dryRun ? "[DRY-RUN]" : "";
  return {
    ok: result.failed === 0,
    message:
      `${mode} 학교담당자 ${groups.length}건 처리 — sent ${result.sent} / failed ${result.failed} / dryRun ${result.dryRun}`.trim(),
    details: {
      groups: groups.length,
      sent: result.sent,
      failed: result.failed,
      dryRun: result.dryRun,
      excluded: excluded.length,
    },
  };
}
