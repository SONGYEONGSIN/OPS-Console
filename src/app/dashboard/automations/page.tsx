import { redirect } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getAutomationStatuses } from "@/features/automations/queries";
import { AutomationHub } from "./_components/AutomationHub";

export default async function AutomationsPage() {
  const slug = "automations";
  const me = await requireMenu(slug);

  // 자동화 실행은 admin 전용 — admin 외는 /dashboard로 fallback
  if (me.permission !== "admin") {
    redirect("/dashboard");
  }

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const statuses = await getAutomationStatuses();
  const config = resolvePageMeta(slug, meta, statuses.length);

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
        <AutomationHub statuses={statuses} />
      </div>
    </>
  );
}
