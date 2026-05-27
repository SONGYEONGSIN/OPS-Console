"use server";

import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderIncidentPdf } from "@/lib/pdf/incident-pdf";
import { getIncidentById } from "./queries";
import {
  buildIncidentMailSubject,
  buildIncidentMailHtml,
  type IncidentMailInput,
} from "./mail-template";

export type SendIncidentMailInput = {
  incidentId: string;
};

export type SendIncidentMailResult =
  | { ok: true; status: "sent" | "dry_run"; messageId?: string }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const NOT_FOUND_ERROR = "사고보고를 찾을 수 없습니다.";

function isDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "true";
}

export async function sendIncidentMail(
  input: SendIncidentMailInput,
): Promise<SendIncidentMailResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const incident = await getIncidentById(input.incidentId);
  if (!incident) return { ok: false, error: NOT_FOUND_ERROR };

  const mailInput: IncidentMailInput = {
    year: incident.year,
    universityName: incident.university_name,
    appType: incident.app_type,
    category: incident.category,
    title: incident.title,
    occurredDate: incident.occurred_date ?? null,
    resolvedDate: incident.resolved_date ?? null,
    causeSummary: incident.cause_summary ?? null,
    rootCause: incident.root_cause ?? null,
    resolution: incident.resolution ?? null,
    prevention: incident.prevention ?? null,
    department: incident.department,
    assigneeName: incident.assignee_name ?? incident.assignee_email ?? "",
    assigneeEmail: incident.assignee_email ?? "",
    reporterName: incident.reporter_name,
    reporterEmail: incident.reporter_email,
    status: incident.status,
  };

  const admin = createAdminClient();
  const sentAt = new Date().toISOString();

  // sender_operator_id 조회 (이력 적재용)
  let senderOperatorId: string | null = null;
  try {
    const { data: opRow } = (await admin
      .from("operators")
      .select("id")
      .eq("email", me.email)
      .maybeSingle()) as { data: { id: string } | null };
    senderOperatorId = opRow?.id ?? null;
  } catch {
    senderOperatorId = null;
  }

  // dry_run — Graph 호출 없이 이력만
  if (isDryRun()) {
    await admin.from("incident_mail_sends").insert({
      sent_at: sentAt,
      sender_operator_id: senderOperatorId,
      incident_id: incident.id,
      recipient_email: incident.reporter_email,
      recipient_name: incident.reporter_name,
      graph_message_id: null,
      status: "dry_run",
      error_message: null,
    });
    return { ok: true, status: "dry_run" };
  }

  // PDF 생성
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderIncidentPdf({
      ...mailInput,
      createdAt: incident.created_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("incident_mail_sends").insert({
      sent_at: sentAt,
      sender_operator_id: senderOperatorId,
      incident_id: incident.id,
      recipient_email: incident.reporter_email,
      recipient_name: incident.reporter_name,
      graph_message_id: null,
      status: "failed",
      error_message: `pdf_error: ${msg}`,
    });
    return { ok: false, error: `pdf_error: ${msg}` };
  }

  const subject = buildIncidentMailSubject(mailInput);
  const html = buildIncidentMailHtml(mailInput);

  const sendRes = await sendGraphMail({
    senderUserId: me.email,
    toEmail: incident.reporter_email,
    toName: incident.reporter_name,
    subject,
    html,
    attachments: [
      {
        name: `incident-${incident.id.slice(0, 8)}.pdf`,
        contentType: "application/pdf",
        contentBytes: pdfBuffer.toString("base64"),
      },
    ],
  });

  const graphMessageId = sendRes.ok ? (sendRes.messageId ?? null) : null;
  const errorMessage = sendRes.ok ? null : sendRes.error;

  await admin.from("incident_mail_sends").insert({
    sent_at: sentAt,
    sender_operator_id: senderOperatorId,
    incident_id: incident.id,
    recipient_email: incident.reporter_email,
    recipient_name: incident.reporter_name,
    graph_message_id: graphMessageId,
    status: sendRes.ok ? "sent" : "failed",
    error_message: errorMessage,
  });

  if (!sendRes.ok) {
    return { ok: false, error: errorMessage ?? "send_failed" };
  }
  return { ok: true, status: "sent", messageId: graphMessageId ?? undefined };
}
