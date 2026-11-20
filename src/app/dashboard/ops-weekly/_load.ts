import "server-only";

import type { CurrentOperator } from "@/features/auth/queries";
import type { UnmatchedServices } from "@/features/ops-weekly/auto-lists/unmatched";
import {
  loadAutoSnapshot,
  loadUnmatchedServices,
} from "@/features/ops-weekly/auto-queries";
import { normEmail } from "@/features/ops-weekly/email";
import {
  OVERVIEW_WEEKS,
  buildWeekOverview,
  type WeekOverviewRow,
} from "@/features/ops-weekly/overview";
import {
  computeKpis,
  groupEntriesByProject,
  type AutoSnapshot,
  type ProjectGroup,
  type WeeklyKpis,
} from "@/features/ops-weekly/merge";
import { signProjectEntries } from "@/features/ops-weekly/note-images";
import {
  canEditReport,
  canManageSettings,
  canSubmitReport,
  checkFinalize,
  isDuty,
  statusAccess,
  type Actor,
  type FinalizeCheck,
  type StatusAccess,
} from "@/features/ops-weekly/permissions";
import {
  ensureReport,
  listProjectEntriesForWeek,
  listReportStatusesForWeeks,
  listReports,
  loadReportDetail,
  type ReportDetail,
} from "@/features/ops-weekly/report-queries";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import {
  normalizedWeekStateOf,
  type ReportRow,
  type WeekRow,
} from "@/features/ops-weekly/schemas";
import {
  isRecipient,
  loadSettingsBundle,
  type SettingsBundle,
} from "@/features/ops-weekly/settings-queries";
import {
  defaultWeekStart,
  shiftWeek,
  weekOf,
  weekRefFromStart,
  type WeekRef,
} from "@/features/ops-weekly/week";
import {
  ensureWeek,
  getWeek,
  listRecentWeeks,
  listWriters,
} from "@/features/ops-weekly/week-queries";
import {
  parseWeekParam,
  resolveTab,
  roleTabOf,
  roleTabsOf,
  type OpsTab,
  type RoleTab,
  type TabAccess,
} from "./_params";

export type OpsWeeklyWeekView = Extract<OpsWeeklyView, { kind: "week" }>;

export type OpsWeeklyView =
  | { kind: "no-week"; weekStart: string }
  /** 이 주에 볼 화면이 없다 — 보고서·목록을 읽지 않았다 */
  | { kind: "no-access"; week: WeekRow; weekRef: WeekRef; emptyRoster: boolean }
  | {
      kind: "week";
      week: WeekRow;
      weekRef: WeekRef;
      tab: OpsTab;
      actor: Actor;
      writers: WriterCandidate[];
      /** 역할 탭 줄에 그릴 역할 — 내 보고서는 본인이 명단에 있을 때만 */
      roles: RoleTab[];
      /** 제출 현황·남의 보고서를 여는 권한(null 이면 본인 보고서만) */
      statusAccess: StatusAccess;
      /** 본인도 ?op 도 명단 밖이면 null(제출 현황·관리에서만 그렇다) */
      viewed: WriterCandidate | null;
      /**
       * viewed 가 null 이면 report·snapshot·detail·kpis 모두 null(스냅샷을 만들 사람이 없다).
       * snapshot·detail·kpis 는 내 보고서 쪽 탭에서만 읽는다 — 제출 현황·관리에서는 null.
       */
      report: ReportRow | null;
      snapshot: AutoSnapshot | null;
      /** detail.projects 는 그림 src 가 서명된 HTML 이다 */
      detail: ReportDetail | null;
      kpis: WeeklyKpis | null;
      submittedCount: number;
      prevOpen: boolean;
      /** 제출했지만 [최종 보고] 전 — 자동 항목이 아직 살아 있는 값이다 */
      freezeNotice: boolean;
      canEdit: boolean;
      canSubmit: boolean;
      /** status 탭에서만 (Task 14) */
      reports: ReportRow[] | null;
      /** status 탭에서만, 서명된 HTML (Task 14) */
      projectGroups: ProjectGroup[] | null;
      /** status 탭에서만 (Task 14) */
      finalize: FinalizeCheck | null;
      /** settings 탭에서만 (Task 15) */
      bundle: SettingsBundle | null;
      /** settings 탭에서만, 이 주 기준 실시간 값 */
      unmatched: UnmatchedServices | null;
      /** settings 탭에서만 — 최근 주 현황(관리 › 전체 현황) */
      overview: WeekOverviewRow[] | null;
    };

type Sp = { week?: string; tab?: string; op?: string };

/**
 * 보는 대상: 남의 보고서를 열 수 있으면 ?op(명단 안일 때), 그 밖에는 본인(명단 안일 때).
 * `?op` 를 받아들일지 정하는 자리는 여기 하나다 — 명단 첫 사람으로 떨어지지 않는다.
 */
