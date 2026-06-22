"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { logActivity } from "@/features/worklog/log";
import { sendReplySchema, setAutoDraftSchema } from "./schemas";

export type MailboxActionResult = { ok: true } | { ok: false; error: string };

const MAILBOX_PATH = "/dashboard/mailbox";

/** 회신 발송 — 본인 메일함 한정. sendGraphMail(sender=owner_email). MAIL_DRY_RUN 안전장치. */
export async function sendMailReply(
  messageId: string,
  editedBody: string,
): Promise<MailboxActionResult> {
  const parsed = sendReplySchema.safeParse({ messageId, editedBody });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { data: msg, error: msgErr } = await admin
    .from("mailbox_messages")
    .select("id, owner_email, from_email, from_name, subject")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (msgErr) return { ok: false, error: msgErr.message };
  if (!msg) return { ok: false, error: "메일을 찾을 수 없습니다." };

  // Phase 1: 본인 메일함만 발송 가능 (Phase 2에서 canAccessMailbox로 확장).
  if (msg.owner_email !== me.email) {
    return { ok: false, error: "권한 없음 — 본인 메일함이 아닙니다." };
  }
  if (!msg.from_email) {
    return { ok: false, error: "원발신자 주소가 없어 회신할 수 없습니다." };
  }

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  const subject = msg.subject?.startsWith("RE:")
    ? msg.subject
    : `RE: ${msg.subject ?? ""}`;

  if (!dryRun) {
    const result = await sendGraphMail({
      senderUserId: msg.owner_email, // 메일함 주인 명의 발송
      toEmail: msg.from_email,
      toName: msg.from_name ?? undefined,
      subject,
      text: parsed.data.editedBody,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }

  const { error: draftErr } = await admin.from("mailbox_drafts").insert({
    message_id: msg.id,
    draft_body: parsed.data.editedBody,
    status: dryRun ? "dry_run" : "sent",
    sent_at: new Date().toISOString(),
    sent_by_email: me.email, // 실제 처리자 감사 추적
  });
  if (draftErr) return { ok: false, error: draftErr.message };

  await logActivity({
    domain: "mailbox",
    action: dryRun ? "reply_dry_run" : "reply_sent",
    target_type: "mailbox_messages",
    target_id: msg.id,
    target_name: `${msg.from_name ?? msg.from_email} · ${subject}`,
    msg: dryRun ? "회신 메일 (dry-run)" : "회신 메일 발송",
  });
  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}

/** 메일함 자동초안 토글 (요구사항 4). settings upsert. */
export async function setAutoDraftEnabled(
  ownerEmail: string,
  enabled: boolean,
): Promise<MailboxActionResult> {
  const parsed = setAutoDraftSchema.safeParse({ ownerEmail, enabled });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me?.email || me.email !== parsed.data.ownerEmail) {
    return { ok: false, error: "권한 없음 — 본인 메일함 설정만 변경할 수 있습니다." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("mailbox_settings").upsert(
    {
      owner_email: parsed.data.ownerEmail,
      auto_draft_enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_email" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}
