import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  mailboxMessageSchema,
  mailboxDraftSchema,
  type MailboxMessage,
  type MailboxDraft,
} from "./schemas";

export type MailboxEntry = {
  message: MailboxMessage;
  /** 가장 최근 draft (없으면 null) */
  latestDraft: MailboxDraft | null;
};

/** 본인 메일함(owner_email) 수신 메일 + 최신 초안. received_at desc. */
export async function listMailbox(
  ownerEmail: string,
  limit = 50,
): Promise<MailboxEntry[]> {
  const supabase = await createClient();
  const { data: msgs, error } = await supabase
    .from("mailbox_messages")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listMailbox] supabase error:", error);
    return [];
  }

  const messages: MailboxMessage[] = [];
  for (const row of msgs ?? []) {
    const r = mailboxMessageSchema.safeParse(row);
    if (r.success) messages.push(r.data);
    else console.error("[listMailbox] zod parse fail:", r.error.issues);
  }
  if (messages.length === 0) return [];

  const ids = messages.map((m) => m.id);
  const { data: drafts } = await supabase
    .from("mailbox_drafts")
    .select("*")
    .in("message_id", ids)
    .order("created_at", { ascending: false });

  const latestByMsg = new Map<string, MailboxDraft>();
  for (const row of drafts ?? []) {
    const r = mailboxDraftSchema.safeParse(row);
    if (!r.success) continue;
    if (!latestByMsg.has(r.data.message_id))
      latestByMsg.set(r.data.message_id, r.data); // created_at desc → 첫 건이 최신
  }

  return messages.map((message) => ({
    message,
    latestDraft: latestByMsg.get(message.id) ?? null,
  }));
}

/** 메일함 토글 상태 조회 (없으면 기본 ON). */
export async function getAutoDraftEnabled(
  ownerEmail: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mailbox_settings")
    .select("auto_draft_enabled")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data?.auto_draft_enabled ?? true;
}
