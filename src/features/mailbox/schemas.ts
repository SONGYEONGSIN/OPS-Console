import { z } from "zod";

/** mailbox_messages 행 — Phase 1: 수신 메일 캐시 (ingest 잡 upsert). */
export const mailboxMessageSchema = z.object({
  id: z.string().uuid(),
  owner_email: z.string().min(1),
  graph_message_id: z.string().min(1),
  from_name: z.string().nullable(),
  from_email: z.string().nullable(),
  subject: z.string().nullable(),
  body_preview: z.string().nullable(),
  body: z.string().nullable(),
  received_at: z.string().nullable(),
  is_read: z.boolean(),
  draft_skipped: z.boolean(),
  created_at: z.string(),
});
export type MailboxMessage = z.infer<typeof mailboxMessageSchema>;

/** mailbox_drafts 행 — 회신 초안/발송 이력. */
export const mailboxDraftSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  draft_body: z.string().nullable(),
  model_used: z.string().nullable(),
  status: z.enum(["draft", "sent", "discarded", "dry_run"]),
  sent_at: z.string().nullable(),
  sent_by_email: z.string().nullable(),
  created_at: z.string(),
});
export type MailboxDraft = z.infer<typeof mailboxDraftSchema>;

/** sendMailReply 액션 입력. */
export const sendReplySchema = z.object({
  messageId: z.string().uuid(),
  editedBody: z.string().min(1, "회신 본문을 입력하세요."),
});
export type SendReplyInput = z.infer<typeof sendReplySchema>;

/** setAutoDraftEnabled 액션 입력. */
export const setAutoDraftSchema = z.object({
  ownerEmail: z.string().min(1),
  enabled: z.boolean(),
});
export type SetAutoDraftInput = z.infer<typeof setAutoDraftSchema>;

export const mailboxDelegationSchema = z.object({
  id: z.string().uuid(),
  owner_email: z.string(),
  grantee_email: z.string(),
  granted_at: z.string(),
  revoked_at: z.string().nullable(),
});
export type MailboxDelegation = z.infer<typeof mailboxDelegationSchema>;

export const delegationInputSchema = z.object({
  granteeEmail: z.string().email("올바른 이메일이 아닙니다."),
});
