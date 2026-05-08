"use client";

import { useParams, notFound } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { getPatternMockData } from "../_data/patterns";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
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
 * /dashboard/[slug] — slug → 사이드바 메타 lookup → 패턴 컴포넌트 렌더.
 *
 * 잘못된 slug는 notFound() → Next.js 404. 셸은 layout.tsx가 처리.
 * PageHeader는 PAGE_META 명시 정의 우선, 없으면 sidebar label로 fallback.
 */
export default function DynamicDashboardPage() {
  const params = useParams<{ slug: string }>();
  const meta = findSidebarMeta(params.slug);
  if (!meta) notFound();

  const pathname = `/dashboard/${params.slug}`;
  const config = PAGE_META[params.slug] ?? derivePageMeta(params.slug, meta);

  let body: React.ReactNode;
  if (meta.pattern === "list") {
    const data = getPatternMockData(params.slug, "list") as { rows: ListRow[] };
    body = <ListPattern title={meta.label} data={data} />;
  } else if (meta.pattern === "dash") {
    const data = getPatternMockData(params.slug, "dash") as { widgets: DashWidget[] };
    body = <DashPattern title={meta.label} data={data} />;
  } else if (meta.pattern === "log") {
    const data = getPatternMockData(params.slug, "log") as { lines: LogLine[] };
    body = <LogPattern title={meta.label} data={data} />;
  } else if (meta.pattern === "project") {
    const data = getPatternMockData(params.slug, "project") as ProjectMockData;
    body = <ProjectPattern title={meta.label} data={data} />;
  } else {
    const data = getPatternMockData(params.slug, "settings") as { sections: SettingsSection[] };
    body = <SettingsPattern title={meta.label} data={data} />;
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      {body}
    </div>
  );
}
