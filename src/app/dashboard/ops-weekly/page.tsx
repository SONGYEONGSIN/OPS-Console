import Link from "next/link";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import { OPS_WEEKLY_SLUG } from "@/features/ops-weekly/constants";
import { dutyNameOf } from "@/features/ops-weekly/overview";
import { shiftWeek, type WeekRef } from "@/features/ops-weekly/week";
import { PageHeader } from "../_components/page-header/PageHeader";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { ReportView } from "./_components/ReportView";
import { ManageTab } from "./_components/ManageTab";
import { StatusTab } from "./_components/StatusTab";
import { PendingSavesProvider } from "./_components/pending-saves";
import { ProjectDrawerProvider } from "./_components/project-drawer-context";
import { WeekHeader } from "./_components/WeekHeader";
import { StickyKpiBar } from "./_components/StickyKpiBar";
import { WeeklyKpiRow } from "./_components/WeeklyKpiRow";
import { bodyKeyOf } from "./_body-key";
import { appSubStateOf } from "./_groups";
import { headerWeekOf } from "./_header-week";
import { loadOpsWeeklyPage, type OpsWeeklyWeekView } from "./_load";
import {
  AREA_TAB_LABEL,
  buildRoleTabs,
  opsWeeklyHref,
  roleTabOf,
  type OpsTab,
} from "./_params";

const EMPTY_ROSTER =
  "작성 대상 명단이 비어 있습니다 — 관리자 설정을 확인하세요";
const NO_ACCESS = "이 주에 볼 수 있는 화면이 없습니다";
const NO_ACCESS_GUIDE =
  "주간업무보고는 작성 대상과 그 주 당번·관리자가 봅니다. 받는 사람은 보고가 끝난 주를 볼 수 있습니다.";
const BOX_CLASS =
  "flex flex-col gap-1 border border-line-soft bg-situation-bg px-4 py-6 text-sm text-ink";
const TAB_TITLE: Record<OpsTab, string> = {
  application: "원서접수",
  pims: AREA_TAB_LABEL.pims,
  project: "프로젝트",
  tf: "TF",
  leave: "휴가·외근",
  status: "제출 현황",
  settings: "관리",
};

type Week = OpsWeeklyWeekView;

/** 구분(개발/테스트)이 안 된 건수 — 뺀 건은 세지 않는다. */
function unknownCountOf(v: Week): number {
  const list = v.snapshot?.application.unknown ?? [];
  const overrides = v.detail?.overrides;
  return list.filter((i) => !overrides?.get(i.key)?.excluded).length;
}

/** 남의 보고서를 보는 중이면 그 사람 이메일, 본인 보고서(또는 보고서 없음)면 null. */
function otherOpOf(view: Week): string | null {
  const { viewed, actor } = view;
  return viewed !== null && viewed.email !== actor.email ? viewed.email : null;
}

function WeekBody({ view }: { view: Week }) {
  const { tab, viewed } = view;
  const { snapshot, detail, report } = view;
  if (
    tab === "status" &&
    view.reports !== null &&
    view.projectGroups !== null &&
    view.finalize !== null
  ) {
    // 입력 중이던 요약·사유가 다른 주·보고서로 넘어가지 않게 같은 키 규칙을 쓴다.
    const key = bodyKeyOf({
      reportId: report?.id ?? null,
      weekStart: view.week.week_start,
      op: viewed?.email ?? "",
      tab,
    });
    return (
      <StatusTab
        key={key}
        week={view.week}
        actor={view.actor}
        writers={view.writers}
        reports={view.reports}
        projectGroups={view.projectGroups}
        finalize={view.finalize}
        submittedCount={view.submittedCount}
      />
    );
  }
  if (tab === "settings" && view.bundle !== null && view.overview !== null) {
    const key = bodyKeyOf({
      reportId: report?.id ?? null,
      weekStart: view.week.week_start,
      op: viewed?.email ?? "",
      tab,
    });
    return (
      <ManageTab
        key={key}
        bundle={view.bundle}
        unmatched={view.unmatched}
        overview={view.overview}
        actor={view.actor}
        week={{
          id: view.week.id,
          status: view.week.status,
          duty_email: view.week.duty_email,
        }}
        weekLabel={`${view.weekRef.label} · ${view.weekRef.rangeLabel}`}
      />
    );
  }
  if (snapshot !== null && detail !== null) {
    if (roleTabOf(tab) === "report") {
      // 영역·서랍이 바뀌어도 다시 마운트하지 않게 key 에 영역을 넣지 않는다.
      const reportKey = bodyKeyOf({
        reportId: report?.id ?? null,
        weekStart: view.week.week_start,
        op: viewed?.email ?? "",
        tab: "report",
      });
      return (
        <ReportView
          key={reportKey}
          view={view}
          snapshot={snapshot}
          detail={detail}
          op={otherOpOf(view)}
        />
      );
    }
  }
  return (
    <section
      data-tab={tab}
      aria-label={TAB_TITLE[tab]}
      className="p-5 text-sm text-muted lg:p-7"
    >
      {TAB_TITLE[tab]}
    </section>
  );
}

