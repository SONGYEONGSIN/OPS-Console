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
  LIST_PAGE_SIZE,
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
import { MAIN_TABS, SUB_VIEWS, resolveView } from "./tabs";
import type { View } from "./tabs";
import { SourceBar, SourceError } from "./_components/SourceBar";
import { SchoolsTab } from "./_components/SchoolsTab";
import { NumbersTab } from "./_components/NumbersTab";
import { ChecksTab } from "./_components/ChecksTab";

/**
 * 프로젝트 > 내부관리자 — SMS 발신번호 사전등록 현황을 찾아보는 자리(읽기 전용).
 *
 * **탭이 두 줄이다.** 메인 탭은 내부관리자 업무(지금은 'SMS 발신번호 등록' 하나),
 * 그 아래 서브 탭이 개요 · 학교 · 발신번호 · 확인 필요다. 주소는
 * `?tab=sms&view=<뷰>` 이고, 탭이 하나이던 때의 `?tab=<뷰>` 도 같은 뷰로 푼다
 * (`resolveView`) — 북마크와 이미 보낸 링크가 있다. 탭 이름은 `tabs.ts` 한 곳에만 있다.
 *
 * **가드가 라우트 하나로 모인다.** `internal-admin` 은 `DESIGNATED_ONLY_MENU_SLUGS`
 * 에 있어 `canViewMenu` 가 'admin 이거나 지정된 운영자' 를 판정하고, `requireMenu`
 * 가 그 판정을 쓴다. 페이지가 `permission` 을 따로 보면 판정이 두 벌이 되어, 한쪽만
 * 바뀌는 날 메뉴는 숨었는데 주소로는 열리거나 그 반대가 된다.
 *
 * **개요 뷰는 Graph 를 읽지 않는다.** 아직 목업이라 현황 파일과 무관한데, 읽게 두면
 * 개요만 열어도 SharePoint 를 부르고 현황 파일이 깨진 날엔 개요까지 오류 화면이 된다.
 * 그래서 `SourceBar` 도 데이터 뷰 셋에만 선다.
 */
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
  const view = resolveView(firstParam(sp.tab), firstParam(sp.view));
  const main = MAIN_TABS[0].key;

  const config = resolvePageMeta(slug, meta);
  const header = (
    <PageHeader
      pathname={`/dashboard/${slug}`}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );
  const tabs = (
    <>
      <PageTabs active={main} tabs={MAIN_TABS} />
      <PageTabs active={view} size="sm" tabs={SUB_VIEWS} />
    </>
  );

  if (view === "overview") {
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
        criteria={data.criteria}
      />
      <section className="p-7">{renderView(view, data, sp)}</section>
    </div>
  );
}

type DataView = Exclude<View, "overview">;

function renderView(view: DataView, data: SmsSenderData, sp: SearchParams) {
  if (view === "numbers") {
    const filters = parseNumberFilters(sp);
    const rows = filterNumbers(data.numbers, filters);
    return (
      <NumbersTab
        rows={pageSlice(rows, filters.page, LIST_PAGE_SIZE)}
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
  if (view === "checks") {
    const kind = firstParam(sp.type);
    return (
      <ChecksTab
        rows={filterChecks(data.checks, { q: "", kind, page: 1 })}
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
