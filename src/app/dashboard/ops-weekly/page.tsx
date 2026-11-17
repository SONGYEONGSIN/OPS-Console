import Link from "next/link";
import { PageTabs } from "@/components/common/PageTabs";
import { requireMenu } from "@/features/auth/menu-guard";
import { OPS_WEEKLY_SLUG } from "@/features/ops-weekly/constants";
import { normEmail } from "@/features/ops-weekly/email";
import { shiftWeek } from "@/features/ops-weekly/week";
import { PageHeader } from "../_components/page-header/PageHeader";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { ApplicationTab } from "./_components/ApplicationTab";
import { LeaveTab } from "./_components/LeaveTab";
import { PimsTab } from "./_components/PimsTab";
import { ProjectTab } from "./_components/ProjectTab";
import { SettingsTab } from "./_components/SettingsTab";
import { StatusTab } from "./_components/StatusTab";
import { PendingSavesProvider } from "./_components/pending-saves";
import { WeekHeader } from "./_components/WeekHeader";
import { WeeklyKpiRow } from "./_components/WeeklyKpiRow";
import { bodyKeyOf } from "./_body-key";
import { loadOpsWeeklyPage, type OpsWeeklyView } from "./_load";
import { buildTabs, opsWeeklyHref, type OpsTab } from "./_params";

const EMPTY_ROSTER =
  "작성 대상 명단이 비어 있습니다 — 관리자 설정을 확인하세요";
const BOX_CLASS =
  "flex flex-col gap-1 border border-line-soft bg-situation-bg px-4 py-6 text-sm text-ink";
const TAB_TITLE: Record<OpsTab, string> = {
  application: "원서접수",
  pims: "PIMS",
  project: "프로젝트",
  tf: "TF",
  leave: "휴가·외근",
  status: "제출 현황",
  settings: "설정",
};
// 명단이 비어도 열어야 하는 탭 — 명단을 고칠 자리가 설정 탭이다.
const OPEN_WITHOUT_ROSTER: ReadonlySet<OpsTab> = new Set([
  "status",
  "settings",
]);

type Week = Extract<OpsWeeklyView, { kind: "week" }>;

/** 구분(개발/테스트)이 안 된 건수 — 뺀 건은 세지 않는다. */
function unknownCountOf(v: Week): number {
  const list = v.snapshot?.application.unknown ?? [];
  const overrides = v.detail?.overrides;
  return list.filter((i) => !overrides?.get(i.key)?.excluded).length;
}

function dutyNameOf(v: Week): string | null {
  const email = v.week.duty_email;
  if (email === null) return null;
  return v.writers.find((w) => w.email === normEmail(email))?.name ?? email;
}

function WeekBody({ view }: { view: Week }) {
  const { tab, viewed } = view;
  if (viewed === null && !OPEN_WITHOUT_ROSTER.has(tab)) {
    return (
      <div className="p-5 lg:p-7">
        <div className={BOX_CLASS}>
          <p>{EMPTY_ROSTER}</p>
          {view.actor.isAdmin ? (
            <Link
              href={opsWeeklyHref(view.week.week_start, "settings", null)}
              className="text-xs underline"
            >
              설정 열기
            </Link>
          ) : null}
        </div>
      </div>
    );
  }
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
  if (tab === "settings" && view.bundle !== null) {
    const key = bodyKeyOf({
      reportId: report?.id ?? null,
      weekStart: view.week.week_start,
      op: viewed?.email ?? "",
      tab,
    });
    return <SettingsTab key={key} bundle={view.bundle} />;
  }
  if (snapshot !== null && detail !== null) {
    // 쿼리만 바뀌어도 입력 중이던 글이 다른 보고서로 넘어가지 않게 보고서 단위로 다시 만든다.
    const key = bodyKeyOf({
      reportId: report?.id ?? null,
      weekStart: view.week.week_start,
      op: viewed?.email ?? "",
      tab,
    });
    const props = {
      snapshot,
      detail,
      reportId: report?.id ?? null,
      editable: view.canEdit && report !== null,
    };
    if (tab === "application") return <ApplicationTab key={key} {...props} />;
    if (tab === "pims") return <PimsTab key={key} {...props} />;
    if (tab === "leave") return <LeaveTab key={key} {...props} />;
    if (tab === "project" || tab === "tf") {
      return (
        <ProjectTab
          key={key}
          kind={tab}
          entries={detail.projects}
          reportId={props.reportId}
          editable={props.editable}
          notes={detail.notes[tab]}
          settingsHref={
            view.actor.isAdmin
              ? opsWeeklyHref(view.week.week_start, "settings", null)
              : undefined
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

function WeekView({ view }: { view: Week }) {
  const { week, weekRef, tab, viewed, report, actor } = view;
  const op =
    viewed !== null && viewed.email !== actor.email ? viewed.email : null;
  const weekStart = week.week_start;
  return (
    <PendingSavesProvider>
      <WeekHeader
        weekRef={weekRef}
        week={week}
        viewedName={viewed?.name ?? null}
        writers={view.writers.map((w) => ({ email: w.email, name: w.name }))}
        viewedEmail={viewed?.email ?? null}
        submittedCount={view.submittedCount}
        writerCount={view.writers.length}
        dutyName={dutyNameOf(view)}
        canSubmit={view.canSubmit}
        reportStatus={report?.status ?? null}
        submittedAt={report?.submitted_at ?? null}
        reportId={report?.id ?? null}
        returnReason={report?.return_reason ?? null}
        prevOpen={view.prevOpen}
        prevHref={opsWeeklyHref(shiftWeek(weekStart, -1), tab, op)}
        nextHref={opsWeeklyHref(shiftWeek(weekStart, 1), tab, op)}
        tab={tab}
      />
      {viewed !== null && view.kpis !== null ? (
        <WeeklyKpiRow
          kpis={view.kpis}
          ownerName={viewed.name}
          unknownCount={unknownCountOf(view)}
        />
      ) : null}
      <div className="pt-4">
        <PageTabs
          active={tab}
          size="md"
          className="px-5 lg:px-7"
          tabs={buildTabs({
            weekStart,
            op,
            isAdmin: actor.isAdmin,
            checked: report?.checked_tabs ?? [],
          })}
        />
      </div>
      <WeekBody view={view} />
    </PendingSavesProvider>
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
      ) : (
        <WeekView view={view} />
      )}
    </>
  );
}
