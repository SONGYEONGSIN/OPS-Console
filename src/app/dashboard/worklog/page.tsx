import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { WorklogControls } from "./WorklogControls";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listWorklog,
  mapWorklogToLogLine,
} from "@/features/worklog/queries";
import type { WorklogLevel } from "@/features/worklog/schemas";

const PAGE_SIZE = 50;

const LEVEL_COLOR: Record<"INFO" | "WARN" | "ERROR" | "DEBUG", string> = {
  INFO: "text-ink-soft",
  WARN: "text-gold",
  ERROR: "text-vermilion",
  DEBUG: "text-muted",
};

type SearchParams = {
  q?: string;
  level?: string;
  domain?: string;
  mine?: string;
  page?: string;
};

export default async function WorklogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "worklog";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const me = await getCurrentOperator();
  const mine = sp.mine === "true";
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total } = await listWorklog({
    q: sp.q,
    level: sp.level as WorklogLevel | undefined,
    domain: sp.domain,
    userEmail: mine ? me?.email : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const lines = rows.map(mapWorklogToLogLine);
  const config = resolvePageMeta(slug, meta, total);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <WorklogControls />
      <section className="p-7">
        <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-ink">업무 활동 로그</h2>
            <span className="text-muted" aria-hidden>·</span>
            <span className="text-sm text-vermilion">{rows.length}건</span>
          </div>
          <ScopeChips total={total} mineLabel="내 로그" />
        </header>
        <div className="overflow-y-auto border border-line bg-ink text-cream">
          <pre className="m-0 p-3 text-xs leading-[1.6]">
            {lines.length === 0 ? (
              <span className="text-muted">로그 결과가 없습니다.</span>
            ) : (
              lines.map((line, i) => (
                <div key={i} className="font-mono">
                  <span className="opacity-60">{line.ts}</span>{" "}
                  <span className={`font-semibold ${LEVEL_COLOR[line.level]}`}>
                    [{line.level}]
                  </span>{" "}
                  <span>{line.msg}</span>
                </div>
              ))
            )}
          </pre>
        </div>
        <ListPagination total={total} pageSize={PAGE_SIZE} />
      </section>
    </div>
  );
}
