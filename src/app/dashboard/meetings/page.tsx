import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMeetings } from "@/features/meetings/queries";
import { meetingToListRow } from "./_row-mapper";
import { NewMeetingButton } from "./_components/NewMeetingButton";

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; page?: string }>;
}) {
  const slug = "meetings";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const me = await getCurrentOperator();

  const allMeetings = await listMeetings();
  const mine = sp.mine !== "false";
  const visible =
    mine && me?.email
      ? allMeetings.filter((m) => m.author_email === me.email)
      : allMeetings;

  const { rows, total } = paginateRows<ListRow>(
    visible.map(meetingToListRow),
    sp.page,
  );
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="meetings"
      readOnly
      currentUserName={me?.displayName ?? me?.email ?? ""}
      currentUserEmail={me?.email ?? null}
      currentUserPermission={me?.permission ?? null}
      inlineFilters={
        <ScopeChips key="meetings-scope" total={total} mineLabel="내 회의록" />
      }
      extraActions={<NewMeetingButton />}
      footer={
        <ListPagination key="meetings-pagination" total={total} pageSize={30} />
      }
    />
  );
}
