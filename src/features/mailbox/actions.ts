"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { logActivity } from "@/features/worklog/log";
import {
  sendReplySchema,
  setAutoDraftSchema,
  delegationInputSchema,
} from "./schemas";
import { canAccessMailbox, expiryFromDate } from "./delegation";
import { buildReplyHtml } from "@/lib/mail-signature";

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

  // 본인 메일함이거나 활성 위임을 받은 경우만 발송 가능 (발신 명의는 주인).
  if (!(await canAccessMailbox(me.email, msg.owner_email))) {
    return {
      ok: false,
      error: "권한 없음 — 본인 또는 위임받은 메일함이 아닙니다.",
    };
  }
  if (!msg.from_email) {
    return { ok: false, error: "원발신자 주소가 없어 회신할 수 없습니다." };
  }

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  const subject = msg.subject?.startsWith("RE:")
    ? msg.subject
    : `RE: ${msg.subject ?? ""}`;

  // 발신 명의(메일함 주인)의 운영자 정보로 HTML 서명 생성.
  const { data: ownerOp } = await admin
    .from("operators")
    .select("name, department, team, role, phone")
    .eq("email", msg.owner_email)
    .maybeSingle();
  const html = buildReplyHtml(parsed.data.editedBody, ownerOp ?? {});

  if (!dryRun) {
    const result = await sendGraphMail({
      senderUserId: msg.owner_email, // 메일함 주인 명의 발송
      toEmail: msg.from_email,
      toName: msg.from_name ?? undefined,
      subject,
      html, // plain → HTML + 클릭 가능 서명
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
    return {
      ok: false,
      error: "권한 없음 — 본인 메일함 설정만 변경할 수 있습니다.",
    };
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

/** 위임 등록 — owner=me 고정. B는 실 운영자여야 하고 본인은 불가. 재위임 시 revoked_at 복구. */
export async function grantMailboxDelegation(
  granteeEmail: string,
  expiresOn?: string | null,
): Promise<MailboxActionResult> {
  const parsed = delegationInputSchema.safeParse({
    granteeEmail,
    expiresOn: expiresOn ?? null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const grantee = parsed.data.granteeEmail;
  const expiresAt = expiryFromDate(parsed.data.expiresOn ?? null);
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return { ok: false, error: "종료일은 오늘 이후여야 합니다." };
  }

  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "로그인이 필요합니다." };
  if (me.email === grantee) {
    return { ok: false, error: "본인에게 위임할 수 없습니다." };
  }

  const admin = createAdminClient();
  const { data: op, error: opError } = await admin
    .from("operators")
    .select("email")
    .eq("email", grantee)
    .maybeSingle();
  if (opError) return { ok: false, error: opError.message };
  if (!op) {
    return { ok: false, error: "등록되지 않은 운영자입니다." };
  }

  const { error } = await admin.from("mailbox_delegations").upsert(
    {
      owner_email: me.email,
      grantee_email: grantee,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      expires_at: expiresAt,
    },
    { onConflict: "owner_email,grantee_email" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}

/** 위임 해제 — owner=me 고정. revoked_at 설정(soft). */
export async function revokeMailboxDelegation(
  granteeEmail: string,
): Promise<MailboxActionResult> {
  const parsed = delegationInputSchema.safeParse({ granteeEmail });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("mailbox_delegations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("owner_email", me.email)
    .eq("grantee_email", parsed.data.granteeEmail);
  if (error) return { ok: false, error: error.message };

  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}

/**
 * 본인 메일함 수집 등록 — 메일함 페이지 접근 시 호출.
 * `mailbox_settings` row를 insert-if-absent로 보장(자동초안 기본 OFF, opt-in).
 * 이미 row가 있으면 ignoreDuplicates로 토글 설정을 보존한다.
 * cron ingest는 row 존재 운영자만 순회하므로(스펙 §13), 메일함을 연 운영자가
 * 다음 수집부터 자동으로 본인 계정 수집 대상이 된다.
 */
export async function ensureMailboxSettings(
  ownerEmail: string,
): Promise<MailboxActionResult> {
  const me = await getCurrentOperator();
  if (!me?.email || me.email !== ownerEmail) {
    return {
      ok: false,
      error: "권한 없음 — 본인 메일함만 등록할 수 있습니다.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("mailbox_settings").upsert(
    {
      owner_email: ownerEmail,
      auto_draft_enabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_email", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
