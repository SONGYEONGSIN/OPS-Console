"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { getMeeting } from "./queries";
import { renderMeetingPdf } from "@/lib/pdf/meeting-pdf";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { uploadFileToFolder } from "@/lib/microsoft/drive-upload";

const DRY_RUN = process.env.MAIL_DRY_RUN === "true";
const PATH_PREFIX = "/dashboard/meetings";

export async function sendMeetingMinutes(
  id: string,
  recipients: string[],
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  if (recipients.length === 0) {
    return { ok: false, error: "수신자를 한 명 이상 지정하세요." };
  }

  const meeting = await getMeeting(id);
  if (!meeting) return { ok: false, error: "회의록을 찾을 수 없습니다." };

  const supabase = createAdminClient();
  const subject = `[운영부 상황실] 회의록 — ${meeting.title}`;
  const pdf = Buffer.from(await renderToBuffer(renderMeetingPdf(meeting)));
  const fileName = `회의록_${meeting.title}.pdf`;

  if (DRY_RUN) {
    await supabase.from("meeting_mail_sends").insert({
      meeting_id: id,
      sent_by_email: me.email,
      recipients,
      subject,
      status: "dry_run",
    });
    await supabase.from("meetings").update({ status: "sent" }).eq("id", id);
    revalidatePath(`${PATH_PREFIX}/${id}`);
    return { ok: true };
  }

  const [toEmail, ...ccEmails] = recipients;
  const cc = ccEmails.map((email) => ({ email }));

  const res = await sendGraphMail({
    senderUserId: me.email,
    toEmail,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    html: `<p>운영부 회의록을 전달드립니다. (${meeting.title})</p>`,
    attachments: [
      {
        name: fileName,
        contentBytes: pdf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });

  if (!res.ok) {
    await supabase.from("meeting_mail_sends").insert({
      meeting_id: id,
      sent_by_email: me.email,
      recipients,
      subject,
      status: "failed",
      error: res.error,
    });
    return { ok: false, error: res.error };
  }

  let sharepointUrl: string | null = null;
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const folderId = process.env.SHAREPOINT_MEETINGS_FOLDER_ID;
  if (driveId && folderId) {
    try {
      const uploaded = await uploadFileToFolder(
        driveId,
        folderId,
        fileName,
        pdf,
        "application/pdf",
      );
      sharepointUrl = uploaded.webUrl;
    } catch (e) {
      console.error("[meetings] SharePoint 업로드 실패 (메일은 발송됨):", e);
    }
  } else {
    console.warn("[meetings] SHAREPOINT_MEETINGS_FOLDER_ID 미설정 — 업로드 스킵");
  }

  await supabase
    .from("meetings")
    .update({ status: "sent", sharepoint_url: sharepointUrl })
    .eq("id", id);
  await supabase.from("meeting_mail_sends").insert({
    meeting_id: id,
    sent_by_email: me.email,
    recipients,
    subject,
    status: "sent",
  });
  revalidatePath(`${PATH_PREFIX}/${id}`);
  return { ok: true };
}
