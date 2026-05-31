import "server-only";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildServiceNoticeHtml,
  buildServiceNoticeSubject,
} from "./mail-template";
import type { ServiceNoticeGroup } from "./schemas";

const HISTORY_TABLE = "service_notice_mail_sends";

export type SendServiceNoticesResult = {
  sent: number;
  failed: number;
  dryRun: number;
  /** 이번 달 이미 발송되어 건너뛴 운영자 수 (월 단위 idempotency) */
  skipped: number;
};

type InsertRow = {
  sent_at: string;
  target_month: string;
  recipient_email: string;
  recipient_name: string | null;
  service_count: number;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 운영자 그룹 → 본인 메일 발송 + 이력 적재.
 * - 월 단위 idempotency: 같은 target_month에 status='sent' 이력이 있는 운영자는 skip.
 *   (cron이 매일 돌아도 첫 영업일 1회만 발송되는 효과 — canSendOn 게이트와 결합)
 * - dryRun=true → Graph 호출 skip, status=dry_run만 적재(재실행 가능)
 * - 발신자: 운영자 본인 mailbox (receivables 패턴 동일)
 */
export async function sendServiceNotices(
  groups: ServiceNoticeGroup[],
  monthKey: string,
  monthLabel: number,
  options: { dryRun: boolean },
): Promise<SendServiceNoticesResult> {
  if (groups.length === 0) {
    return { sent: 0, failed: 0, dryRun: 0, skipped: 0 };
  }

  const admin = createAdminClient();

  // 이번 달 이미 발송 완료된 운영자 — idempotency
  const { data: already } = await admin
    .from(HISTORY_TABLE)
    .select("recipient_email")
    .eq("target_month", monthKey)
    .eq("status", "sent");
  const sentSet = new Set(
    ((already ?? []) as { recipient_email: string }[]).map(
      (r) => r.recipient_email,
    ),
  );

  const pending = groups.filter((g) => !sentSet.has(g.operator.email));
  const skipped = groups.length - pending.length;

  const insertRows: InsertRow[] = [];
  let sent = 0;
  let failed = 0;
  let dryRun = 0;

  for (let i = 0; i < pending.length; i++) {
    const group = pending[i];
    const base = {
      sent_at: new Date().toISOString(),
      target_month: monthKey,
      recipient_email: group.operator.email,
      recipient_name: group.operator.name,
      service_count: group.services.length,
    };

    if (options.dryRun) {
      dryRun++;
      insertRows.push({
        ...base,
        graph_message_id: null,
        status: "dry_run",
        error_message: null,
      });
      continue;
    }

    const sendRes = await sendGraphMail({
      senderUserId: group.operator.email,
      toEmail: group.operator.email,
      toName: group.operator.name,
      subject: buildServiceNoticeSubject(monthLabel),
      html: buildServiceNoticeHtml(group, monthLabel),
    });

    if (sendRes.ok) {
      sent++;
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

    if (i < pending.length - 1) await sleep(1000);
  }

  if (insertRows.length > 0) {
    await admin.from(HISTORY_TABLE).insert(insertRows);
  }

  return { sent, failed, dryRun, skipped };
}
