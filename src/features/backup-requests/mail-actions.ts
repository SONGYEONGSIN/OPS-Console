"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  sendGraphMail,
  type GraphMailRecipient,
} from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderBackupRequestPdf } from "@/lib/pdf/backup-request-pdf";
import {
  sendBackupMailInputSchema,
  type SendBackupMailInput,
  type MailStatus,
} from "./schemas";
import { getBackupRequestById } from "./queries";
import { buildBackupMailSubject, buildBackupMailHtml } from "./mail-template";

export type SendBackupMailResult =
  | { ok: true; status: MailStatus; messageId?: string }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const NOT_FOUND_ERROR = "백업 요청을 찾을 수 없습니다.";
const BACKUP_PATH = "/dashboard/backup";

function isDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "true";
}

type CcOperator = {
  email: string;
  display_name: string | null;
  team: string | null;
};

async function fetchCcOperators(
  admin: ReturnType<typeof createAdminClient>,
  team: string | null,
  excludeEmails: string[],
): Promise<GraphMailRecipient[]> {
  if (!team) return [];
  let query = admin
    .from("operators")
    .select("email,display_name,team")
    .eq("team", team)
    .eq("status", "active");
  for (const e of excludeEmails) {
    query = query.neq("email", e);
  }
  const { data, error } = (await query) as {
    data: CcOperator[] | null;
    error: { message: string } | null;
  };
  if (error || !data) return [];
  return data.map((op) => ({
    email: op.email,
    name: op.display_name ?? undefined,
  }));
}

export async function sendBackupRequestMail(
  rawInput: SendBackupMailInput,
): Promise<SendBackupMailResult> {
  const parsed = sendBackupMailInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const backup = await getBackupRequestById(parsed.data.backup_request_id);
  if (!backup) return { ok: false, error: NOT_FOUND_ERROR };

  const admin = createAdminClient();
  const dryRun = isDryRun();

  // 발신 operator id 조회 (이력 적재용 — 없으면 null 허용)
  let senderOperatorId: string | null = null;
  try {
    const { data: opRow } = await admin
      .from("operators")
      .select("id")
      .eq("email", me.email)
      .maybeSingle();
    senderOperatorId = (opRow as { id: string } | null)?.id ?? null;
  } catch {
    senderOperatorId = null;
  }

  // dry_run 분기 — Graph 호출 없이 이력만 적재
  if (dryRun) {
    await admin.from("backup_request_mail_sends").insert({
      sent_at: new Date().toISOString(),
      sender_operator_id: senderOperatorId,
      backup_request_id: backup.id,
      recipient_email: backup.substitute_email,
      recipient_name: backup.substitute_name,
      cc_emails: [],
      graph_message_id: null,
      status: "dry_run",
      error_message: null,
    });
    await admin
      .from("backup_requests")
      .update({
        mail_status: "dry_run",
        mail_sent_at: new Date().toISOString(),
      })
      .eq("id", backup.id);
    revalidatePath(BACKUP_PATH);
    return { ok: true, status: "dry_run" };
  }

  // CC = 발송 시점 같은 team operators (requester/substitute 제외)
  const cc = await fetchCcOperators(admin, backup.requester_team ?? null, [
    backup.requester_email,
    backup.substitute_email,
  ]);
  const ccEmails = cc.map((c) => c.email);

  // PDF 생성
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderBackupRequestPdf({
      requesterName: me.displayName ?? me.email,
      requesterEmail: backup.requester_email,
      substituteName: backup.substitute_name,
      substituteEmail: backup.substitute_email,
      leaveStartDate: backup.leave_start_date ?? null,
      leaveEndDate: backup.leave_end_date ?? null,
      services: backup.services,
      contacts: backup.contacts,
      summaryMd: backup.summary_md,
      createdAt: backup.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `pdf_error: ${msg}` };
  }

  // 메일 본문
  const mailInput = {
    requesterName: me.displayName ?? me.email,
    requesterEmail: backup.requester_email,
    substituteName: backup.substitute_name,
    substituteEmail: backup.substitute_email,
    leaveStartDate: backup.leave_start_date ?? null,
    leaveEndDate: backup.leave_end_date ?? null,
    services: backup.services,
    contacts: backup.contacts,
    summaryMd: backup.summary_md,
  };
  const subject = buildBackupMailSubject(mailInput);
  const html = buildBackupMailHtml(mailInput);

  // Graph 발송
  const sendRes = await sendGraphMail({
    senderUserId: me.email,
    toEmail: backup.substitute_email,
    toName: backup.substitute_name,
    cc,
    subject,
    html,
    attachments: [
      {
        name: `backup-${backup.id.slice(0, 8)}.pdf`,
        contentType: "application/pdf",
        contentBytes: pdfBuffer.toString("base64"),
      },
    ],
  });

  const status: MailStatus = sendRes.ok ? "sent" : "mail_failed";
  const errorMessage = sendRes.ok ? null : sendRes.error;
  const graphMessageId = sendRes.ok ? (sendRes.messageId ?? null) : null;

  // 이력 적재 (service_role bypass)
  await admin.from("backup_request_mail_sends").insert({
    sent_at: new Date().toISOString(),
    sender_operator_id: senderOperatorId,
    backup_request_id: backup.id,
    recipient_email: backup.substitute_email,
    recipient_name: backup.substitute_name,
    cc_emails: ccEmails,
    graph_message_id: graphMessageId,
    status: sendRes.ok ? "sent" : "failed",
    error_message: errorMessage,
  });

  // mail_status update
  await admin
    .from("backup_requests")
    .update({
      mail_status: status,
      mail_sent_at: sendRes.ok ? new Date().toISOString() : null,
      mail_error: errorMessage,
    })
    .eq("id", backup.id);

  revalidatePath(BACKUP_PATH);

  if (sendRes.ok) {
    return { ok: true, status: "sent", messageId: sendRes.messageId };
  }
  return { ok: false, error: errorMessage ?? "send_failed" };
}
