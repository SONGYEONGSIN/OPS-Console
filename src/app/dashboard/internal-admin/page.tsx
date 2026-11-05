import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import { getSmsSenderData } from "@/features/sms-sender/queries";
import {
  GUBUN_ORDER,
  LIST_PAGE_SIZE,
  NUMBER_STATUS_ORDER,
  filterChecks,
  filterNumbers,
  filterSchools,
  firstParam,
  gubunCards,
  mySchoolNos,
  orderedOptions,
  pageSlice,
  parseCheckFilters,
  parseMine,
  parseNumberFilters,
  parseSchoolFilters,
  scopeBySchoolNo,
  scopeSchools,
} from "@/features/sms-sender/filters";
import type { SearchParams } from "@/features/sms-sender/filters";
import type { SmsSenderData } from "@/features/sms-sender/types";
import { MAIN_TABS, SUB_VIEWS, resolveView } from "./tabs";
import type { View } from "./tabs";
import { SourceError } from "./_components/SourceBar";
import type { ListContext } from "./_components/SmsListShell";
import { SchoolsTab } from "./_components/SchoolsTab";
import { NumbersTab } from "./_components/NumbersTab";
import { ChecksTab } from "./_components/ChecksTab";

/**
 * 프로젝트 > 내부관리자 — SMS 발신번호 사전등록 현황을 찾아보는 자리(읽기 전용).
 *
 * **탭이 두 줄이다.** 메인 탭은 내부관리자 업무(지금은 'SMS 발신번호 등록' 하나),
 * 그 아래 서브 탭이 학교 · 발신번호 · 확인 필요다. 주소는 `?tab=sms&view=<뷰>`
 * 이고, 탭이 하나이던 때의 `?tab=<뷰>` 도 같은 뷰로 푼다(`resolveView`) — 북마크와
 * 이미 보낸 링크가 있다. 탭 이름은 `tabs.ts` 한 곳에만 있다.
 *
 * **가드가 라우트 하나로 모인다.** `internal-admin` 은 `DESIGNATED_ONLY_MENU_SLUGS`
 * 에 있어 `canViewMenu` 가 'admin 이거나 지정된 운영자' 를 판정하고, `requireMenu`
 * 가 그 판정을 쓴다. 페이지가 `permission` 을 따로 보면 판정이 두 벌이 되어, 한쪽만
 * 바뀌는 날 메뉴는 숨었는데 주소로는 열리거나 그 반대가 된다.
 *
 * **내 대학이 기본이다**(다른 목록과 같이 `?mine` 없음 = 내 것). `_학교` 담당자 ==
 * 로그인 운영자 이름이고, 발신번호·확인 항목은 그 학교를 따라간다. 거르기는 서버에서
 * 하고, 인스펙터는 범위와 상관없이 전체 자료에서 찾는다.
 */
export default async function InternalAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const slug = "internal-admin";
  const me = await requireMenu(slug);
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
  const scope = parseMine(sp)
    ? mySchoolNos(data.schools, me.displayName)
    : null;

  return (
    <div className="flex flex-col">
      {header}
      {tabs}
      {renderView(view, data, sp, scope)}
    </div>
  );
}

function renderView(
  view: View,
  data: SmsSenderData,
  sp: SearchParams,
  scope: Set<number> | null,
) {
  const ctx: ListContext = {
    source: {
      fileName: data.workbook.name,
      fetchedAt: data.fetchedAt,
      criteria: data.criteria,
    },
    lookup: {
      schools: data.schools,
      numbers: data.numbers,
      checks: data.checks,
    },
  };

  if (view === "numbers") {
    const filters = parseNumberFilters(sp);
    const matched = filterNumbers(data.numbers, filters);
    const rows = scopeBySchoolNo(matched, scope);
    return (
      <NumbersTab
        rows={pageSlice(rows, filters.page, LIST_PAGE_SIZE)}
        total={rows.length}
        scopeTotal={matched.length}
        filters={filters}
        statusOptions={orderedOptions(
          data.numbers.map((n) => n.status),
          NUMBER_STATUS_ORDER,
        )}
        gubunOptions={orderedOptions(
          data.numbers.map((n) => n.gubun),
          GUBUN_ORDER,
        )}
        ctx={ctx}
      />
    );
  }
  if (view === "checks") {
    const filters = parseCheckFilters(sp);
    const matched = filterChecks(data.checks, filters);
    const rows = scopeBySchoolNo(matched, scope);
    return (
      <ChecksTab
        rows={pageSlice(rows, filters.page, LIST_PAGE_SIZE)}
        total={rows.length}
        scopeTotal={matched.length}
        filters={filters}
        kindOptions={orderedOptions(
          data.checks.map((c) => c.kind),
          [],
        )}
        ctx={ctx}
      />
    );
  }
  const filters = parseSchoolFilters(sp);
  const matched = filterSchools(data.schools, filters);
  const rows = scopeSchools(matched, scope);
  return (
    <SchoolsTab
      cards={gubunCards(scopeSchools(data.schools, scope))}
      schools={pageSlice(rows, filters.page, LIST_PAGE_SIZE)}
      total={rows.length}
      scopeTotal={matched.length}
      filters={filters}
      ctx={ctx}
    />
  );
}
