import "server-only";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { groupReceivablesByOperator } from "@/features/receivables/operator-mail-grouping";
import { sendOperatorReminders } from "@/features/receivables/operator-mail-actions";
import { canSendOn } from "@/features/receivables/mail-schedule";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import type { AutomationRunResult } from "../types";

const DEFAULT_THRESHOLD_DAYS = 10;

function readThreshold(): number {
  const raw = process.env.MAIL_REMINDER_THRESHOLD_DAYS;
  if (!raw) return DEFAULT_THRESHOLD_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : DEFAULT_THRESHOLD_DAYS;
}

function readDryRun(): boolean {
  return (process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true";
}

/**
 * AutomationJob.run — 운영자 본인 미수채권 알림 메일 일괄 발송.
 *
 * 1. SharePoint Excel sheet fetch (`fetchReceivablesSheet`)
 * 2. 운영자별 그룹화 (`groupReceivablesByOperator`) — 경과 ≥ MAIL_REMINDER_THRESHOLD_DAYS
 * 3. sendOperatorReminders — Graph sendMail (본인 mailbox) + 이력 적재
 *
 * 환경 변수:
 * - MAIL_DRY_RUN=true → Graph 호출 skip, status=dry_run만 적재
 * - MAIL_REMINDER_THRESHOLD_DAYS (기본 10)
 *
 * cron(GitHub Actions schedule) + 자동화 메뉴 manual trigger 양쪽에서 동일 호출.
 */
export async function runReceivablesMailOperator(): Promise<AutomationRunResult> {
  // 주말·공휴일 차단 (원본 GAS canRunToday_). cron이 평일만 돌아도 평일 공휴일은 코드로 차단.
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

  const thresholdDays = readThreshold();
  const { groups, excluded } = groupReceivablesByOperator(sheet, thresholdDays, now);

  if (groups.length === 0) {
    return {
      ok: true,
      message: `발송 대상 없음 (threshold ${thresholdDays}일, excluded ${excluded.length}건).`,
      details: { groups: 0, excluded: excluded.length },
    };
  }

  const dryRun = readDryRun();
  const result = await sendOperatorReminders(groups, { dryRun });

  const mode = dryRun ? "[DRY-RUN]" : "";
  return {
    ok: result.failed === 0,
    message:
      `${mode} 운영자 ${groups.length}명 처리 — sent ${result.sent} / failed ${result.failed} / dryRun ${result.dryRun}`.trim(),
    details: {
      groups: groups.length,
      sent: result.sent,
      failed: result.failed,
      dryRun: result.dryRun,
      excluded: excluded.length,
    },
  };
}