function WeekView({ view }: { view: Week }) {
  const { week, weekRef, tab, viewed, report } = view;
  const op = otherOpOf(view);
  const weekStart = week.week_start;
  const { kpis } = view;
  const showKpi = viewed !== null && kpis !== null;
  // 작성자 선택 상자는 남의 보고서를 열 수 있는 사람에게만 — 일반 운영자에게는 명단을 내리지 않는다.
  const writerPicker =
    view.statusAccess !== null && view.writers.length > 0
      ? {
          writers: view.writers.map((w) => ({ email: w.email, name: w.name })),
          viewedEmail: viewed?.email ?? null,
        }
      : null;
  return (
    <PendingSavesProvider key={report?.id ?? week.id}>
      {view.roles.length > 1 ? (
        <PageTabs
          active={
            roleTabOf(tab) === "report" && op !== null
              ? "status"
              : roleTabOf(tab)
          }
          size="md"
          className="px-5 pt-4 lg:px-7"
          tabs={buildRoleTabs({ weekStart, roles: view.roles })}
        />
      ) : null}
      <WeekHeader
        weekRef={weekRef}
        week={headerWeekOf(week)}
        submittedCount={view.submittedCount}
        writerCount={view.writers.length}
        dutyName={dutyNameOf(week.duty_email, view.writers)}
        showReportState={roleTabOf(tab) === "report"}
        checkedCount={new Set(report?.checked_tabs ?? []).size}
        writerPicker={writerPicker}
        reportStatus={report?.status ?? null}
        submittedAt={report?.submitted_at ?? null}
        returnReason={report?.return_reason ?? null}
        prevOpen={view.prevOpen}
        prevHref={opsWeeklyHref(shiftWeek(weekStart, -1), tab, op)}
        nextHref={opsWeeklyHref(shiftWeek(weekStart, 1), tab, op)}
        viewingOther={
          roleTabOf(tab) === "report" && op !== null && viewed !== null
            ? {
                name: viewed.name,
                backHref: opsWeeklyHref(weekStart, "status", null),
              }
            : null
        }
      />
      {/* KPI 줄이 [쓰기]로 연 서랍을 닫으려면 서랍과 같은 Provider 아래여야 한다(DOM 이 없어 sticky 에 영향 없다). */}
      <ProjectDrawerProvider>
      {showKpi ? (
        <StickyKpiBar>
          <WeeklyKpiRow
            kpis={kpis}
            ownerName={viewed.name}
            unknownCount={unknownCountOf(view)}
            weekStart={weekStart}
            op={op}
            appSubState={appSubStateOf(view.snapshot?.application)}
          />
        </StickyKpiBar>
      ) : null}
      <WeekBody view={view} />
      </ProjectDrawerProvider>
    </PendingSavesProvider>
  );
}

/** 이 주에 볼 화면이 없는 사람 — 명단이 비었으면 그 사실을, 아니면 누가 보는지를 알린다. */
function NoAccess({
  weekStart,
  weekRef,
  emptyRoster,
}: {
  weekStart: string;
  weekRef: WeekRef;
  emptyRoster: boolean;
}) {
  return (
    <div className="p-5 lg:p-7">
      <div className={BOX_CLASS}>
        <p className="text-base font-bold tabular-nums">{`${weekRef.label} · ${weekRef.rangeLabel}`}</p>
        <p>{emptyRoster ? EMPTY_ROSTER : NO_ACCESS}</p>
        {emptyRoster ? null : (
          <p className="text-xs text-muted">{NO_ACCESS_GUIDE}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={opsWeeklyHref(shiftWeek(weekStart, -1), "status", null)}
            className="underline"
          >
            ‹ 이전 주
          </Link>
          <Link
            href={opsWeeklyHref(shiftWeek(weekStart, 1), "status", null)}
            className="underline"
          >
            다음 주 ›
          </Link>
          <Link href="/dashboard/ops-weekly" className="underline">
            이번 주로
          </Link>
        </div>
      </div>
    </div>
  );
}

function NoWeek({ weekStart }: { weekStart: string }) {
  return (
    <div className="p-5 lg:p-7">
      <div className={BOX_CLASS}>
        <p>이 주의 보고서가 아직 열리지 않았습니다</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={opsWeeklyHref(shiftWeek(weekStart, -1), "application", null)}
            className="underline"
          >
            ‹ 이전 주
          </Link>
          <Link href="/dashboard/ops-weekly" className="underline">
            이번 주로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function OpsWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; tab?: string; op?: string }>;
}) {
  const me = await requireMenu(OPS_WEEKLY_SLUG);
  const meta = findSidebarMeta(OPS_WEEKLY_SLUG);
  if (!meta) return null;
  const sp = await searchParams;
  const view = await loadOpsWeeklyPage(me, sp, new Date());
  const config = resolvePageMeta(OPS_WEEKLY_SLUG, meta);
  return (
    <>
      <PageHeader
        pathname={`/dashboard/${OPS_WEEKLY_SLUG}`}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      {view.kind === "no-week" ? (
        <NoWeek weekStart={view.weekStart} />
      ) : view.kind === "no-access" ? (
        <NoAccess
          weekStart={view.week.week_start}
          weekRef={view.weekRef}
          emptyRoster={view.emptyRoster}
        />
      ) : (
        <WeekView view={view} />
      )}
    </>
  );
}
