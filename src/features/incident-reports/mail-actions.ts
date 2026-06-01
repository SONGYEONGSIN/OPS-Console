"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { renderIncidentReportPdf } from "@/lib/pdf/incident-report-pdf";
import { incidentReportMailHtml, incidentReportMailSubject } from "./mail-template";
import { registerIncidentReportToSharePoint } from "./sharepoint-register";
import { incidentReportSendSchema, type IncidentReportRow } from "./schemas";

export type SendIncidentReportResult =
  | { ok: true; row: IncidentReportRow }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const PATH = "/dashboard/incident-reports";

function isDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "true";
}

export async function sendIncidentReport(
  input: unknown,
): Promise<SendIncidentReportResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = incidentReportSendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const dryRun = isDryRun();
  const admin = createAdminClient();

  const { data: rep } = await admin
    .from("incident_reports")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.status !== "approved") {
    return { ok: false, error: "승인 완료된 경위서만 발송할 수 있습니다." };
  }
  if (rep.author_email !== me.email && me.permission !== "admin") {
    return { ok: false, error: "발송 권한이 없습니다." };
  }

  let docNumber: string | null = rep.doc_number;
  let sharepointUrl: string | null = null;
  if (!dryRun) {
    try {
      const r = await registerIncidentReportToSharePoint(rep, new Date());
      if (r) {
        docNumber = r.docNumber;
        sharepointUrl = r.sharepointUrl;
      }
    } catch (e) {
      console.error(
        "[sendIncidentReport] SharePoint 등록 실패 (메일은 계속):",
        e,
      );
    }
  }

  const pdf = await renderIncidentReportPdf({
    recipientUniversity: rep.recipient_university,
    title: rep.title,
    draftDate: rep.draft_date,
    authorName: rep.author_name,
    approverName: rep.approver_name,
    directorName: rep.director_name,
    ceoName: rep.ceo_name,
    docNumber,
    apology: rep.apology ?? "",
    gyeongwi: rep.gyeongwi,
    cause: rep.cause,
    handling: rep.handling,
    prevention: rep.prevention,
  });
  const attachment = {
    name: `${rep.title}.pdf`,
    contentBytes: pdf.toString("base64"),
    contentType: "application/pdf",
  };

  const { data: opRow } = await admin
    .from("operators")
    .select("id")
    .eq("email", me.email)
    .maybeSingle();

  const subject = incidentReportMailSubject(rep.title);
  const html = incidentReportMailHtml({
    university: rep.recipient_university,
    title: rep.title,
    authorName: rep.author_name,
  });

  for (const to of parsed.data.recipient_emails) {
    let status: "sent" | "failed" | "dry_run" = "dry_run";
    let messageId: string | null = null;
    let errMsg: string | null = null;

    if (!dryRun) {
      const res = await sendGraphMail({
        senderUserId: me.email,
        toEmail: to,
        subject,
        html,
        attachments: [attachment],
      });
      status = res.ok ? "sent" : "failed";
      messageId = res.ok ? (res.messageId ?? null) : null;
      errMsg = res.ok ? null : res.error;
    }

    await admin.from("incident_report_mail_sends").insert({
      sender_operator_id: opRow?.id ?? null,
      report_id: rep.id,
      recipient_email: to,
      status,
      graph_message_id: messageId,
      error_message: errMsg,
    });
  }

  const { data: updated } = await admin
    .from("incident_reports")
    .update({
      status: "sent",
      recipient_emails: parsed.data.recipient_emails,
      doc_number: docNumber,
      sharepoint_url: sharepointUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rep.id)
    .select()
    .single();

  await logActivity({
    domain: "incident-reports",
    action: "send",
    target_type: "incident_reports",
    target_id: rep.id,
    target_name: rep.title,
    msg: `경위서 발송 (${parsed.data.recipient_emails.length}명)${docNumber ? ` 시행 ${docNumber}` : ""}${dryRun ? " [dry_run]" : ""}`,
  });

  revalidatePath(PATH);
  return { ok: true, row: updated as IncidentReportRow };
}
