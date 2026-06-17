import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getAutomationStatuses } from "@/features/automations/queries";
import { AutomationHub } from "./_components/AutomationHub";

export default async function AutomationsPage() {
  const slug = "automations";
  const me = await requireMenu(slug);
  // 페이지는 전원 열람 가능. 실제 실행/토글/로그조회는 admin만 — 비-admin은
  // 클라이언트에서 알럿(서버 액션도 requireAdmin으로 이중 차단).
  const isAdmin = me.permission === "admin";

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
      <section className="p-7">
        <header className="mb-4 flex items-baseline gap-2">
          <h2 className="text-xl font-bold text-ink">자동화 실행</h2>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion">{statuses.length}건</span>
        </header>
        <AutomationHub statuses={statuses} isAdmin={isAdmin} />
      </section>
    </>
  );
}
