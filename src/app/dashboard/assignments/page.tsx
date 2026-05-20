import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { fetchAssignmentSheet, SHEET_NAMES } from "@/features/assignments/queries";
import {
  parseBaejungList,
  parseSimpleSheet,
  parsePims,
  joinByUniversity,
} from "@/features/assignments/parse";
import type { AssignmentRecord } from "@/features/assignments/schemas";
import { univRowToListRow } from "./_row-mapper";
import { AssignmentTabs } from "./_components/AssignmentTabs";
import { AssignmentUnivTab } from "./_components/AssignmentUnivTab";
import { SheetGrid } from "./_components/SheetGrid";

function ErrorBox() {
  return (
    <section className="p-7">
      <div className="border border-dashed border-vermilion-deep bg-washi-raised p-8 text-center">
        <p className="text-sm font-medium text-vermilion-deep">
          SharePoint 데이터를 불러올 수 없습니다
        </p>
        <p className="mt-2 text-xs text-muted">
          환경변수 (AZURE_AD_* / SHAREPOINT_DRIVE_ID / SHAREPOINT_ASSIGNMENTS_ITEM_ID)
          또는 Azure AD 앱 권한을 확인하세요.
        </p>
      </div>
    </section>
  );
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const slug = "assignments";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "duties" || tabParam === "pricing" ? tabParam : "univ";

  const config = resolvePageMeta(slug, meta, 0);
  const header = (
    <PageHeader
      key="assignments-header"
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  if (tab === "duties" || tab === "pricing") {
    const sheet = await fetchAssignmentSheet(
      tab === "duties" ? SHEET_NAMES.업무분장 : SHEET_NAMES.가격정책,
    );
    return (
      <>
        {header}
        <AssignmentTabs active={tab} />
        {sheet ? <SheetGrid sheet={sheet} /> : <ErrorBox />}
      </>
    );
  }

  const [baejung, daehakwon, pims, sungjuk, sangdam] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.성적산출),
    fetchAssignmentSheet(SHEET_NAMES.상담앱),
  ]);

  if (!baejung && !daehakwon && !pims && !sungjuk && !sangdam) {
    return (
      <>
        {header}
        <AssignmentTabs active="univ" />
        <ErrorBox />
      </>
    );
  }

  const recs: AssignmentRecord[] = [
    ...(baejung ? parseBaejungList(baejung) : []),
    ...(daehakwon
      ? parseSimpleSheet(daehakwon, "대학원", { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ })
      : []),
    ...(pims ? parsePims(pims) : []),
    ...(sungjuk
      ? parseSimpleSheet(sungjuk, "성적산출", { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ })
      : []),
    ...(sangdam
      ? parseSimpleSheet(sangdam, "상담앱", { uni: /학교명|대학명/, op: /^운영자$/, dev: /^개발자$/ })
      : []),
  ];

  const rows: ListRow[] = joinByUniversity(recs).map(univRowToListRow);

  return (
    <>
      {header}
      <AssignmentTabs active="univ" />
      <AssignmentUnivTab rows={rows} title={meta.label} />
    </>
  );
}
