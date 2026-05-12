import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listInsightVideos } from "@/features/insight-videos/queries";
import { VideoGridSection } from "./_components/VideoGridSection";

export default async function AiInsightPage() {
  const slug = "ai-insight";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const videos = await listInsightVideos();

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  return (
    <>
      {header}
      <div className="p-5 lg:p-7">
        <VideoGridSection videos={videos} />
      </div>
    </>
  );
}