function pickViewed(
  writers: readonly WriterCandidate[],
  actor: Actor,
  op: string | undefined,
  canViewOthers: boolean,
): WriterCandidate | null {
  const self = writers.find((w) => w.email === actor.email) ?? null;
  if (!canViewOthers || op === undefined) return self;
  const wanted = normEmail(op);
  return writers.find((w) => w.email === wanted) ?? self;
}

type Access = {
  viewed: WriterCandidate | null;
  tab: OpsTab;
  roles: RoleTab[];
  statusAccess: StatusAccess;
};

/** 누구의 보고서를, 어떤 탭으로 여는가 — 볼 화면이 없으면 null(안내 화면). */
async function resolveAccess(
  week: WeekRow,
  actor: Actor,
  writers: readonly WriterCandidate[],
  sp: Sp,
): Promise<Access | null> {
  const state = normalizedWeekStateOf(week);
  // 받는 사람은 보고가 끝난 주만 읽는다 — 그 밖에는 명단을 조회할 까닭이 없다.
  const recipient =
    week.status === "reported" && !actor.isAdmin && !isDuty(actor, state)
      ? await isRecipient(actor.email)
      : false;
  const access = statusAccess(actor, state, recipient);
  const viewed = pickViewed(writers, actor, sp.op, access !== null);
  const tabAccess: TabAccess = {
    canReport: viewed !== null,
    status: access,
    manage: canManageSettings(actor),
  };
  const tab = resolveTab(sp.tab, tabAccess);
  if (tab === null) return null;
  // derive 의 writerEmails.has(actor.email) 와 같은 판정 — 둘 다 정규화된 값이다.
  const isWriter = writers.some((w) => w.email === actor.email);
  return {
    viewed,
    tab,
    statusAccess: access,
    roles: roleTabsOf({ ...tabAccess, canReport: isWriter }),
  };
}

/** 자동 항목이 아직 굳지 않은 제출 보고서인가 — 안내 한 줄을 보일 조건. */
export function freezeNoticeOf(
  week: Pick<WeekRow, "status">,
  report: Pick<ReportRow, "status" | "snapshot"> | null,
): boolean {
  return (
    week.status === "open" &&
    report?.status === "submitted" &&
    report.snapshot === null
  );
}

type ViewedData = {
  snapshot: AutoSnapshot;
  detail: ReportDetail;
  kpis: WeeklyKpis;
};

/** 열린 주는 보고서를 늦게 만들고, 닫힌 주는 있는 것만 찾는다. 목록은 한 번만 읽는다. */
async function resolveReport(
  week: WeekRow,
  viewed: WriterCandidate | null,
): Promise<{ report: ReportRow | null; reports: ReportRow[] }> {
  const created =
    viewed !== null && week.status === "open"
      ? await ensureReport(week.id, viewed.email)
      : null;
  const reports = await listReports(week.id);
  const report =
    created ??
    (viewed === null
      ? null
      : (reports.find((r) => normEmail(r.operator_email) === viewed.email) ??
        null));
  return { report, reports };
}

async function loadViewedData(args: {
  week: WeekRow;
  viewed: WriterCandidate;
  report: ReportRow;
  writers: readonly WriterCandidate[];
  now: Date;
}): Promise<ViewedData> {
  const { week, viewed, report, writers, now } = args;
  const snapshot =
    report.snapshot ??
    (await loadAutoSnapshot({
      weekStart: week.week_start,
      operatorEmail: viewed.email,
      operatorName: viewed.name,
      writerNames: new Set(writers.map((w) => w.name)),
      now,
    }));
  const raw = await loadReportDetail(report.id);
  // 그림 src 를 1시간 서명 URL 로 채운 새 객체 — 편집기와 읽기 전용 화면이 같이 쓴다.
  const detail = { ...raw, projects: await signProjectEntries(raw.projects) };
  return {
    snapshot,
    detail,
    kpis: computeKpis(snapshot, detail.overrides, detail.manual),
  };
}

type StatusData = {
  projectGroups: ProjectGroup[];
  finalize: FinalizeCheck;
};

/** 제출 현황 탭 전용 — 모아보기(서명된 그림)와 [최종 보고] 가능 여부. */
async function loadStatusData(args: {
  week: WeekRow;
  actor: Actor;
  writers: readonly WriterCandidate[];
  reports: readonly ReportRow[];
}): Promise<StatusData> {
  const { week, actor, writers, reports } = args;
  const state = normalizedWeekStateOf(week);
  const submitted = new Set(
    reports
      .filter((r) => r.status === "submitted")
      .map((r) => normEmail(r.operator_email)),
  );
  const entries = await signProjectEntries(
    await listProjectEntriesForWeek(week.id),
  );
  return {
    projectGroups: groupEntriesByProject(entries),
    finalize: checkFinalize(
      actor,
      state,
      writers.map((w) => w.email),
      submitted,
    ),
  };
}

