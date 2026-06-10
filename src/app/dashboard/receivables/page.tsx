import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { updateReceivablesCells } from "@/features/receivables/actions";
import type { CellUpdate } from "@/features/receivables/actions";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  receivablesToListRow,
  isReceivablesDataRow,
  matchesReceivablesQuery,
} from "./_row-mapper";
import { ReceivablesControls } from "./ReceivablesControls";
import { ReceivablesScopeChips } from "./ReceivablesScopeChips";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";

/**
 * /dashboard/receivables — SharePoint Excel 미수채권 (read-only 목록 + 인스펙터).
 *
 * - Microsoft Graph API로 Excel usedRange + display text fetch
 * - 헤더 자동 감지 (메타 행 분리)
 * - 핵심 컬럼만 ListPattern variant=receivables로 표시 (청구일자/거래처/내역/금액/입금여부)
 * - 행 클릭 → 인스펙터 ReceivablesView (전체 컬럼 표시)
 * - 수정은 후속 PR (read+write)
 */
export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; scope?: string }>;
}) {
  const slug = "receivables";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const { q, page: pageParam, scope: scopeParam } = await searchParams;
  const term = (q ?? "").trim();
  const me = await getCurrentOperator();
  const myName = me?.displayName ?? me?.email ?? "";
  const sheet = await fetchReceivablesSheet();
  const allRows: ListRow[] = sheet
    ? sheet.rows
        .map((_, i) => receivablesToListRow(sheet, i))
        .filter(isReceivablesDataRow)
        .filter((row) => matchesReceivablesQuery(row, term))
    : [];
  const config = resolvePageMeta(slug, meta, allRows.length);

  // 범위 칩 — 서버 측 필터 + 전체(검색 적용) 기준 카운트(페이지 한정 아님). 기본 '내 채권'.
  const counts = {
    all: allRows.length,
    mine: allRows.filter((r) => r.owner === myName).length,
    active: allRows.filter((r) => r.status === "active").length,
    approved: allRows.filter((r) => r.status === "approved").length,
  };
  const scope =
    scopeParam === "all" || scopeParam === "active" || scopeParam === "approved"
      ? scopeParam
      : "mine";
  const scopedRows =
    scope === "all"
      ? allRows
      : scope === "mine"
        ? allRows.filter((r) => r.owner === myName)
        : allRows.filter((r) => r.status === scope);
  const { rows, total } = paginateRows(scopedRows, pageParam);

  const canEdit = me?.permission !== "viewer" && me?.permission !== null;
  const mailDryRun = process.env.MAIL_DRY_RUN !== "false";

  async function onPersist(
    row: ListRow,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const cells = row.receivablesCells;
    if (!cells?.worksheetName || cells.sheetRowNumber === undefined) {
      return { ok: false, error: "워크시트 위치를 찾을 수 없습니다." };
    }
    const updates: CellUpdate[] = [];
    if (cells.remarksColIdx !== undefined) {
      updates.push({
        colIdx: cells.remarksColIdx,
        value: cells.remarks ?? "",
      });
    }
    if (cells.dueDateColIdx !== undefined) {
      updates.push({
        colIdx: cells.dueDateColIdx,
        value: cells.dueDate ?? "",
      });
    }
    if (cells.schoolOwnerColIdx !== undefined) {
      updates.push({
        colIdx: cells.schoolOwnerColIdx,
        value: cells.schoolOwner ?? "",
      });
    }
    if (updates.length === 0) {
      return { ok: false, error: "편집 가능한 셀이 없습니다." };
    }
    return await updateReceivablesCells(
      cells.worksheetName,
      cells.sheetRowNumber,
      updates,
    );
  }

  const header = (
    <PageHeader
      key="receivables-header"
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  if (!sheet) {
    return (
      <>
        {header}
        <section className="p-7">
          <div className="border border-dashed border-vermilion-deep bg-washi-raised p-8 text-center">
            <p className="text-sm font-medium text-vermilion-deep">
              SharePoint 데이터를 불러올 수 없습니다
            </p>
            <p className="mt-2 text-xs text-muted">
              환경변수 (AZURE_AD_* / SHAREPOINT_RECEIVABLES_*) 또는 Azure AD 앱
              권한을 확인하세요. 자세한 로그는 서버 콘솔.
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <ListPattern
        title={meta.label}
        data={{ rows }}
        header={header}
        variant="receivables"
        controlsRow={<ReceivablesControls key="receivables-controls" />}
        hideVariantFilters
        inlineFilters={
          <ReceivablesScopeChips key="receivables-scope" counts={counts} />
        }
        readOnly={!canEdit}
        onPersist={canEdit ? onPersist : undefined}
        currentUserName={myName}
        currentUserPermission={me?.permission ?? null}
        receivablesMailDryRun={mailDryRun}
        footer={
          <ListPagination
            key="receivables-pagination"
            total={total}
            pageSize={30}
          />
        }
      />
    </>
  );
}
