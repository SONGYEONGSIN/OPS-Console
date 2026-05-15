import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { ContractsControls } from "./ContractsControls";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listContracts } from "@/features/contracts/queries";
import {
  contractSheetEnum,
  type ContractRow,
} from "@/features/contracts/schemas";

const PAGE_SIZE = 30;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sheet?: string;
    page?: string;
    mine?: string;
    q?: string;
  }>;
}) {
  const slug = "contracts";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const me = await getCurrentOperator();

  // 시트 필터: 유효값(4년제 / 전문대 / 초중고 / 대학원 / 기타)만 통과
  const sheetResult = contractSheetEnum.safeParse(sp.sheet);
  const sheetFilter = sheetResult.success ? sheetResult.data : undefined;

  const { rows: allContracts } = await listContracts({
    sheet: sheetFilter,
  });

  // 검색 필터 — 대학명·넘버링 ilike (client-side, case-insensitive)
  const qRaw = (sp.q ?? "").trim();
  const qLower = qRaw.toLowerCase();
  const qFiltered = qRaw
    ? allContracts.filter(
        (r) =>
          r.name.toLowerCase().includes(qLower) ||
          r.numbering.toLowerCase().includes(qLower),
      )
    : allContracts;

  // 내 계약 필터 — operator(Excel 운영자 컬럼)가 me.displayName과 일치하는 row만
  const mineFilter = sp.mine === "true";
  const meName = me?.displayName;
  const filteredRows =
    mineFilter && meName
      ? qFiltered.filter((r) => r.operator === meName)
      : qFiltered;
  const total = filteredRows.length;

  // SharePoint은 전체 fetch가 비용 동일 — client-side slice 페이지네이션
  const page = Math.max(1, Number(sp.page) || 1);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(start, start + PAGE_SIZE);
  const rows: ListRow[] = pageRows.map(contractsRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <>
      <PageHeader
        key="page-header"
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <ContractsControls key="controls" />
    </>
  );

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="contracts"
      canCreate={false}
      readOnly={true}
      currentUserName={me?.displayName ?? me?.email ?? ""}
      inlineFilters={<ScopeChips total={total} mineLabel="내 계약" />}
      footer={<ListPagination total={total} pageSize={PAGE_SIZE} />}
    />
  );
}

function contractsRowToListRow(r: ContractRow): ListRow {
  return {
    id: r.id,
    name: r.name,
    status: "active",
    owner: r.operator || "-",
    contractSheet: r.sheet,
    numbering: r.numbering,
    contractStatus: r.status,
    serviceActive: r.serviceActive,
    feeAmount: r.feeAmount,
    contractRaw: r.raw,
  };
}
