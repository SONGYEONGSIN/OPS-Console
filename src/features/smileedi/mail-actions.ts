import "server-only";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSmileEdiSubject, buildSmileEdiHtml, sumSupplyAmount } from "./mail-template";
import { markEmailErrorY } from "./sheet-write";
import type { SmileEdiGroup } from "./types";

const HISTORY_TABLE = "smileedi_mail_sends";

export type SendSmileEdiResult = {
  sent: number;
  failed: number;
  dryRun: number;
  /** 발송 성공 후 이메일오류 PATCH 실패 시 메시지 (재발송 위험 알림) */
  patchError?: string;
};

type InsertRow = {
  sent_at: string;
  fiscal_year_start: string;
  sender_email: string;
  recipient_email: string;
  recipient_name: string | null;
  company_names: string[];
  invoice_count: number;
  total_supply_amount: number;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 담당자 그룹 → 발신 운영자 본인 mailbox에서 담당자에게 발송 + 이력 + 이메일오류 PATCH.
 * - 발신자: options.senderEmail (운영자 본인 UPN, 단일). 수신자: group.recipientEmail (담당자).
 * - dryRun=true → Graph/PATCH 호출 없이 status='dry_run' 이력만.
 * - 실발송 성공 행의 '이메일오류'='Y' PATCH (재발송 1차 idempotency).
 */
export async function sendSmileEdiMails(
  groups: SmileEdiGroup[],
  sheetMeta: { worksheetName: string; emailErrorColIdx: number },
  options: { dryRun: boolean; senderEmail: string; fiscalYearStart: string },
): Promise<SendSmileEdiResult> {
  if (groups.length === 0) return { sent: 0, failed: 0, dryRun: 0 };

  const admin = createAdminClient();
  const insertRows: InsertRow[] = [];
  const sentExcelRows: number[] = [];
  let sent = 0;
  let failed = 0;
  let dryRun = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const companyNames = [...new Set(group.rows.map((r) => r.companyName))];
    const base = {
      sent_at: new Date().toISOString(),
      fiscal_year_start: options.fiscalYearStart,
      sender_email: options.senderEmail,
      recipient_email: group.recipientEmail,
      recipient_name: group.managerName,
      company_names: companyNames,
      invoice_count: group.rows.length,
      total_supply_amount: sumSupplyAmount(group),
    };

    if (options.dryRun) {
      dryRun++;
      insertRows.push({ ...base, graph_message_id: null, status: "dry_run", error_message: null });
      continue;
    }

    const sendRes = await sendGraphMail({
      senderUserId: options.senderEmail,
      toEmail: group.recipientEmail,
      toName: group.managerName,
      subject: buildSmileEdiSubject(group.managerName),
      html: buildSmileEdiHtml(group),
    });

    if (sendRes.ok) {
      sent++;
      sentExcelRows.push(...group.rows.map((r) => r.excelRow));
      insertRows.push({
        ...base,
        graph_message_id: sendRes.messageId ?? null,
        status: "sent",
        error_message: null,
      });
    } else {
      failed++;
      insertRows.push({
        ...base,
        graph_message_id: null,
        status: "failed",
        error_message: sendRes.error,
      });
    }

    if (i < groups.length - 1) await sleep(1000);
  }

  if (insertRows.length > 0) {
    await admin.from(HISTORY_TABLE).insert(insertRows);
  }

  // 발송 성공 행 이메일오류='Y' PATCH (dry-run 제외)
  let patchError: string | undefined;
  if (!options.dryRun && sentExcelRows.length > 0) {
    const patch = await markEmailErrorY({
      worksheetName: sheetMeta.worksheetName,
      emailErrorColIdx: sheetMeta.emailErrorColIdx,
      rowNumbers: [...new Set(sentExcelRows)],
    });
    if (!patch.ok) patchError = patch.error;
  }

  return { sent, failed, dryRun, ...(patchError ? { patchError } : {}) };
}
