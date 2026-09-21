import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import { listLedgerRows } from "@/features/assignments/ledger-queries";
import { listOperators } from "@/features/operators/queries";
import { buildWorkload } from "@/features/assignments/workload";
import {
  workloadWindows,
  pastCells,
  kstDay,
  unmatchedVolume,
} from "@/features/assignments/workload-sources";
import { findNewcomers } from "@/features/assignments/newcomers";
import { NewAssignmentPanel } from "./NewAssignmentPanel";
import {
  loadWorkloadSources,
  loadPastOperatorRows,
  FROZEN_IMPORT_LAST_YEAR,
} from "@/features/assignments/workload-queries";
import {
  listProposalBatches,
  listProposals,
} from "@/features/assignments/proposal/queries";
import { WorkloadTable } from "./WorkloadTable";
import { ProposalPanel } from "./ProposalPanel";

/**
 * 관리 > 업무배정 — **결정하는 화면을 결정하는 자리에 둔다**(설계 2026-09-21).
 *
 * 총괄장(`/dashboard/assignments`)은 *누가 무엇을 맡고 있는가* 를 전원이 보는
 * 자리다. 여기는 *누구에게 얼마나 줄 것인가* — 남의 업무량을 견주고 원장을
 * 바꾸는 일이라 admin 이다.
 *
 * **가드가 라우트 하나로 모인다.** 예전에는 전원 열람 메뉴 안에 admin 탭이 얹혀
 * 있어 페이지가 `permission === "admin"` 을 따로 판정했고, 그러면 `canViewMenu`
 * 와 두 벌이 되어 한쪽만 바뀌는 날 메뉴는 숨었는데 주소로는 열리거나 그 반대가
 * 된다. `work-assignment` 는 `ADMIN_ONLY_MENU_SLUGS` 에 있으므로
 * `requireMenu` 하나가 그 판정을 한다.
 */
/**
 * 탭 이름과 **순서**는 사용자가 정한 것이다(2026-09-21).
 *
 * `제안` 은 무엇을 제안하는지 말하지 않아 열기 전에는 알 수 없었고, `배분` 은 나누는
 * 행위인데 그 화면은 **나뉜 결과를 보는 자리**다. 그래서 `배정현황` · `3월배정` 이다.
 *
 * 순서는 일의 순서다 — 한 해 배정이 **3월에 통째로** 정해지고, 신규배정은 그 뒤에 들어온
 * 것만 다룬다. 현황을 보고 → 전체를 정하고 → 그 뒤 것을 붙인다.
 */
const TABS = [
  {
    key: "workload",
    label: "배정현황",
    href: "/dashboard/work-assignment?tab=workload",
  },
  {
    key: "proposals",
    label: "3월배정",
    href: "/dashboard/work-assignment?tab=proposals",
  },
  {
    key: "newcomers",
    label: "신규배정",
    href: "/dashboard/work-assignment?tab=newcomers",
  },
] as const;

/** 제안 탭이 한 화면에 그리는 배치 수. 연간 배치 하나가 300줄이라 전부 읽지 않는다. */
const PROPOSAL_BATCHES = 10;

