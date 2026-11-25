import Link from "next/link";
import { computeKpisV2, stageBreakdowns } from "@/features/ops-weekly/merge";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  OPS_WEEKLY_PATH,
  OPS_WEEKLY_SLUG,
  OPS_WEEKLY_V2_PATH,
  OPS_WEEKLY_V2_SLUG,
} from "@/features/ops-weekly/constants";
import { dutyNameOf } from "@/features/ops-weekly/overview";
import { shiftWeek, weekOf, type WeekRef } from "@/features/ops-weekly/week";
import { PageHeader } from "../_components/page-header/PageHeader";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { ReportView } from "./_components/ReportView";
import { ManageTab } from "./_components/ManageTab";
import { StatusTab } from "./_components/StatusTab";
import { PendingSavesProvider } from "./_components/pending-saves";
import { WeekHeader } from "./_components/WeekHeader";
import { WeekHeaderV2 } from "./_components/WeekHeaderV2";
import { OpsPathProvider } from "./_components/ops-path";
import { StickyKpiBar } from "./_components/StickyKpiBar";
import { WeeklyKpiRow } from "./_components/WeeklyKpiRow";
import { WeeklyKpiRowV2 } from "./_components/WeeklyKpiRowV2";
import { bodyKeyOf } from "./_body-key";
import { appSubStateOf } from "./_groups";
import { headerWeekOf } from "./_header-week";
import { loadOpsWeeklyPage, type OpsWeeklyWeekView } from "./_load";
import {
  ALL_OP,
  MINE_OP,
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
  submit: "제출",
  status: "제출 현황",
  settings: "관리",
};

type Week = OpsWeeklyWeekView;

/**
 * 화면 판 — `v1` 은 기존 주간업무보고, `v2` 는 새 화면 메뉴(관리자 전용, 운영리포트형 머리·카드 8장).
 * 데이터·권한·본문은 같고 머리와 카드만 다르다. 링크가 자기 메뉴에 머물도록 주소를 판마다 갖는다.
 */
export type OpsWeeklyVariant = "v1" | "v2";
const VARIANT: Record<OpsWeeklyVariant, { slug: string; path: string }> = {
  v1: { slug: OPS_WEEKLY_SLUG, path: OPS_WEEKLY_PATH },
  v2: { slug: OPS_WEEKLY_V2_SLUG, path: OPS_WEEKLY_V2_PATH },
};

/** 구분(개발/테스트)이 안 된 건수 — 뺀 건은 세지 않는다. */
function unknownCountOf(v: Week): number {
  const list = v.snapshot?.application.unknown ?? [];
  const overrides = v.detail?.overrides;
  return list.filter((i) => !overrides?.get(i.key)?.excluded).length;
}

/**
 * 남의 보고서를 보는 중이면 그 사람 이메일, 전체 보고면 `all`, 본인 보고서(또는 보고서 없음)면 null.
 * 관리자·당번은 op 가 없으면 전체 보고로 열리므로 본인 보고서를 `me` 로 적는다.
 */
function otherOpOf(view: Week): string | null {
  if (view.all !== null) return ALL_OP;
  const { viewed, actor } = view;
  if (viewed !== null && viewed.email !== actor.email) return viewed.email;
  return viewed !== null && view.allByDefault ? MINE_OP : null;
}

