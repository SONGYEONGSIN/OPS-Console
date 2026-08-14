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
import { getIncidentById } from "@/features/incidents/queries";
import { resolveApprovalChain } from "./queries";
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

  // 담당자·결재라인 스냅샷 확정 — 화면(상세 페이지)은 사고 담당자 + 라이브 결재라인을
  // 매번 새로 계산해 보여주는데 문서는 저장값을 쓴다. 그대로 두면 화면에서 본 것과
  // 다른 공문이 나가므로(공문관리대장 작성자도 사고 담당자 기준), 발송 시점에 맞춰 굳힌다.
  const incident = rep.incident_id
    ? await getIncidentById(rep.incident_id).catch(() => null)
    : null;
  const dutyName = incident?.assignee_name ?? rep.author_name;
  const dutyEmail = incident?.assignee_email ?? rep.author_email;
  const chain = await resolveApprovalChain(dutyEmail).catch(() => null);
  const snapshot = {
    author_name: dutyName,
    author_email: dutyEmail,
    approver_name: chain?.approver?.name ?? rep.approver_name,
    approver_role: chain?.approver?.role ?? rep.approver_role,
    director_name: chain?.director?.name ?? rep.director_name,
    director_role: chain?.director?.role ?? rep.director_role,
    ceo_name: chain?.ceo?.name ?? rep.ceo_name,
    ceo_role: chain?.ceo?.role ?? rep.ceo_role,
  };
  await admin.from("incident_reports").update(snapshot).eq("id", rep.id);
  const sending = { ...rep, ...snapshot };

  // 발번 보장 — 보통 PDF 클릭 시점에 채번되지만, 안 거친 edge 대비 발송 시 보강.
  let docNumber: string | null = rep.doc_number ?? null;
  if (!docNumber) {
    const assigned = await assignDocNumber(
      sending as RegisterInput,
      new Date(),
      { ledgerAuthor: dutyName },
    );
    docNumber = assigned?.docNumber ?? null;
  }

  // 공문 하단 연락처 전화 — 담당자 운영자의 전화번호.
  const { data: authorOp } = await admin
    .from("operators")
    .select("phone")
    .eq("email", dutyEmail)
    .maybeSingle();

  const pdf = await renderIncidentReportPdf({
    recipientUniversity: sending.recipient_university,
    title: sending.title,
    draftDate: sending.draft_date,
    authorName: sending.author_name,
    authorEmail: sending.author_email,
    authorPhone: chain?.author?.phone ?? authorOp?.phone ?? null,
    approverName: sending.approver_name,
    approverRole: sending.approver_role,
    directorName: sending.director_name,
    directorRole: sending.director_role,
    ceoName: sending.ceo_name,
    ceoRole: sending.ceo_role,
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

  // 보관본 업로드 + 발신대장 F링크 — 발송 시점에만. 메일에 붙인 그 PDF를 그대로 올린다.
  let sharepointUrl: string | null = null;
  let ledgerLinked = true;
  if (!dryRun && docNumber) {
    // 위임 토큰이 있으면 업로드 "만든 사람"=운영자, 없으면 서비스 계정 폴백.
    const delegatedToken = await getDelegatedGraphToken(me.email).catch(
      () => null,
    );
    const up = await uploadAndLinkReportFile(
      sending as RegisterInput,
      docNumber,
      new Date(),
      pdf,
      { token: delegatedToken ?? undefined },
    ).catch((e) => {
      console.error(
        "[sendIncidentReport] SharePoint 업로드 실패 (메일은 계속):",
        e,
      );
      return null;
    });
    sharepointUrl = up?.sharepointUrl ?? null;
    // 대장에 그 시행번호 행이 없으면(사람이 지웠거나 채번이 안 됐거나) 링크를 못 채운다.
    // 업로드는 됐으므로 화면엔 링크가 보인다 — 여기서 안 남기면 아무도 모른다.
    if (up && !up.ledgerLinked) {
      ledgerLinked = false;
      console.error(
        `[sendIncidentReport] 공문관리대장에 ${docNumber} 행이 없어 F링크 미기입`,
      );
    }
  }

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
    msg: `경위서 발송 (수신 ${parsed.data.to_email}${parsed.data.cc_emails.length ? `, CC ${parsed.data.cc_emails.length}` : ""})${docNumber ? ` 시행 ${docNumber}` : ""}${ledgerLinked ? "" : " [공문관리대장 미기입]"}${dryRun ? " [dry_run]" : ""}`,
  });

  revalidatePath(PATH);
  return { ok: true, row: updated as IncidentReportRow };
}
