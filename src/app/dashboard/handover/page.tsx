import Link from "next/link";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPagination } from "@/components/common/ListPagination";
import { HandoverTabs } from "./HandoverTabs";
import { HandoverControls } from "./HandoverControls";
import { requireMenu } from "@/features/auth/menu-guard";
import { listServicesWithHandover } from "@/features/handover/queries";
import type { HandoverStatus } from "@/features/handover/schemas";

const PAGE_SIZE = 30;

const STATUS_TONE: Record<HandoverStatus | "none", string> = {
  none: "bg-washi-raised text-muted",
  draft: "bg-vermilion/15 text-vermilion",
  ready: "bg-sage/15 text-sage",
  published: "bg-ink/10 text-ink",
};
const STATUS_LABEL: Record<HandoverStatus | "none", string> = {
  none: "미작성",
  draft: "작성중",
  ready: "작성완료",
  published: "인계완료",
};

type SearchParams = {
  q?: string;
  status?: string;
  page?: string;
  tab?: string;
};

export default async function HandoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "handover";
  await requireMenu(slug);

  const params = await searchParams;
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const tab = params.tab ?? "content";

  if (tab !== "content") {
    return (
      <div>
        <PageHeader
          pathname={pathname}
          meta={config.meta}
          headline={config.headline}
          description={config.description}
        />
        <HandoverTabs />
        <div className="p-7 text-sm text-muted">
          후속 PR-B에서 구현 예정 — 진행 워크플로우 / 이력 목록
        </div>
      </div>
    );
  }

  const page = Math.max(1, Number(params.page) || 1);
  const statusParam = params.status as
    | HandoverStatus
    | "none"
    | undefined;
  const { rows, total } = await listServicesWithHandover({
    q: params.q,
    status: statusParam,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <HandoverTabs />
      <HandoverControls />
      <section className="p-7">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-2">대학명 · 서비스</th>
                <th className="px-3 py-2">운영자</th>
                <th className="px-3 py-2">접수구분</th>
                <th className="px-3 py-2">작성상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-muted"
                  >
                    데이터 없음
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const key = (r.handover_status ?? "none") as
                    | HandoverStatus
                    | "none";
                  return (
                    <tr
                      key={r.service_id}
                      className="border-b border-line-soft hover:bg-washi-raised"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/handover/${r.service_id}`}
                          className="block"
                        >
                          <span className="font-medium text-ink">
                            {r.university_name}
                          </span>
                          <span className="ml-1 text-xs text-muted">
                            · {r.service_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-soft">
                        {r.operator_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-soft">
                        {r.application_type}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[key]}`}
                        >
                          {STATUS_LABEL[key]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ListPagination total={total} pageSize={PAGE_SIZE} />
      </section>
    </div>
  );
}