export default async function WorkAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string }>;
}) {
  const slug = "work-assignment";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  const makeHeader = (count: number) => {
    const config = resolvePageMeta(slug, meta, count);
    return (
      <PageHeader
        key="work-assignment-header"
        pathname={`/dashboard/${slug}`}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    );
  };

  /**
   * 제안 탭 — **관리자가 마지막 승인을 하는 자리**(선행 설계 §9.3).
   *
   * 배치와 제안을 **페이지가 한 번에 읽어** 넘긴다. 패널이 배치마다 읽으면 화면 한
   * 장에 조회가 열 번 나고, 머리 건수와 목록이 다른 시점을 본다.
   *
   * 명부는 이름을 붙이는 데만 쓴다 — 표에 메일 주소가 그대로 서면 사람이 한 줄씩
   * 대조해야 한다. 상태로 좁히지 않는 이유는 퇴사자가 이전 담당자로 남아 있을 수
   * 있어서다(좁히면 그 칸이 주소로 돌아간다).
   */
  if (tab === "proposals") {
    const allBatches = await listProposalBatches();
    const batches = allBatches.slice(0, PROPOSAL_BATCHES);
    const [proposals, operators] = await Promise.all([
      listProposals(batches.map((b) => b.id)),
      listOperators(),
    ]);
    const names = Object.fromEntries(operators.map((o) => [o.email, o.name]));
    return (
      <>
        {makeHeader(batches.length)}
        <PageTabs active={tab} tabs={TABS} />
        <section className="p-7">
          <ProposalPanel
            batches={batches}
            proposals={proposals}
            names={names}
          />
        </section>
      </>
    );
  }

  /**
   * 신규배정 — **주인 없는 서비스에 네 가지를 답하는 자리**(사용자 요구).
   *
   * 원장과 물량 원천을 **배정현황과 같은 함수로** 읽는다. 여기서 따로 읽으면 같은
   * 화면의 두 탭이 다른 원장을 보고, 한쪽에서 미배정인 칸이 다른 쪽에서는 아니다.
   *
   * **부하는 줄마다 다시 잰다.** `workloadWindows` 에 서비스 시작일을 넘겨 그 주·그
   * 달의 창을 잡는다 — '지금 여유 있나' 를 보면 12월 서비스를 9월 부하로 판단한다.
   * 줄이 한 자리 수라 순수 함수를 줄마다 한 번 도는 비용은 없는 셈이다.
   *
   * 현재 학년도만 본다. 과거 학년도에는 배정할 것이 없고, 원장에 그 해 행도 없다.
   */
  if (tab === "newcomers") {
    const year = BAEJUNG_CURRENT_YEAR;
    const [ledger, allOperators, sources] = await Promise.all([
      listLedgerRows(year),
      listOperators(),
      loadWorkloadSources(year),
    ]);
    const operators = allOperators.filter((o) => o.status === "active");
    const newcomers = findNewcomers({
      ledger,
      spans: sources.spans,
      today: kstDay(new Date().toISOString()),
    });
    const rows = newcomers.map((r) => ({
      ...r,
      loadAtStart:
        r.start === null
          ? null
          : buildWorkload({
              operators,
              cells: ledger,
              serviceCounts: sources.serviceCounts,
              spans: sources.spans,
              windows: workloadWindows(new Date(`${r.start}T12:00:00+09:00`)),
            }),
    }));

    return (
      <>
        {makeHeader(rows.length)}
        <PageTabs active={tab} tabs={TABS} />
        <section className="p-7">
          <NewAssignmentPanel rows={rows} academicYear={year} />
        </section>
      </>
    );
  }

  /**
   * 배정현황 — **§6.1 의 근거를 사람이 검산하는 자리**(선행 설계 §9.4).
   *
   * 명부는 **활성 + 배정 대상**만 — 퇴사자가 0곳으로 끼면 그룹 평균이 아래로
   * 끌려가 남은 사람이 전부 과부하로 보인다(`assignable` 은 `buildWorkload` 가
   * 거른다).
   *
   * **학년도에 따라 두 칸이 동시에 바뀐다.** 건수만 바꾸고 담당자를 그대로 두면
   * 과거 연도에서 전원이 0곳이 된다 — 원장에는 그 해 행이 없기 때문이다.
   *
   * | 학년도 | 담당자 | 건수·구간 | 목표·편차 |
   * |---|---|---|---|
   * | 현재 | `assignments` 원장 | `closing_services` | 낸다 |
   * | 과거 | `services.operator_email` | `services` | **안 낸다** |
   */
  const now = new Date();
  const academicYear = parseYear(sp.year);
  const isPast = academicYear <= FROZEN_IMPORT_LAST_YEAR;

  const [cells, operators, sources] = await Promise.all([
    isPast
      ? loadPastOperatorRows(academicYear).then(pastCells)
      : listLedgerRows(academicYear),
    listOperators(),
    loadWorkloadSources(academicYear),
  ]);
  const groups = buildWorkload({
    operators: operators.filter((o) => o.status === "active"),
    cells,
    serviceCounts: sources.serviceCounts,
    spans: sources.spans,
    windows: workloadWindows(now),
    // 오늘의 연차 그룹을 작년에 씌우면 그때 존재한 적 없는 목표가 나온다.
    targets: !isPast,
  });
  const people = groups.reduce((n, g) => n + g.rows.length, 0);
  // 표에 안 들어간 건수 — 조용히 빼면 합만 보고 멀쩡하다고 읽는다.
  const unmatched = unmatchedVolume(sources.serviceCounts, cells);

  return (
    <>
      {makeHeader(people)}
      <PageTabs active={tab} tabs={TABS} />
      <section className="p-7">
        <WorkloadTable
          groups={groups}
          now={now}
          academicYear={academicYear}
          years={YEAR_OPTIONS}
          isPast={isPast}
          unmatched={unmatched}
        />
      </section>
    </>
  );
}

/**
 * `?tab=`. **모르는 값은 기본 탭으로** — 흐름이 모니터링이라 배정현황이 기본이다.
 *
 * 탭 이름을 여기서 다시 적지 않고 `TABS` 에서 찾는다. 두 벌이 되면 탭은 보이는데
 * 눌러도 기본 탭이 열리는, 아무도 원인을 못 찾는 화면이 된다.
 */
function parseTab(raw: string | undefined): (typeof TABS)[number]["key"] {
  const hit = TABS.find((t) => t.key === raw);
  return hit ? hit.key : "workload";
}

/**
 * 고를 수 있는 학년도. **원장이 있는 해(현재)와 서비스목록이 있는 해(과거)** 둘이다.
 *
 * 더 과거는 `services` 에 있긴 하지만(2025학년도 이전) 배정 대상 명부가 지금
 * 구성이라 견줄 기준이 없어 열지 않았다 — 필요해지면 여기 한 줄이다.
 */
const YEAR_OPTIONS = [BAEJUNG_CURRENT_YEAR, FROZEN_IMPORT_LAST_YEAR] as const;

/**
 * `?year=`. **모르는 값은 기본값으로 떨어뜨린다** — 파싱 실패가 빈 표가 되면
 * 사람이 '배정이 사라졌다' 로 읽는다.
 */
function parseYear(raw: string | undefined): number {
  const n = Number(raw);
  return YEAR_OPTIONS.includes(n as (typeof YEAR_OPTIONS)[number])
    ? n
    : BAEJUNG_CURRENT_YEAR;
}
