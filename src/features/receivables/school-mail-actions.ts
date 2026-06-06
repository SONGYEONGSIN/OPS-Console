import "server-only";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReminderHtml, buildReminderSubject } from "./mail-template";
import { findMailSentDateCol } from "./mail-grouping";
import { patchSingleColumn } from "./sheet-write";
import type { SchoolReminderGroup } from "./school-mail-grouping";
import type { ReceivablesSheet } from "./queries";

const COMPANY_FALLBACK = "Folio";
function readCompanyName(): string {
  return process.env.MAIL_COMPANY_NAME?.trim() || COMPANY_FALLBACK;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function todayKstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type SendSchoolRemindersResult = {
  sent: number;
  failed: number;
  dryRun: number;
};

type InsertRow = {
  sent_at: string;
  sender_operator_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  customer_names: string[];
  receivable_count: number;
  total_amount: number;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

/**
 * 학교담당자 마일스톤 자동 독려 — (담당 운영자 발신) 그룹 배열을 일괄 발송.
 * - 발신: 담당 운영자 본인 메일박스 / 수신: 학교담당자 (그룹화에서 메일주소 있는 행만)
 * - dryRun=true 시 Graph 호출 없이 status=dry_run 이력만
 * - 실발송 성공 행에는 시트 '메일발송일자' 기록 (없는 컬럼이면 skip)
 * - 호출자: AutomationJob.run (cron 게이트). admin 가드는 호출 경로에서 처리.
 */
export async function sendSchoolReminders(
  groups: SchoolReminderGroup[],
  sheet: ReceivablesSheet,
  options: { dryRun: boolean },
): Promise<SendSchoolRemindersResult> {
  if (groups.length === 0) return { sent: 0, failed: 0, dryRun: 0 };

  const admin = createAdminClient();
  const companyName = readCompanyName();

  // 발신 운영자 email → operators.id 매핑 (이력 적재용)
  const senderEmails = Array.from(new Set(groups.map((g) => g.sender.email)));
  const idByEmail = new Map<string, string>();
  try {
    const { data } = await admin
      .from("operators")
      .select("id, email")
      .in("email", senderEmails);
    for (const r of (data ?? []) as { id: string; email: string }[]) {
      idByEmail.set(r.email, r.id);
    }
  } catch {
    // 이력 sender_operator_id는 null 허용 — 매핑 실패해도 발송 진행
  }

  const insertRows: InsertRow[] = [];
  const sentRows: number[] = [];
  let sent = 0;
  let failed = 0;
  let dryRun = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const uniqueCustomers = Array.from(
      new Set(group.items.map((it) => it.customerName).filter(Boolean)),
    );
    const base = {
      sent_at: new Date().toISOString(),
      sender_operator_id: idByEmail.get(group.sender.email) ?? null,
      recipient_email: group.recipient.email,
      recipient_name: group.recipient.name ?? null,
      customer_names: uniqueCustomers,
      receivable_count: group.items.length,
      total_amount: group.totalAmount,
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

    const subject = buildReminderSubject({ group, companyName });
    const html = buildReminderHtml({
      group,
      senderName: group.sender.name,
      companyName,
    });
    const res = await sendGraphMail({
      senderUserId: group.sender.email,
      toEmail: group.recipient.email,
      toName: group.recipient.name,
      subject,
      html,
    });

    if (res.ok) {
      sent++;
      for (const it of group.items)
        if (it.excelRow && it.excelRow > 0) sentRows.push(it.excelRow);
      insertRows.push({
        ...base,
        graph_message_id: res.messageId ?? null,
        status: "sent",
        error_message: null,
      });
    } else {
      failed++;
      insertRows.push({
        ...base,
        graph_message_id: null,
        status: "failed",
        error_message: res.error ?? null,
      });
    }

    if (i < groups.length - 1) await sleep(1000);
  }

  if (insertRows.length > 0) {
    await admin.from("receivables_mail_sends").insert(insertRows);
  }

  // 발송 성공 행에 '메일발송일자' 기록 (실패해도 발송 결과엔 영향 X)
  if (sentRows.length > 0) {
    const headerColIdx = findMailSentDateCol(sheet.headers);
    if (headerColIdx >= 0) {
      const r = await patchSingleColumn({
        worksheetName: sheet.worksheetName,
        colIdx: sheet.validColIdx[headerColIdx],
        rowNumbers: Array.from(new Set(sentRows)),
        value: todayKstYmd(),
      });
      if (!r.ok) {
        console.error("[receivables-school] 메일발송일자 기록 실패:", r.error);
      }
    }
  }

  return { sent, failed, dryRun };
}
