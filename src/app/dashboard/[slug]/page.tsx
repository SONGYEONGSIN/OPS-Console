import { notFound } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { getPatternMockData } from "../_data/patterns";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { requireMenu } from "@/features/auth/menu-guard";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { DashPattern } from "../_components/patterns/DashPattern";
import type { DashWidget } from "../_components/patterns/DashPattern";
import { LogPattern } from "../_components/patterns/LogPattern";
import type { LogLine } from "../_components/patterns/LogPattern";
import { SettingsPattern } from "../_components/patterns/SettingsPattern";
import type { SettingsSection } from "../_components/patterns/SettingsPattern";
import { ProjectPattern } from "../_components/patterns/ProjectPattern";
import type { ProjectMockData } from "../_data/patterns";

/**
 * /dashboard/[slug] — server component. requireMenu(slug) 가드 통과 후 패턴 렌더.
 * 잘못된 slug → notFound(). 권한 없는 사용자 → /dashboard redirect.
 */
export default async function DynamicDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = findSidebarMeta(slug);
  if (!meta) notFound();

  await requireMenu(slug);

  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  if (meta.pattern === "list") {
    const data = getPatternMockData(slug, "list") as { rows: ListRow[] };
    const variant = slug === "team" ? "team" : "default";
    return (
      <ListPattern title={meta.label} data={data} header={header} variant={variant} />
    );
  }
  if (meta.pattern === "dash") {
    const data = getPatternMockData(slug, "dash") as { widgets: DashWidget[] };
    return <DashPattern title={meta.label} data={data} header={header} />;
  }
  if (meta.pattern === "log") {
    const data = getPatternMockData(slug, "log") as { lines: LogLine[] };
    return (
      <div className="flex flex-col">
        {header}
        <LogPattern title={meta.label} data={data} />
      </div>
    );
  }
  if (meta.pattern === "project") {
    const data = getPatternMockData(slug, "project") as ProjectMockData;
    return <ProjectPattern title={meta.label} data={data} header={header} />;
  }
  const data = getPatternMockData(slug, "settings") as {
    sections: SettingsSection[];
  };
  return (
    <div className="flex flex-col">
      {header}
      <SettingsPattern title={meta.label} data={data} />
    </div>
  );
}
