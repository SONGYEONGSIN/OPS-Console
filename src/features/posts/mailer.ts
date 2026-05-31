import "server-only";

import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { brandLogoImg } from "@/lib/mail/brand-logo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostRow, PostStatus } from "./schemas";

export const FEEDBACK_OWNER_EMAIL = "ys1114@jinhakapply.com";
export const FEEDBACK_OWNER_NAME = "송영신";

export const FEEDBACK_STATUS_LABEL: Record<PostStatus, string> = {
  urgent: "요청",
  review: "확인",
  active: "처리중",
  approved: "처리완료",
};

export type FeedbackMailEvent = "create" | "status_change";

export type FeedbackMailSendResult =
  | { status: "sent"; messageId?: string }
  | { status: "dry_run" }
  | { status: "failed"; error: string }
  | { status: "skipped" };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s: string): string {
  return s.replace(/\n/g, "<br>");
}

export function buildOwnerNotifySubject(args: { title: string }): string {
  return `[운영부 상황실] 새 개선요청: ${args.title}`;
}

export function buildStatusNotifySubject(args: {
  title: string;
  statusTo: PostStatus;
}): string {
  const label = FEEDBACK_STATUS_LABEL[args.statusTo];
  return `[운영부 상황실] 개선요청 ${label}: ${args.title}`;
}

export function buildOwnerNotifyBody(args: {
  post: PostRow;
  authorName: string;
  appUrl: string;
}): string {
  const { post, authorName, appUrl } = args;
  const link = `${appUrl}/dashboard/feedback`;
  const slug = post.slug ?? "";
  const bodyText = post.body ?? "";
  const bodySection = bodyText.trim()
    ? `<p style="margin:16px 0 4px;color:#374151;font-weight:600;">본문 미리보기</p>
       <div style="padding:12px 14px;background:#f9fafb;border-left:3px solid #d1d5db;color:#4b5563;font-size:14px;line-height:1.6;">${nl2br(escapeHtml(bodyText))}</div>`
    : "";

  return `<div style="font-family:-apple-system,'Pretendard',sans-serif;color:#111827;font-size:14px;line-height:1.7;max-width:560px;">
  <div style="margin:0 0 10px;">${brandLogoImg(36)}</div>
  <p style="margin:0 0 12px;color:#6b7280;font-size:12px;letter-spacing:0.04em;">[운영부 상황실]</p>
  <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;">새 개선요청이 등록되었습니다</h2>

  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr>
      <td style="padding:6px 0;color:#6b7280;width:80px;">번호</td>
      <td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(slug)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;">등록자</td>
      <td style="padding:6px 0;color:#111827;">${escapeHtml(authorName)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;">제목</td>
      <td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(post.title)}</td>
    </tr>
  </table>

  ${bodySection}

  <p style="margin:20px 0 0;"><a href="${link}" style="color:#dc2626;text-decoration:none;font-weight:600;">개선요청 게시판 열기 →</a></p>

  <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">본 메일은 OPS Console에서 자동 발송되었습니다.</p>
</div>`;
}

export function buildStatusNotifyBody(args: {
  post: PostRow;
  statusTo: PostStatus;
  changerName: string;
  appUrl: string;
}): string {
  const { post, statusTo, changerName, appUrl } = args;
  const label = FEEDBACK_STATUS_LABEL[statusTo];
  const link = `${appUrl}/dashboard/feedback`;
  const slug = post.slug ?? "";

  return `<div style="font-family:-apple-system,'Pretendard',sans-serif;color:#111827;font-size:14px;line-height:1.7;max-width:560px;">
  <div style="margin:0 0 10px;">${brandLogoImg(36)}</div>
  <p style="margin:0 0 12px;color:#6b7280;font-size:12px;letter-spacing:0.04em;">[운영부 상황실]</p>
  <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;">개선요청 상태가 <span style="color:#dc2626;">${escapeHtml(label)}</span>(으)로 변경되었습니다</h2>

  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr>
      <td style="padding:6px 0;color:#6b7280;width:80px;">번호</td>
      <td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(slug)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;">제목</td>
      <td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(post.title)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;">변경자</td>
      <td style="padding:6px 0;color:#111827;">${escapeHtml(changerName)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#6b7280;">현재 상태</td>
      <td style="padding:6px 0;color:#111827;font-weight:600;">${escapeHtml(label)}</td>
    </tr>
  </table>

  <p style="margin:20px 0 0;"><a href="${link}" style="color:#dc2626;text-decoration:none;font-weight:600;">개선요청 게시판 열기 →</a></p>

  <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">본 메일은 OPS Console에서 자동 발송되었습니다.</p>
</div>`;
}

