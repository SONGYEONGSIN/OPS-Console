import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { AssistantClient } from "./AssistantClient";

export default async function AiAssistantPage() {
  const slug = "ai-assistant";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta, 0);

  const me = await getCurrentOperator();
  const userName = me?.displayName ?? me?.email?.split("@")[0] ?? "운영자";

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <section className="p-7">
        <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-ink">어시스턴트</h2>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-sm text-vermilion">사내 데이터 자연어 검색</span>
          </div>
        </header>
        <AssistantClient userName={userName} />
      </section>
    </div>
  );
}
