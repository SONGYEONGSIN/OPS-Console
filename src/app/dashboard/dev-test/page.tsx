import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listEntertestRuns,
  listTestableServices,
  getMyEntertestAccount,
} from "@/features/entertest/queries";
import type { EntertestRun } from "@/features/entertest/schemas";
import { DevTestControls } from "./DevTestControls";

const PAGE_SIZE = 30;

/** null 제거 + 중복 제거 + 정렬한 distinct 옵션. */
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

/**
 * /dashboard/dev-test — 표준 ListPattern + dev-test variant 인스펙터.
 * controlsRow: 테스트 계정 등록 + 검색/필터(searchParam). 행 클릭 → 인스펙터에서 테스트 실행/이력.
 */
export default async function DevTestPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    mine?: string;
    category?: string;
    region?: string;
    universityType?: string;
    admissionType?: string;
  }>;
}) {
  const slug = "dev-test";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const sp = await searchParams;
  const me = await getCurrentOperator();
  const [services, runs, myAccount] = await Promise.all([
    listTestableServices(),
    listEntertestRuns(200),
    me ? getMyEntertestAccount(me.email) : Promise.resolve(null),
  ]);

  // 필터 옵션은 전체 서비스 기준 distinct.
  const options = {
    categoryOptions: distinct(services.map((s) => s.category)),
    regionOptions: distinct(services.map((s) => s.region)),
    universityTypeOptions: distinct(services.map((s) => s.university_type)),
    admissionTypeOptions: distinct(services.map((s) => s.admission_type)),
  };

  // searchParam 서버 필터. mine 기본 true(내 대학) — operator_name === 본인.
  const mine = sp.mine !== "false";
  const myName = me?.displayName ?? null;
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = services.filter((s) => {
    if (mine && myName && s.operator_name !== myName) return false;
    if (sp.category && s.category !== sp.category) return false;
    if (sp.region && s.region !== sp.region) return false;
    if (sp.universityType && s.university_type !== sp.universityType)
      return false;
    if (sp.admissionType && s.admission_type !== sp.admissionType) return false;
    if (
      q &&
      !`${s.university_name} ${s.service_name}`.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const total = filtered.length;
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // service_id별 실행 이력 그룹핑.
  const runsByService = new Map<number, EntertestRun[]>();
  for (const r of runs) {
    if (r.service_id == null) continue;
    const arr = runsByService.get(r.service_id) ?? [];
    arr.push(r);
    runsByService.set(r.service_id, arr);
  }
  const rows: ListRow[] = paged.map((s) => ({
    id: String(s.service_id),
    name: s.service_name,
    status: "active",
    owner: s.operator_name ?? "",
    serviceIdNum: s.service_id,
    universityName: s.university_name,
    serviceName: s.service_name,
    category: s.category ?? "",
    region: s.region ?? "",
    universityType: s.university_type ?? "",
    applicationType: s.admission_type ?? "",
    operatorName: s.operator_name ?? "",
    entertestRuns: runsByService.get(s.service_id) ?? [],
    entertestAccount: myAccount,
  }));

  const config = resolvePageMeta(slug, meta, total);

  return (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <ListPattern
        title="개발 · 테스트"
        data={{ rows }}
        variant="dev-test"
        readOnly
        liveData
        controlsRow={<DevTestControls {...options} />}
        inlineFilters={
          <ScopeChips key="dev-test-scope" total={total} mineLabel="내 대학" />
        }
        footer={
          <ListPagination
            key="dev-test-pagination"
            total={total}
            pageSize={PAGE_SIZE}
          />
        }
      />
    </>
  );
}