type HistoryInsertRow = {
  post_id: string;
  event_type: FeedbackMailEvent;
  status_to: PostStatus | null;
  sender_operator_id: string | null;
  sender_email: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

async function insertHistory(row: HistoryInsertRow): Promise<void> {
  const admin = createAdminClient();
  await admin.from("feedback_mail_sends").insert(row);
}

export type SendFeedbackOwnerNotifyArgs = {
  post: PostRow;
  senderEmail: string;
  senderOperatorId: string | null;
  authorName: string;
  appUrl: string;
  dryRun: boolean;
};

export async function sendFeedbackOwnerNotify(
  args: SendFeedbackOwnerNotifyArgs,
): Promise<FeedbackMailSendResult> {
  const { post, senderEmail, senderOperatorId, authorName, appUrl, dryRun } = args;

  if (senderEmail.toLowerCase() === FEEDBACK_OWNER_EMAIL.toLowerCase()) {
    return { status: "skipped" };
  }

  const subject = buildOwnerNotifySubject({ title: post.title });

  if (dryRun) {
    await insertHistory({
      post_id: post.id,
      event_type: "create",
      status_to: null,
      sender_operator_id: senderOperatorId,
      sender_email: senderEmail,
      recipient_email: FEEDBACK_OWNER_EMAIL,
      recipient_name: FEEDBACK_OWNER_NAME,
      subject,
      graph_message_id: null,
      status: "dry_run",
      error_message: null,
    });
    return { status: "dry_run" };
  }

  const html = buildOwnerNotifyBody({ post, authorName, appUrl });
  const sendRes = await sendGraphMail({
    senderUserId: senderEmail,
    toEmail: FEEDBACK_OWNER_EMAIL,
    toName: FEEDBACK_OWNER_NAME,
    subject,
    html,
  });

  if (sendRes.ok) {
    await insertHistory({
      post_id: post.id,
      event_type: "create",
      status_to: null,
      sender_operator_id: senderOperatorId,
      sender_email: senderEmail,
      recipient_email: FEEDBACK_OWNER_EMAIL,
      recipient_name: FEEDBACK_OWNER_NAME,
      subject,
      graph_message_id: sendRes.messageId ?? null,
      status: "sent",
      error_message: null,
    });
    return { status: "sent", messageId: sendRes.messageId };
  }

  await insertHistory({
    post_id: post.id,
    event_type: "create",
    status_to: null,
    sender_operator_id: senderOperatorId,
    sender_email: senderEmail,
    recipient_email: FEEDBACK_OWNER_EMAIL,
    recipient_name: FEEDBACK_OWNER_NAME,
    subject,
    graph_message_id: null,
    status: "failed",
    error_message: sendRes.error,
  });
  return { status: "failed", error: sendRes.error };
}

export type SendFeedbackStatusNotifyArgs = {
  post: PostRow;
  statusTo: PostStatus;
  senderEmail: string;
  senderOperatorId: string | null;
  changerName: string;
  appUrl: string;
  dryRun: boolean;
};

export async function sendFeedbackStatusNotify(
  args: SendFeedbackStatusNotifyArgs,
): Promise<FeedbackMailSendResult> {
  const { post, statusTo, senderEmail, senderOperatorId, changerName, appUrl, dryRun } =
    args;

  const recipientEmail = post.author_email;
  if (senderEmail.toLowerCase() === recipientEmail.toLowerCase()) {
    return { status: "skipped" };
  }

  const subject = buildStatusNotifySubject({ title: post.title, statusTo });

  if (dryRun) {
    await insertHistory({
      post_id: post.id,
      event_type: "status_change",
      status_to: statusTo,
      sender_operator_id: senderOperatorId,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      recipient_name: null,
      subject,
      graph_message_id: null,
      status: "dry_run",
      error_message: null,
    });
    return { status: "dry_run" };
  }

  const html = buildStatusNotifyBody({ post, statusTo, changerName, appUrl });
  const sendRes = await sendGraphMail({
    senderUserId: senderEmail,
    toEmail: recipientEmail,
    subject,
    html,
  });

  if (sendRes.ok) {
    await insertHistory({
      post_id: post.id,
      event_type: "status_change",
      status_to: statusTo,
      sender_operator_id: senderOperatorId,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      recipient_name: null,
      subject,
      graph_message_id: sendRes.messageId ?? null,
      status: "sent",
      error_message: null,
    });
    return { status: "sent", messageId: sendRes.messageId };
  }

  await insertHistory({
    post_id: post.id,
    event_type: "status_change",
    status_to: statusTo,
    sender_operator_id: senderOperatorId,
    sender_email: senderEmail,
    recipient_email: recipientEmail,
    recipient_name: null,
    subject,
    graph_message_id: null,
    status: "failed",
    error_message: sendRes.error,
  });
  return { status: "failed", error: sendRes.error };
}