/** 제출 분자·분모와 편집·제출 권한. 당번 이메일도 정규화한 키로 비교한다. */
function derive(args: {
  week: WeekRow;
  actor: Actor;
  writers: readonly WriterCandidate[];
  viewed: WriterCandidate | null;
  report: ReportRow | null;
  reports: readonly ReportRow[];
}) {
  const { week, actor, writers, viewed, report, reports } = args;
  const writerEmails = new Set(writers.map((w) => w.email));
  const state = normalizedWeekStateOf(week);
  return {
    submittedCount: reports.filter(
      (r) =>
        r.status === "submitted" &&
        writerEmails.has(normEmail(r.operator_email)),
    ).length,
    canEdit: viewed !== null && canEditReport(actor, state, viewed.email),
    canSubmit:
      viewed !== null &&
      report !== null &&
      canSubmitReport(
        actor,
        state,
        viewed.email,
        writerEmails.has(actor.email),
        report.status,
      ),
  };
}

/**
 * 관리 › 전체 현황 — 최근 주와 그 주 보고서 제출 상태.
 * 보는 주가 최근 목록 밖이면 끝에 덧붙인다 — 오래된 주도 [정정]할 길이 남는다.
 */
async function loadOverview(
  writers: readonly WriterCandidate[],
  viewing: WeekRow,
): Promise<WeekOverviewRow[]> {
  const recent = await listRecentWeeks(OVERVIEW_WEEKS);
  const weeks = recent.some((w) => w.id === viewing.id)
    ? recent
    : [...recent, viewing];
  const reports = await listReportStatusesForWeeks(weeks.map((w) => w.id));
  return buildWeekOverview({ weeks, reports, writers });
}

type ManageData = {
  bundle: SettingsBundle;
  unmatched: UnmatchedServices;
  overview: WeekOverviewRow[];
};

/** 관리 탭 전용 — 설정 번들·안 붙은 서비스(이 주 기준)·전체 현황을 함께 읽는다. */
async function loadManageData(args: {
  week: WeekRow;
  writers: readonly WriterCandidate[];
  now: Date;
}): Promise<ManageData> {
  const { week, writers, now } = args;
  const [bundle, unmatched, overview] = await Promise.all([
    loadSettingsBundle(),
    loadUnmatchedServices({
      weekStart: week.week_start,
      writerNames: new Set(writers.map((w) => w.name)),
      now,
    }),
    loadOverview(writers, week),
  ]);
  return { bundle, unmatched, overview };
}

export async function loadOpsWeeklyPage(
  me: CurrentOperator,
  sp: Sp,
  now: Date,
): Promise<OpsWeeklyView> {
  const cal = weekOf(now).weekStart;
  const calRow = await getWeek(cal);
  const weekStart =
    parseWeekParam(sp.week) ??
    defaultWeekStart(now, calRow?.status === "reported");
  // 만들기에 실패한 주는 여기서 늦게 만들어진다.
  const week = await ensureWeek(weekStart, now);
  const weekRef = weekRefFromStart(weekStart);
  if (week === null || weekRef === null) return { kind: "no-week", weekStart };

  const actor: Actor = {
    email: normEmail(me.email),
    isAdmin: me.permission === "admin",
  };
  const writers = await listWriters();
  const access = await resolveAccess(week, actor, writers, sp);
  if (access === null) {
    return {
      kind: "no-access",
      week,
      weekRef,
      emptyRoster: writers.length === 0,
    };
  }
  const { viewed, tab } = access;
  const { report, reports } = await resolveReport(week, viewed);
  // 스냅샷·상세·KPI 는 내 보고서 쪽 탭에서만 읽는다(제출 현황·관리에는 KPI 가 없다).
  const data =
    roleTabOf(tab) === "report" && viewed !== null && report !== null
      ? await loadViewedData({ week, viewed, report, writers, now })
      : null;
  const flags = derive({ week, actor, writers, viewed, report, reports });
  const status =
    tab === "status"
      ? await loadStatusData({ week, actor, writers, reports })
      : null;
  // 관리 탭은 resolveTab 이 관리 권한이 있을 때만 연다.
  const manage =
    tab === "settings"
      ? await loadManageData({ week, writers, now })
      : null;
  return {
    kind: "week",
    week,
    weekRef,
    ...access,
    actor,
    writers,
    report,
    snapshot: data?.snapshot ?? null,
    freezeNotice: freezeNoticeOf(week, report),
    detail: data?.detail ?? null,
    kpis: data?.kpis ?? null,
    ...flags,
    prevOpen:
      weekStart === cal &&
      (await getWeek(shiftWeek(cal, -1)))?.status === "open",
    reports: status === null ? null : reports,
    projectGroups: status?.projectGroups ?? null,
    finalize: status?.finalize ?? null,
    bundle: manage?.bundle ?? null,
    unmatched: manage?.unmatched ?? null,
    overview: manage?.overview ?? null,
  };
}
