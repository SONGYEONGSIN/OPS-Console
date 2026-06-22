import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMailbox, getAutoDraftEnabled } from "@/features/mailbox/queries";
import { sendMailReply } from "@/features/mailbox/actions";
import { mailboxEntryToListRow } from "./_row-mapper";
import { AutoDraftToggle } from "./AutoDraftToggle";

export default async function MailboxPage() {
  const slug = "mailbox";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const myEmail = me?.email ?? "";

  const entries = myEmail ? await listMailbox(myEmail) : [];
  const autoEnabled = myEmail ? await getAutoDraftEnabled(myEmail) : true;
  const rows: ListRow[] = entries.map(mailboxEntryToListRow);
  const config = resolvePageMeta(slug, meta, entries.length);

  const header = (
    <div key="mailbox-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );

  async function onMailReply(
    messageId: string,
    editedBody: string,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await sendMailReply(messageId, editedBody);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="mailbox"
      readOnly
      liveData
      currentUserName={me?.displayName ?? me?.email ?? ""}
      onMailReply={onMailReply}
      extraActions={
        myEmail ? (
          <AutoDraftToggle
            key="mailbox-toggle"
            ownerEmail={myEmail}
            initialEnabled={autoEnabled}
          />
        ) : undefined
      }
    />
  );
}
