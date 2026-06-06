"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { renderHandoverPdf } from "@/lib/pdf/handover-pdf";
import {
  buildHandoverMailHtml,
  buildHandoverMailSubject,
} from "./mail-template";
import { HANDOVER_FIELD_KEYS } from "./categories";
import type { HandoverFieldKey } from "./categories";

export type SendHandoverMailResult =
  | { ok: true; status: "sent" | "dry_run"; messageId?: string }
  | { ok: false; error: string };

function isDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "true";
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000"
  );
}

/**
 * 인수인계 메일 발송 — PDF(14 sub-field) 첨부 + HTML 본문.
 *
 * - 발신: 현재 로그인 사용자 (handover_progress.from_email)
 * - 수신: handover_progress.to_email
 * - 첨부: handover_records 14 sub-field → PDF (Pretendard 한글)
 * - 본문: 인계자/인수자/서비스 + history 페이지 링크
 *
 * MAIL_DRY_RUN=true 시 실제 발송 안 함 (DB 변경 없이 ok 반환).
 */
export async function sendHandoverMail(
  progressId: string,
): Promise<SendHandoverMailResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();

  // 1) progress + service + record 한 번에 fetch
  const { data: prog, error: progErr } = await admin
    .from("handover_progress")
    .select(
      "id, service_id, from_email, from_name, to_email, to_name, notes, services(id, service_id, university_name, service_name, application_type)",
    )
    .eq("id", progressId)
    .maybeSingle();
  if (progErr || !prog) {
    return { ok: false, error: progErr?.message ?? "progress not found" };
  }
  type ProgRow = {
    service_id: string;
    from_email: string;
    from_name: string;
    to_email: string;
    to_name: string;
    notes: string | null;
    services: {
      service_id: number;
      university_name: string;
      service_name: string;
      application_type: string;
    } | null;
  };
  const p = prog as unknown as ProgRow;
  if (!p.services) {
    return { ok: false, error: "service not found" };
  }

  const { data: rec, error: recErr } = await admin
    .from("handover_records")
    .select(
      "contract_info_md, contract_info, contract_data_md, contract_data_checklist, work_basic_md, work_generator_md, work_site_md, work_output_md, work_rate_md, work_file_md, work_etc_md, payment_fee_md, payment_invoice_md, payment_fee, payment_invoice, school_contact_md, school_contacts, docs_md, docs_checklist, notes_md",
    )
    .eq("service_id", p.service_id)
    .maybeSingle();
  if (recErr) {
    return { ok: false, error: recErr.message };
  }
  const recRow = (rec ?? {}) as Record<string, unknown>;
  const fields = HANDOVER_FIELD_KEYS.reduce(
    (acc, k) => {
      acc[k] = (recRow[k] as string | null) ?? null;
      return acc;
    },
    {} as Record<HandoverFieldKey, string | null>,
  );
  const ci = (recRow.contract_info ?? {}) as Record<string, unknown>;
  const contractInfo = {
    title: typeof ci.title === "string" ? ci.title : "",
    type: typeof ci.type === "string" ? ci.type : "",
    progress: typeof ci.progress === "string" ? ci.progress : "",
    status: typeof ci.status === "string" ? ci.status : "",
    memo: typeof ci.memo === "string" ? ci.memo : "",
  };
  const contractChecklist = Array.isArray(recRow.contract_data_checklist)
    ? (recRow.contract_data_checklist as { text: string; done: boolean }[])
    : [];
  const docsChecklist = Array.isArray(recRow.docs_checklist)
    ? (recRow.docs_checklist as { text: string; done: boolean }[])
    : [];
  const schoolContacts = Array.isArray(recRow.school_contacts)
    ? (recRow.school_contacts as {
        name: string;
        jobTitle: string | null;
        phone: string | null;
        email: string | null;
      }[])
    : [];
  const pf = (recRow.payment_fee ?? {}) as Record<string, unknown>;
  const paymentFee = {
    deadline: typeof pf.deadline === "string" ? pf.deadline : "",
    manager: typeof pf.manager === "string" ? pf.manager : "",
    memo: typeof pf.memo === "string" ? pf.memo : "",
  };
  const pi = (recRow.payment_invoice ?? {}) as Record<string, unknown>;
  const paymentInvoice = {
    issueType: typeof pi.issueType === "string" ? pi.issueType : "",
    memo: typeof pi.memo === "string" ? pi.memo : "",
  };

  // 2) PDF 생성
  const pdfBuf = await renderHandoverPdf({
    universityName: p.services.university_name,
    serviceName: p.services.service_name,
    applicationType: p.services.application_type,
    fromName: p.from_name,
    fromEmail: p.from_email,
    toName: p.to_name,
    toEmail: p.to_email,
    notes: p.notes,
    contractInfo,
    contractChecklist,
    docsChecklist,
    schoolContacts,
    paymentFee,
    paymentInvoice,
    createdAt: new Date().toISOString(),
    fields,
  });

  // 3) HTML 본문
  const subject = buildHandoverMailSubject({
    universityName: p.services.university_name,
    serviceName: p.services.service_name,
  });
  const html = buildHandoverMailHtml({
    universityName: p.services.university_name,
    serviceName: p.services.service_name,
    applicationType: p.services.application_type,
    fromName: p.from_name,
    fromEmail: p.from_email,
    toName: p.to_name,
    toEmail: p.to_email,
    notes: p.notes,
    historyUrl: `${baseUrl()}/dashboard/handover?tab=history`,
  });

  if (isDryRun()) {
    console.log(
      `[handover-mail] DRY_RUN — to=${p.to_email} subject="${subject}" pdf=${pdfBuf.length}bytes`,
    );
    return { ok: true, status: "dry_run" };
  }

  // 4) Graph sendMail
  const result = await sendGraphMail({
    senderUserId: me.email,
    toEmail: p.to_email,
    toName: p.to_name,
    subject,
    html,
    attachments: [
      {
        name: `handover-${p.services.service_id}-${p.services.university_name}.pdf`,
        contentBytes: pdfBuf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, status: "sent", messageId: result.messageId };
}
