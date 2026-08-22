import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listClosing,
  listClosingCategories,
  listClosingUniversityTypes,
  listClosingMonths,
} from "@/features/closing/queries";
import { closingRowToListRow } from "./_row-mapper";
import { ClosingStatusChips } from "./_StatusChips";
import { resolveScopeFilter, type ClosingScope } from "@/features/closing/scope";
import { ClosingControls } from "./ClosingControls";

/**
 * /dashboard/closing — 서비스 마감 (Moa 스크래핑 적재, 읽기 전용).
 * services variant 재사용. 표준 toolbar: 검색·카테고리 셀렉트(controlsRow) + 마감여부 칩(inlineFilters).
 * 필터는 서버(listClosing)에서 적용 — search(q)·category·마감여부(status)·내 마감(operator_name).
 */
export async function ClosingScreen({
  slug,
  scope,
  searchParams,
}: {
  /** 어느 메뉴로 열렸나. 헤더·경로에 쓴다. */
  slug: string;
  /** 이 메뉴가 맡은 범위. 칩이 못 바꾼다. */
  scope: ClosingScope;
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    category?: string;
    universityType?: string;
    month?: string;
  }>;
}) {
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const me = await getCurrentOperator();

  // 마감여부는 메뉴가 정한다 — 칩은 '전체/내 것'만 고른다(scope.ts).
  const { phase, operatorName } = resolveScopeFilter(
    scope,
    sp.status ?? "mine",
    me?.displayName,
  );

  // 칩 카운트 — scope(status/mine) 무시, 검색·카테고리 등 다른 필터는 적용. count-only(pageSize:1).
  const countFilter = {
    search: sp.q,
    category: sp.category,
    universityType: sp.universityType,
    month: sp.month,
  } as const;

  const [
    { rows: closing, total },
    categories,
    universityTypes,
    months,
    allCount,
    mineCount,
  ] = await Promise.all([
    listClosing({
      page: sp.page ? Number(sp.page) : 1,
      pageSize: 30,
      search: sp.q,
      category: sp.category,
      universityType: sp.universityType,
      month: sp.month,
      phase,
      operatorName,
    }),
    listClosingCategories(),
    listClosingUniversityTypes(),
    listClosingMonths(),
    // 카운트도 이 메뉴 범위 안에서 센다 — '전체 867'처럼 범위 밖 숫자가 뜨면
    // 눌렀을 때 그만큼 안 나와 화면이 거짓말한다.
    listClosing({ ...countFilter, phase, pageSize: 1 }).then(
      (r) => r.total,
    ),
    listClosing({
      ...countFilter,
      phase,
      operatorName: me?.displayName ?? "",
      pageSize: 1,
    }).then((r) => r.total),
  ]);
  const counts = { all: allCount, mine: mineCount };
  const rows: ListRow[] = closing.map(closingRowToListRow);
  const config = resolvePageMeta(slug, meta, total);

  const header = (
    <div key={`${slug}-header`}>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="services"
      canCreate={false}
      readOnly
      liveData
      controlsRow={
        <ClosingControls
          key={`${slug}-controls`}
          categories={categories}
          universityTypes={universityTypes}
          months={months}
        />
      }
      inlineFilters={<ClosingStatusChips key={`${slug}-scope`} counts={counts} scope={scope} />}
      footer={
        <ListPagination key={`${slug}-pagination`} total={total} pageSize={30} />
      }
    />
  );
}
