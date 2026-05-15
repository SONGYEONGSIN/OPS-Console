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
import {
  buildBackupMailSubject,
  buildBackupMailHtml,
  groupServicesBySubstitute,
} from "./mail-template";

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

  // PR-3: 서비스별 백업자 그룹화. 미지정 시 default(backup_requests.substitute_*)로 fallback.
  // 그룹 0개(서비스 미지정)면 default 1명에게 빈 services로 발송.
  const groups =
    backup.services_detail.length > 0
      ? groupServicesBySubstitute(
          backup.services_detail,
          backup.substitute_email,
          backup.substitute_name,
        )
      : new Map([
          [
            backup.substitute_email,
            { name: backup.substitute_name, services: [] },
          ],
        ]);

  // dry_run 분기 — Graph 호출 없이 이력만 적재 (그룹별)
  if (dryRun) {
    const sentAt = new Date().toISOString();
    for (const [email, group] of groups) {
      await admin.from("backup_request_mail_sends").insert({
        sent_at: sentAt,
        sender_operator_id: senderOperatorId,
        backup_request_id: backup.id,
        recipient_email: email,
        recipient_name: group.name,
        cc_emails: [],
        graph_message_id: null,
        status: "dry_run",
        error_message: null,
      });
    }
    await admin
      .from("backup_requests")
      .update({
        mail_status: "dry_run",
        mail_sent_at: sentAt,
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
      services: backup.services_detail,
      contacts: backup.contacts,
      summaryMd: backup.summary_md,
      createdAt: backup.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `pdf_error: ${msg}` };
  }

  // PR-3: 백업자별 메일 loop. 그룹마다 자기 담당 services만 본문에 포함.
  // PDF는 *전체 services 포함* 1개 (모든 백업자에게 동일 첨부 — 시각적 통합 컨텍스트).
  let anyFail = false;
  let lastError: string | null = null;
  const sentAt = new Date().toISOString();
  for (const [recipientEmail, group] of groups) {
    const mailInput = {
      requesterName: me.displayName ?? me.email,
      requesterEmail: backup.requester_email,
      substituteName: group.name,
      substituteEmail: recipientEmail,
      leaveStartDate: backup.leave_start_date ?? null,
      leaveEndDate: backup.leave_end_date ?? null,
      services: group.services,
      contacts: backup.contacts,
      summaryMd: backup.summary_md,
    };
    const subject = buildBackupMailSubject(mailInput);
    const html = buildBackupMailHtml(mailInput);

    const sendRes = await sendGraphMail({
      senderUserId: me.email,
      toEmail: recipientEmail,
      toName: group.name,
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

    const errorMessage = sendRes.ok ? null : sendRes.error;
    const graphMessageId = sendRes.ok ? (sendRes.messageId ?? null) : null;
    if (!sendRes.ok) {
      anyFail = true;
      lastError = errorMessage;
    }

    // 이력 적재 (service_role bypass) — 백업자당 1 row
    await admin.from("backup_request_mail_sends").insert({
      sent_at: sentAt,
      sender_operator_id: senderOperatorId,
      backup_request_id: backup.id,
      recipient_email: recipientEmail,
      recipient_name: group.name,
      cc_emails: ccEmails,
      graph_message_id: graphMessageId,
      status: sendRes.ok ? "sent" : "failed",
      error_message: errorMessage,
    });
  }

  const finalStatus: MailStatus = anyFail ? "mail_failed" : "sent";
  await admin
    .from("backup_requests")
    .update({
      mail_status: finalStatus,
      mail_sent_at: anyFail ? null : sentAt,
      mail_error: lastError,
    })
    .eq("id", backup.id);

  revalidatePath(BACKUP_PATH);

  if (!anyFail) {
    return { ok: true, status: "sent" };
  }
  return { ok: false, error: lastError ?? "send_failed" };
}
