import "server-only";
import { loadSmileEdiConfig } from "@/features/smileedi/config";
import { fiscalYearRangeKST } from "@/features/smileedi/fiscal-year";
import { fetchSmileEdiSheet } from "@/features/smileedi/queries";
import { filterSendable } from "@/features/smileedi/filter";
import { groupByManager } from "@/features/smileedi/grouping";
import { sendSmileEdiMails } from "@/features/smileedi/mail-actions";
import type { AutomationRunResult } from "../types";

function readDryRun(): boolean {
  // 전용 플래그 — 전역 MAIL_DRY_RUN과 분리해 SmileEDI만 독립 dry-run 가능
  // (receivables-deposit-match=MAIL_MATCH_DRY_RUN, weekly=WEEKLY_REPORT_DRY_RUN 패턴).
  return (process.env.SMILEEDI_DRY_RUN ?? "").toLowerCase() === "true";
}

/**
 * AutomationJob.run — SmileEDI 세금계산서 조건부 담당자 알림 (Phase 1).
 *
 * 1. env 설정 로드 (누락 시 즉시 실패)
 * 2. SharePoint 역발행 세금계산서 시트 read (스크래퍼가 Phase 2에서 적재)
 * 3. 필터(이메일오류≠Y + 품목키워드) → 담당자별 그룹핑
 * 4. 발신 운영자 본인 mailbox에서 담당자에게 발송 + 이력 + 이메일오류='Y' PATCH
 *
 * 환경 변수: SMILEEDI_DRY_RUN=true → 발송/PATCH 없이 이력만(dry_run).
 */
export async function runSmileEdiMail(): Promise<AutomationRunResult> {
  const cfg = loadSmileEdiConfig();
  if (!cfg.ok) {
    return { ok: false, message: `SmileEDI 설정 오류 — ${cfg.error}` };
  }

  const range = fiscalYearRangeKST(new Date());

  const sheet = await fetchSmileEdiSheet();
  if (!sheet) {
    return {
      ok: false,
      message:
        "SmileEDI 시트 미연결 (SHAREPOINT_SMILEEDI_DRIVE_ID/ITEM_ID 누락 또는 조회 실패)",
    };
  }

  const sendable = filterSendable(sheet.rows, cfg.config.itemKeywords);
  const { groups, unresolvedManagers } = groupByManager(sendable, cfg.config);

  if (groups.length === 0) {
    return {
      ok: true,
      message: `${range.startYmd}~${range.endYmd} 발송 대상 없음 (전체 ${sheet.rows.length} / 필터통과 ${sendable.length}).`,
      details: {
        rows: sheet.rows.length,
        sendable: sendable.length,
        groups: 0,
      },
    };
  }

  const dryRun = readDryRun();
  const result = await sendSmileEdiMails(
    groups,
    {
      worksheetName: sheet.worksheetName,
      emailErrorColIdx: sheet.emailErrorColIdx,
    },
    {
      dryRun,
      fiscalYearStart: range.startYmd,
      cc: cfg.config.cc,
    },
  );

  const defaultRouted = groups.filter((g) => g.routedByDefault).length;
  const mode = dryRun ? "[DRY-RUN] " : "";
  const warn =
    unresolvedManagers.length > 0
      ? ` / 수신메일 미해결 담당자 ${unresolvedManagers.length}명(${unresolvedManagers
          .map((u) => u.managerName)
          .join(",")})`
      : "";
  const patchWarn = result.patchError
    ? ` / 이메일오류 PATCH 실패: ${result.patchError}`
    : "";

  return {
    ok: result.failed === 0 && !result.patchError,
    message:
      `${mode}담당자 ${groups.length}명 — sent ${result.sent} / failed ${result.failed} / dryRun ${result.dryRun}` +
      (defaultRouted > 0 ? ` / 기본담당자 라우팅 ${defaultRouted}건` : "") +
      warn +
      patchWarn,
    details: {
      rows: sheet.rows.length,
      sendable: sendable.length,
      groups: groups.length,
      sent: result.sent,
      failed: result.failed,
      dryRun: result.dryRun,
      defaultRouted,
      unresolvedManagers: unresolvedManagers.length,
    },
  };
}
