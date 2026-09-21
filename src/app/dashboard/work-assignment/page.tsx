import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import { listLedgerRows } from "@/features/assignments/ledger-queries";
import { listOperators } from "@/features/operators/queries";
import { buildWorkload } from "@/features/assignments/workload";
import { workloadWindows } from "@/features/assignments/workload-sources";
import { loadWorkloadSources } from "@/features/assignments/workload-queries";
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
const TABS = [
  {
    key: "workload",
    label: "배분현황",
    href: "/dashboard/work-assignment?tab=workload",
  },
  {
    key: "proposals",
    label: "제안",
    href: "/dashboard/work-assignment?tab=proposals",
  },
] as const;

/** 제안 탭이 한 화면에 그리는 배치 수. 연간 배치 하나가 300줄이라 전부 읽지 않는다. */
const PROPOSAL_BATCHES = 10;

export default async function WorkAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const slug = "work-assignment";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const sp = await searchParams;
  const tab = sp.tab === "proposals" ? "proposals" : "workload";

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
   * 배분현황 — **§6.1 의 근거를 사람이 검산하는 자리**(선행 설계 §9.4).
   *
   * 원장은 대학배정 탭과 같은 학년도를 본다. 명부는 **활성 + 배정 대상**만 —
   * 퇴사자가 0곳으로 끼면 그룹 평균이 아래로 끌려가 남은 사람이 전부 과부하로
   * 보인다(`assignable` 은 `buildWorkload` 가 거른다).
   */
  const now = new Date();
  const [ledger, operators, sources] = await Promise.all([
    listLedgerRows(BAEJUNG_CURRENT_YEAR),
    listOperators(),
    loadWorkloadSources(now),
  ]);
  const groups = buildWorkload({
    operators: operators.filter((o) => o.status === "active"),
    cells: ledger,
    serviceCounts: sources.serviceCounts,
    spans: sources.spans,
    windows: workloadWindows(now),
  });
  const people = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <>
      {makeHeader(people)}
      <PageTabs active={tab} tabs={TABS} />
      <section className="p-7">
        <WorkloadTable groups={groups} now={now} />
      </section>
    </>
  );
}
