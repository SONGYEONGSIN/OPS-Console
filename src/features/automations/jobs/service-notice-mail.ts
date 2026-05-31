import "server-only";
import { canSendOn } from "@/features/receivables/mail-schedule";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import { nextMonthRangeKST } from "@/features/service-notice/month-range";
import { fetchNextMonthServices } from "@/features/service-notice/queries";
import { groupServicesByOperator } from "@/features/service-notice/grouping";
import { sendServiceNotices } from "@/features/service-notice/mail-actions";
import type { AutomationRunResult } from "../types";

function readDryRun(): boolean {
  return (process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true";
}

/**
 * AutomationJob.run — 월별 서비스 알림 (원본 GAS sendMonthlyServiceMail의 (A)).
 *
 * 1. 주말·공휴일 차단 (canSendOn) — 매일 cron이 돌아도 평일·비공휴일만 발송
 * 2. 다음 달 작성시작 서비스 조회(services) → 운영자별 그룹화
 * 3. sendServiceNotices — 본인 mailbox 발송 + 이력. 월 단위 idempotency로 중복 방지
 *    → canSendOn + idempotency 결합으로 "이번 달 첫 영업일 1회" 발송 효과
 *
 * 환경 변수: MAIL_DRY_RUN=true → 발송 없이 이력만(dry_run) 적재.
 */
export async function runServiceNoticeMail(): Promise<AutomationRunResult> {
  const now = new Date();
  const holidays = await fetchKoreanHolidays();
  if (!canSendOn(now, holidays)) {
    return { ok: true, message: "주말·공휴일 — 발송 안 함." };
  }

  const range = nextMonthRangeKST(now);
  const monthLabel = Number(range.monthKey.split("-")[1]);
  const services = await fetchNextMonthServices(range);
  const groups = groupServicesByOperator(services);

  if (groups.length === 0) {
    return {
      ok: true,
      message: `다음 달(${range.monthKey}) 작성시작 서비스 없음.`,
      details: { groups: 0 },
    };
  }

  const dryRun = readDryRun();
  const result = await sendServiceNotices(groups, range.monthKey, monthLabel, {
    dryRun,
  });

  const mode = dryRun ? "[DRY-RUN]" : "";
  return {
    ok: result.failed === 0,
    message:
      `${mode} ${range.monthKey} 운영자 ${groups.length}명 — sent ${result.sent} / failed ${result.failed} / dryRun ${result.dryRun} / skipped(중복) ${result.skipped}`.trim(),
    details: {
      groups: groups.length,
      sent: result.sent,
      failed: result.failed,
      dryRun: result.dryRun,
      skipped: result.skipped,
    },
  };
}