function WeekBody({ view, path }: { view: Week; path: string }) {
  const { tab, viewed } = view;
  const { snapshot, detail, report } = view;
  if (
    tab === "status" &&
    view.reports !== null &&
    view.projectGroups !== null &&
    view.finalize !== null &&
    view.recipientCount !== null
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
        recipientCount={view.recipientCount}
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
          path={path}
          viewingOther={
            viewed !== null && viewed.email !== view.actor.email
              ? {
                  name: viewed.name,
                  backHref: opsWeeklyHref(
                    view.week.week_start,
                    "status",
                    null,
                    null,
                    path,
                  ),
                }
              : null
          }
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

function WeekView({
  view,
  variant,
}: {
  view: Week;
  variant: OpsWeeklyVariant;
}) {
  const { path } = VARIANT[variant];
  const { week, weekRef, tab, viewed, report } = view;
  const op = otherOpOf(view);
  const weekStart = week.week_start;
  const { kpis } = view;
  const showKpi = (viewed !== null || view.all !== null) && kpis !== null;
  // 내 보고 | 전체 보고 — 작성자 전원과 남의 보고서를 열 수 있는 사람(전체 보고를 볼 수 있는 사람)에게만.
  const isWriter = view.roles.includes("report");
  const scope =
    isWriter || view.statusAccess !== null
      ? {
          mine: isWriter,
          mineOp: view.allByDefault ? MINE_OP : null,
          active:
            view.all !== null
              ? ("all" as const)
              : roleTabOf(tab) === "report" && (op === null || op === MINE_OP)
                ? ("mine" as const)
                : null,
        }
      : null;
  // 머리 공통 값 — v2 는 주 이동이 [이번 주][다음 주] 둘뿐이고(달력의 이번 주, KST) v1 은 ‹ › 다.
  const thisWeek = weekOf(new Date()).weekStart;
  const headerProps = {
    weekRef: weekRef,
    week: headerWeekOf(week),
    submittedCount: view.submittedCount,
    writerCount: view.writers.length,
    dutyName: dutyNameOf(week.duty_email, view.writers),
    showReportState: roleTabOf(tab) === "report",
    scope: scope,
    reportStatus: report?.status ?? null,
    submittedAt: report?.submitted_at ?? null,
    returnReason: report?.return_reason ?? null,
    prevOpen: view.prevOpen,
    prevHref: opsWeeklyHref(shiftWeek(weekStart, -1), tab, op, null, path),
  };
  return (
    <OpsPathProvider path={path}>
      <PendingSavesProvider key={report?.id ?? week.id}>
        {/* 새 화면 메뉴는 역할 탭 줄을 뺐다(2026-11-25 사용자 지시) — 제출 현황·관리는 기존 메뉴에서 연다. */}
        {variant === "v1" && view.roles.length > 1 ? (
          <PageTabs
            active={
              roleTabOf(tab) !== "report"
                ? roleTabOf(tab)
                : op === null || op === MINE_OP || (op === ALL_OP && isWriter)
                  ? "report"
                  : "status"
            }
            size="md"
            className="px-5 pt-4 lg:px-7"
            tabs={buildRoleTabs({ weekStart, roles: view.roles, path })}
          />
        ) : null}
        {variant === "v2" ? (
          <WeekHeaderV2
            weekRef={weekRef}
            showReportState={headerProps.showReportState}
            scope={scope && { ...scope, weekStart }}
            thisWeekHref={opsWeeklyHref(thisWeek, tab, op, null, path)}
            nextWeekHref={opsWeeklyHref(
              shiftWeek(thisWeek, 1),
              tab,
              op,
              null,
              path,
            )}
            current={
              weekStart === thisWeek
                ? "this"
                : weekStart === shiftWeek(thisWeek, 1)
                  ? "next"
                  : null
            }
          />
        ) : (
          <WeekHeader
            {...headerProps}
            nextHref={opsWeeklyHref(shiftWeek(weekStart, 1), tab, op)}
          />
        )}
        {showKpi && variant === "v1" ? (
          <StickyKpiBar>
            <WeeklyKpiRow
              kpis={kpis}
              ownerName={
                view.all !== null ? "작성자 전원" : (viewed?.name ?? "")
              }
              unknownCount={unknownCountOf(view)}
              weekStart={weekStart}
              op={op}
              appSubState={appSubStateOf(view.snapshot?.application)}
              breakdowns={
                view.snapshot !== null && view.detail !== null
                  ? stageBreakdowns(
                      view.snapshot,
                      view.detail.overrides,
                      view.detail.manual,
                    )
                  : undefined
              }
            />
          </StickyKpiBar>
        ) : null}
        {showKpi &&
        variant === "v2" &&
        view.snapshot !== null &&
        view.detail !== null ? (
          <StickyKpiBar>
            <WeeklyKpiRowV2
              kpis={computeKpisV2(
                view.snapshot,
                view.detail.overrides,
                view.detail.manual,
              )}
              unknownCount={unknownCountOf(view)}
              weekStart={weekStart}
              op={op}
              appSubState={appSubStateOf(view.snapshot.application)}
            />
          </StickyKpiBar>
        ) : null}
        <WeekBody view={view} path={path} />
      </PendingSavesProvider>
    </OpsPathProvider>
  );
}

/** 이 주에 볼 화면이 없는 사람 — 명단이 비었으면 그 사실을, 아니면 누가 보는지를 알린다. */
function NoAccess({
  weekStart,
  weekRef,
  emptyRoster,
  path,
}: {
  weekStart: string;
  weekRef: WeekRef;
  emptyRoster: boolean;
  path: string;
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
            href={opsWeeklyHref(
              shiftWeek(weekStart, -1),
              "status",
              null,
              null,
              path,
            )}
            className="underline"
          >
            ‹ 이전 주
          </Link>
          <Link
            href={opsWeeklyHref(
              shiftWeek(weekStart, 1),
              "status",
              null,
              null,
              path,
            )}
            className="underline"
          >
            다음 주 ›
          </Link>
          <Link href={path} className="underline">
            이번 주로
          </Link>
        </div>
      </div>
    </div>
  );
}

function NoWeek({ weekStart, path }: { weekStart: string; path: string }) {
  return (
    <div className="p-5 lg:p-7">
      <div className={BOX_CLASS}>
        <p>이 주의 보고서가 아직 열리지 않았습니다</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={opsWeeklyHref(
              shiftWeek(weekStart, -1),
              "application",
              null,
              null,
              path,
            )}
            className="underline"
          >
            ‹ 이전 주
          </Link>
          <Link href={path} className="underline">
            이번 주로
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 주간업무보고 화면 — 기존 메뉴(v1)와 새 화면 메뉴(v2)의 page 가 판만 골라 부른다. */
export async function renderOpsWeekly(
  variant: OpsWeeklyVariant,
  searchParams: Promise<{ week?: string; tab?: string; op?: string }>,
) {
  const { slug, path } = VARIANT[variant];
  const me = await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const sp = await searchParams;
  // 새 화면 메뉴는 관리자·당번도 내 보고서가 기본이다(2026-11-25 사용자 지시).
  const view = await loadOpsWeeklyPage(me, sp, new Date(), {
    mineByDefault: variant === "v2",
  });
  const config = resolvePageMeta(slug, meta);
  return (
    <>
      <PageHeader
        pathname={path}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      {view.kind === "no-week" ? (
        <NoWeek weekStart={view.weekStart} path={path} />
      ) : view.kind === "no-access" ? (
        <NoAccess
          weekStart={view.week.week_start}
          weekRef={view.weekRef}
          emptyRoster={view.emptyRoster}
          path={path}
        />
      ) : (
        <WeekView view={view} variant={variant} />
      )}
    </>
  );
}
