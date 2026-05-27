import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { AssistantClient } from "./AssistantClient";

export default async function AiAssistantPage() {
  const slug = "ai-assistant";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <div className="px-7 pb-12">
        <AssistantClient />
      </div>
    </div>
  );
}
