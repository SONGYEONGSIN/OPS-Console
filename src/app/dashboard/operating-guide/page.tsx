import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { OPERATING_GUIDE_TABS, findTabByValue } from "./_data/tabs";
import { OpsGuideNav } from "./_components/OpsGuideNav";
import { OpsGuidePanel } from "./_components/OpsGuidePanel";

export default async function OperatingGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const slug = "operating-guide";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const requestedTab = sp.tab?.trim() ?? "";
  const activeTab =
    findTabByValue(requestedTab) ?? OPERATING_GUIDE_TABS[0];

  const config = resolvePageMeta(slug, meta);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4">
          <h2 className="text-xl font-bold text-ink">{meta.label}</h2>
        </header>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
          <OpsGuideNav tabs={OPERATING_GUIDE_TABS} />
          <OpsGuidePanel tab={activeTab} />
        </div>
      </section>
    </div>
  );
}
