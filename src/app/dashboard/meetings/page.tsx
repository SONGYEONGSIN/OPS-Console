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
import { listOperators } from "@/features/operators/queries";
import { MEETING_TYPES, type MeetingType } from "@/features/meetings/schemas";
import { meetingToListRow } from "./_row-mapper";
import { MeetingsControls } from "./MeetingsControls";
import { NewMeetingButton } from "./_components/NewMeetingButton";

const TYPE_VALUES = new Set<string>(MEETING_TYPES);

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mine?: string;
    page?: string;
    type?: string;
    q?: string;
  }>;
}) {
  const slug = "meetings";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const me = await getCurrentOperator();

  const [allMeetings, operators] = await Promise.all([
    listMeetings(),
    listOperators(),
  ]);
  // 작성자 이메일 → 등록 이름 매핑 (목록 표시 + 검색 대상)
  const nameMap = new Map(operators.map((o) => [o.email, o.name]));

  // 유형 필터 — 유효한 MeetingType일 때만 적용
  const typeFilter: MeetingType | undefined = TYPE_VALUES.has(sp.type ?? "")
    ? (sp.type as MeetingType)
    : undefined;
  const byType = typeFilter
    ? allMeetings.filter((m) => m.type === typeFilter)
    : allMeetings;

  // 검색 필터 — 제목 또는 작성자(이름/이메일) ilike (case-insensitive)
  const qLower = (sp.q ?? "").trim().toLowerCase();
  const bySearch = qLower
    ? byType.filter((m) => {
        const authorName = nameMap.get(m.author_email) ?? "";
        return (
          m.title.toLowerCase().includes(qLower) ||
          authorName.toLowerCase().includes(qLower) ||
          m.author_email.toLowerCase().includes(qLower)
        );
      })
    : byType;

  const mine = sp.mine !== "false";
  const visible =
    mine && me?.email
      ? bySearch.filter((m) => m.author_email === me.email)
      : bySearch;

  const { rows, total } = paginateRows<ListRow>(
    visible.map((m) => meetingToListRow(m, nameMap.get(m.author_email))),
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
      liveData
      currentUserName={me?.displayName ?? me?.email ?? ""}
      currentUserEmail={me?.email ?? null}
      currentUserPermission={me?.permission ?? null}
      controlsRow={<MeetingsControls key="meetings-controls" />}
      hideVariantFilters
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
