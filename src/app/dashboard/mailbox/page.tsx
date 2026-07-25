import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMailbox, getAutoDraftEnabled } from "@/features/mailbox/queries";
import {
  filterScope,
  countScopes,
  matchesSearch,
  type MailboxScope,
} from "@/features/mailbox/triage";
import {
  sendMailReply,
  markMailRead,
  ensureMailboxSettings,
} from "@/features/mailbox/actions";
import {
  canAccessMailbox,
  listMailboxesDelegatedTo,
  listMyDelegations,
} from "@/features/mailbox/delegation";
import { operatorNameByEmail } from "@/features/auth/operators";
import { listOperators } from "@/features/operators/queries";
import { mailboxEntryToListRow } from "./_row-mapper";
import { AutoDraftToggle } from "./AutoDraftToggle";
import { MailboxOwnerSwitcher } from "./MailboxOwnerSwitcher";
import { MailboxDelegationPanel } from "./MailboxDelegationPanel";
import { MailboxScopeChips } from "./MailboxScopeChips";
import { MailboxControls } from "./MailboxControls";

const PAGE_SIZE = 30;
// 트리아지: 전량(상한) fetch 후 인메모리 검색·scope 필터·slice (receivables 방식).
const FETCH_LIMIT = 500;

export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    owner?: string;
    page?: string;
    scope?: string;
    q?: string;
  }>;
}) {
  const slug = "mailbox";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const myEmail = me?.email ?? "";

  // 메일함 접근 시 본인 계정을 수집 대상으로 자동 등록(insert-if-absent, 자동초안 OFF).
  // 다음 cron ingest부터 본인 외부고객 메일이 수집된다. 기존 토글은 보존.
  if (myEmail) await ensureMailboxSettings(myEmail);

  const sp = await searchParams;
  const requestedOwner = sp.owner?.trim() || myEmail;
  // 본인 또는 활성 위임만 열람. 권한 없으면 본인 메일함으로 폴백.
  const canView =
    requestedOwner === myEmail ||
    (!!myEmail && (await canAccessMailbox(myEmail, requestedOwner)));
  const owner = canView ? requestedOwner : myEmail;

  const myDelegations = myEmail ? await listMyDelegations(myEmail) : [];

  // 위임 후보 = active 운영자 중 본인·이미 위임한 사람 제외(조직·권한 계정 선택용).
  const operators = myEmail ? await listOperators() : [];
  const delegatedSet = new Set(myDelegations.map((d) => d.grantee_email));
  const delegationCandidates = operators
    .filter(
      (o) =>
        o.status === "active" && o.email !== myEmail && !delegatedSet.has(o.email),
    )
    .map((o) => ({ email: o.email, name: o.name }));

  const delegatedOwners = myEmail
    ? await listMailboxesDelegatedTo(myEmail)
    : [];
  const ownerOptions = [
    { email: myEmail, label: "내 메일함" },
    ...delegatedOwners.map((e) => ({
      email: e,
      label: `${operatorNameByEmail(e)} 메일함`,
    })),
  ];

  const allEntries = owner ? await listMailbox(owner, FETCH_LIMIT) : [];
  const autoEnabled = owner ? await getAutoDraftEnabled(owner) : true;

  // 트리아지 — 검색 적용 → scope별 카운트(칩) → scope 필터 → 30개 slice 페이지네이션.
  const now = new Date().getTime();
  const q = sp.q?.trim() ?? "";
  const scope: MailboxScope =
    sp.scope === "unreplied" || sp.scope === "today" || sp.scope === "unread"
      ? sp.scope
      : "all";
  const searched = q
    ? allEntries.filter((e) => matchesSearch(e, q))
    : allEntries;
  const counts = countScopes(searched, now);
  const scoped = filterScope(searched, scope, now);

  const total = scoped.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, Number(sp.page) || 1));
  const start = (page - 1) * PAGE_SIZE;
  const rows: ListRow[] = scoped
    .slice(start, start + PAGE_SIZE)
    .map(mailboxEntryToListRow);
  const config = resolvePageMeta(slug, meta, total);

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

  // 메일 열람 시 읽음 처리(안읽음 → is_read=true). row.id = mailbox_messages.id.
  async function onMailOpen(row: ListRow): Promise<void> {
    "use server";
    if (row.id) await markMailRead(row.id);
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
      onSelectRow={onMailOpen}
      controlsRow={<MailboxControls key="mailbox-controls" />}
      inlineFilters={
        <MailboxScopeChips key="mailbox-scope" counts={counts} />
      }
      footer={
        <ListPagination
          key="mailbox-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
      extraActions={
        <div className="flex items-center gap-2">
          <MailboxOwnerSwitcher options={ownerOptions} current={owner} />
          {owner === myEmail && myEmail ? (
            <>
              <MailboxDelegationPanel
                delegations={myDelegations}
                candidates={delegationCandidates}
              />
              <AutoDraftToggle
                key="mailbox-toggle"
                ownerEmail={myEmail}
                initialEnabled={autoEnabled}
              />
            </>
          ) : null}
        </div>
      }
    />
  );
}
