import { findSidebarMeta } from "../_data";
import { getPatternMockData } from "../_data/patterns";
import type { ProjectMockData } from "../_data/patterns";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ProjectPattern } from "../_components/patterns/ProjectPattern";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import { getSmsSenderData } from "@/features/sms-sender/queries";
import {
  GUBUN_ORDER,
  NUMBER_STATUS_ORDER,
  NUMBERS_PAGE_SIZE,
  filterChecks,
  filterNumbers,
  filterSchools,
  firstParam,
  gubunCards,
  orderedOptions,
  pageSlice,
  parseNumberFilters,
  parseSchoolFilters,
  schoolDetail,
} from "@/features/sms-sender/filters";
import type { SearchParams } from "@/features/sms-sender/filters";
import type { SmsSenderData } from "@/features/sms-sender/types";
import { SourceBar, SourceError } from "./_components/SourceBar";
import { SchoolsTab } from "./_components/SchoolsTab";
import { NumbersTab } from "./_components/NumbersTab";
import { ChecksTab } from "./_components/ChecksTab";

/**
 * 프로젝트 > 내부관리자 — SMS 발신번호 사전등록 현황을 찾아보는 자리(읽기 전용).
 *
 * **가드가 라우트 하나로 모인다.** `internal-admin` 은 `DESIGNATED_ONLY_MENU_SLUGS`
 * 에 있어 `canViewMenu` 가 'admin 이거나 지정된 운영자' 를 판정하고, `requireMenu`
 * 가 그 판정을 쓴다. 페이지가 `permission` 을 따로 보면 판정이 두 벌이 되어, 한쪽만
 * 바뀌는 날 메뉴는 숨었는데 주소로는 열리거나 그 반대가 된다.
 *
 * **개요 탭은 Graph 를 읽지 않는다.** 아직 목업이라 현황 파일과 무관한데, 읽게 두면
 * 개요만 열어도 SharePoint 를 부르고 현황 파일이 깨진 날엔 개요까지 오류 화면이 된다.
 * 그래서 `SourceBar` 도 데이터 탭 셋에만 선다.
 */
const TABS = [
  {
    key: "overview",
    label: "개요",
    href: "/dashboard/internal-admin?tab=overview",
  },
  {
    key: "schools",
    label: "학교",
    href: "/dashboard/internal-admin?tab=schools",
  },
  {
    key: "numbers",
    label: "발신번호",
    href: "/dashboard/internal-admin?tab=numbers",
  },
  {
    key: "checks",
    label: "확인 필요",
    href: "/dashboard/internal-admin?tab=checks",
  },
] as const;

export default async function InternalAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "internal-admin";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const sp = await searchParams;
  const tab = parseTab(firstParam(sp.tab));

  const config = resolvePageMeta(slug, meta);
  const header = (
    <PageHeader
      pathname={`/dashboard/${slug}`}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );
  const tabs = <PageTabs active={tab} tabs={TABS} />;

  if (tab === "overview") {
    const data = getPatternMockData(slug, "project") as ProjectMockData;
    return (
      <ProjectPattern
        title={meta.label}
        data={data}
        header={
          <>
            {header}
            {tabs}
          </>
        }
      />
    );
  }

  const result = await getSmsSenderData();
  if (!result.ok) {
    return (
      <div className="flex flex-col">
        {header}
        {tabs}
        <SourceError message={result.message} />
      </div>
    );
  }
  const { data } = result;

  return (
    <div className="flex flex-col">
      {header}
      {tabs}
      <SourceBar
        fileName={data.workbook.name}
        fetchedAt={data.fetchedAt}
        offRuleFiles={data.offRuleFiles}
        unmatchedPdfs={data.unmatchedPdfs}
        criteria={data.criteria}
      />
      <section className="p-7">{renderTab(tab, data, sp)}</section>
    </div>
  );
}

type DataTab = Exclude<(typeof TABS)[number]["key"], "overview">;

function renderTab(tab: DataTab, data: SmsSenderData, sp: SearchParams) {
  if (tab === "numbers") {
    const filters = parseNumberFilters(sp);
    const rows = filterNumbers(data.numbers, filters);
    return (
      <NumbersTab
        rows={pageSlice(rows, filters.page, NUMBERS_PAGE_SIZE)}
        total={rows.length}
        filters={filters}
        statusOptions={orderedOptions(
          data.numbers.map((n) => n.status),
          NUMBER_STATUS_ORDER,
        )}
        gubunOptions={orderedOptions(
          data.numbers.map((n) => n.gubun),
          GUBUN_ORDER,
        )}
      />
    );
  }
  if (tab === "checks") {
    const kind = firstParam(sp.type);
    return (
      <ChecksTab
        rows={filterChecks(data.checks, kind)}
        total={data.checks.length}
        kind={kind}
        kindOptions={orderedOptions(
          data.checks.map((c) => c.kind),
          [],
        )}
      />
    );
  }
  const filters = parseSchoolFilters(sp);
  return (
    <SchoolsTab
      cards={gubunCards(data.schools)}
      schools={filterSchools(data.schools, filters)}
      filters={filters}
      detail={schoolDetail(data, filters.school)}
    />
  );
}

/**
 * `?tab=`. **모르는 값은 기본 탭으로** — 찾아보는 일의 시작이 학교라 학교가 기본이다.
 *
 * 탭 이름을 여기서 다시 적지 않고 `TABS` 에서 찾는다. 두 벌이 되면 탭은 보이는데
 * 눌러도 기본 탭이 열린다.
 */
function parseTab(raw: string): (typeof TABS)[number]["key"] {
  const hit = TABS.find((t) => t.key === raw);
  return hit ? hit.key : "schools";
}
