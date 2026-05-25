import "server-only";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildOperatorReminderHtml,
  buildOperatorReminderSubject,
} from "./mail-template-operator";
import type { OperatorReminderGroup } from "./operator-mail-grouping";

export type SendOperatorReminderResult = {
  recipientEmail: string;
  status: "sent" | "failed" | "dry_run";
  graphMessageId?: string;
  errorMessage?: string;
};

export type SendOperatorRemindersResult = {
  sent: number;
  failed: number;
  dryRun: number;
  results: SendOperatorReminderResult[];
};

type InsertRow = {
  sent_at: string;
  operator_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  customer_names: string[];
  receivable_count: number;
  total_amount: number;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

function uniqueCustomers(group: OperatorReminderGroup): string[] {
  return Array.from(
    new Set(group.items.map((it) => it.customerName).filter(Boolean)),
  );
}

function rowFor(
  group: OperatorReminderGroup,
  result: SendOperatorReminderResult,
): InsertRow {
  return {
    sent_at: new Date().toISOString(),
    operator_id: null, // PR-1에서는 미해결 — operators 테이블 lookup은 후속 작업
    recipient_email: group.operator.email,
    recipient_name: group.operator.name,
    customer_names: uniqueCustomers(group),
    receivable_count: group.items.length,
    total_amount: group.totalAmount,
    graph_message_id: result.graphMessageId ?? null,
    status: result.status,
    error_message: result.errorMessage ?? null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 운영자 그룹 배열 → 본인 메일로 일괄 발송 + 이력 적재.
 * - 발신자: 운영자 본인 (`Mail.Send` Application permission으로 본인 mailbox sendMail)
 * - dryRun=true 시 Graph 호출 skip, 이력만 status=dry_run insert
 * - throttle: 그룹 사이 1초 sleep (마지막 그룹 후 생략)
 * - 빈 배열 → no-op (sent/failed/dryRun 모두 0)
 *
 * 호출자: AutomationJob.run (cron + 자동화 메뉴 manual trigger 양쪽).
 * admin 가드는 호출자 측에서 (`runAutomationAction`이 `requireAdmin` 처리).
 */
export async function sendOperatorReminders(
  groups: OperatorReminderGroup[],
  options: { dryRun: boolean; quoteSeed?: number } = { dryRun: true },
): Promise<SendOperatorRemindersResult> {
  if (groups.length === 0) {
    return { sent: 0, failed: 0, dryRun: 0, results: [] };
  }

  const admin = createAdminClient();
  const itemResults: SendOperatorReminderResult[] = [];
  const insertRows: InsertRow[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    let result: SendOperatorReminderResult;
    if (options.dryRun) {
      result = { recipientEmail: group.operator.email, status: "dry_run" };
    } else {
      const subject = buildOperatorReminderSubject();
      const html = buildOperatorReminderHtml({
        group,
        quoteSeed: options.quoteSeed,
      });
      const sendRes = await sendGraphMail({
        senderUserId: group.operator.email,
        toEmail: group.operator.email,
        toName: group.operator.name,
        subject,
        html,
      });
      result = sendRes.ok
        ? {
            recipientEmail: group.operator.email,
            status: "sent",
            graphMessageId: sendRes.messageId,
          }
        : {
            recipientEmail: group.operator.email,
            status: "failed",
            errorMessage: sendRes.error,
          };
    }

    itemResults.push(result);
    insertRows.push(rowFor(group, result));

    if (!options.dryRun && i < groups.length - 1) {
      await sleep(1000);
    }
  }

  if (insertRows.length > 0) {
    await admin.from("receivables_operator_mail_sends").insert(insertRows);
  }

  return {
    sent: itemResults.filter((r) => r.status === "sent").length,
    failed: itemResults.filter((r) => r.status === "failed").length,
    dryRun: itemResults.filter((r) => r.status === "dry_run").length,
    results: itemResults,
  };
}
