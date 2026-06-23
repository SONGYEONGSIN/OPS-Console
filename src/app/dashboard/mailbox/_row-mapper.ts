import type { ListRow } from "../_components/patterns/ListPattern";
import type { MailboxEntry } from "@/features/mailbox/queries";
import { cleanMailBody } from "@/features/mailbox/clean-body";

export function mailboxEntryToListRow(e: MailboxEntry): ListRow {
  const { message: m, latestDraft: d } = e;
  return {
    id: m.id,
    name: m.subject ?? "(제목 없음)",
    status: "active",
    owner: m.owner_email,
    mailId: m.graph_message_id,
    mailOwnerEmail: m.owner_email,
    mailFromName: m.from_name,
    mailFromEmail: m.from_email,
    mailSubject: m.subject,
    mailBody: cleanMailBody(m.body),
    mailReceivedAt: m.received_at,
    mailIsRead: m.is_read,
    mailHasDraft: d !== null,
    mailDraftBody: d?.draft_body ?? null,
    mailDraftStatus: d?.status ?? null,
    mailDraftModel: d?.model_used ?? null,
  };
}
