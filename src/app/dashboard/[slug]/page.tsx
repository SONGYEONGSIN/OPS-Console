"use client";

import { useParams, notFound } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { getPatternMockData } from "../_data/patterns";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { DashPattern } from "../_components/patterns/DashPattern";
import type { DashWidget } from "../_components/patterns/DashPattern";
import { LogPattern } from "../_components/patterns/LogPattern";
import type { LogLine } from "../_components/patterns/LogPattern";
import { SettingsPattern } from "../_components/patterns/SettingsPattern";
import type { SettingsSection } from "../_components/patterns/SettingsPattern";

/**
 * /dashboard/[slug] — slug → 사이드바 메타 lookup → 패턴 컴포넌트 렌더.
 *
 * 잘못된 slug는 notFound() → Next.js 404. 셸은 layout.tsx가 처리.
 */
export default function DynamicDashboardPage() {
  const params = useParams<{ slug: string }>();
  const meta = findSidebarMeta(params.slug);
  if (!meta) notFound();

  if (meta.pattern === "list") {
    const data = getPatternMockData(params.slug, "list") as { rows: ListRow[] };
    return <ListPattern title={meta.label} data={data} />;
  }
  if (meta.pattern === "dash") {
    const data = getPatternMockData(params.slug, "dash") as { widgets: DashWidget[] };
    return <DashPattern title={meta.label} data={data} />;
  }
  if (meta.pattern === "log") {
    const data = getPatternMockData(params.slug, "log") as { lines: LogLine[] };
    return <LogPattern title={meta.label} data={data} />;
  }
  const data = getPatternMockData(params.slug, "settings") as { sections: SettingsSection[] };
  return <SettingsPattern title={meta.label} data={data} />;
}
