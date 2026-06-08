"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { renderIncidentReportPdf } from "@/lib/pdf/incident-report-pdf";
import { incidentReportBodyToHtml } from "./mail-template";
import {
  assignDocNumber,
  uploadAndLinkReportFile,
  type RegisterInput,
} from "./sharepoint-register";
import { getDelegatedGraphToken } from "@/lib/microsoft/delegated-token";
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

  // 발번 보장 — 보통 PDF 클릭 시점에 채번되지만, 안 거친 edge 대비 발송 시 보강.
  let docNumber: string | null = rep.doc_number ?? null;
  if (!docNumber) {
    const assigned = await assignDocNumber(rep as RegisterInput, new Date());
    docNumber = assigned?.docNumber ?? null;
  }

  // 파일 업로드 + 발신대장 F링크 — 발송 시점에만.
  let sharepointUrl: string | null = null;
  if (!dryRun && docNumber) {
    // 위임 토큰이 있으면 업로드 "만든 사람"=운영자, 없으면 서비스 계정 폴백.
    const delegatedToken = await getDelegatedGraphToken(me.email).catch(
      () => null,
    );
    const up = await uploadAndLinkReportFile(
      rep as RegisterInput,
      docNumber,
      new Date(),
      { token: delegatedToken ?? undefined },
    ).catch((e) => {
      console.error(
        "[sendIncidentReport] SharePoint 업로드 실패 (메일은 계속):",
        e,
      );
      return null;
    });
    sharepointUrl = up?.sharepointUrl ?? null;
  }

  // 공문 하단 연락처 전화 — 작성자(담당자) 운영자의 전화번호.
  const { data: authorOp } = await admin
    .from("operators")
    .select("phone")
    .eq("email", rep.author_email)
    .maybeSingle();

  const pdf = await renderIncidentReportPdf({
    recipientUniversity: rep.recipient_university,
    title: rep.title,
    draftDate: rep.draft_date,
    authorName: rep.author_name,
    authorEmail: rep.author_email,
    authorPhone: authorOp?.phone ?? null,
    approverName: rep.approver_name,
    approverRole: rep.approver_role,
    directorName: rep.director_name,
    directorRole: rep.director_role,
    ceoName: rep.ceo_name,
    ceoRole: rep.ceo_role,
    docNumber,
    apology: rep.apology ?? "",
    gyeongwi: rep.gyeongwi,
    cause: rep.cause,
    handling: rep.handling,
    handlingRows: rep.handling_rows ?? [],
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

  // 제목·본문은 발송 폼에서 편집한 값을 사용. 본문 텍스트 → HTML.
  const subject = parsed.data.subject;
  const html = incidentReportBodyToHtml(parsed.data.body);
  const ccList = parsed.data.cc_emails.map((email) => ({ email }));

  let status: "sent" | "failed" | "dry_run" = "dry_run";
  let messageId: string | null = null;
  let errMsg: string | null = null;

  if (!dryRun) {
    const res = await sendGraphMail({
      senderUserId: me.email,
      toEmail: parsed.data.to_email,
      cc: ccList.length > 0 ? ccList : undefined,
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
    recipient_email: parsed.data.to_email,
    status,
    graph_message_id: messageId,
    error_message: errMsg,
  });

  const allRecipients = [parsed.data.to_email, ...parsed.data.cc_emails];
  const { data: updated } = await admin
    .from("incident_reports")
    .update({
      status: "sent",
      recipient_emails: allRecipients,
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
    msg: `경위서 발송 (수신 ${parsed.data.to_email}${parsed.data.cc_emails.length ? `, CC ${parsed.data.cc_emails.length}` : ""})${docNumber ? ` 시행 ${docNumber}` : ""}${dryRun ? " [dry_run]" : ""}`,
  });

  revalidatePath(PATH);
  return { ok: true, row: updated as IncidentReportRow };
}
