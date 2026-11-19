import type { PageTab } from "@/components/common/PageTabs";
import {
  AREA_LABEL,
  OPS_WEEKLY_PATH,
  type Area,
} from "@/features/ops-weekly/constants";
import type { StatusAccess } from "@/features/ops-weekly/permissions";
import { weekRefFromStart } from "@/features/ops-weekly/week";

export const OPS_TABS = [
  "application",
  "pims",
  "project",
  "tf",
  "leave",
  "status",
  "settings",
] as const;
export type OpsTab = (typeof OPS_TABS)[number];

const TAB_LABEL: Record<OpsTab, string> = {
  ...AREA_LABEL,
  status: "제출 현황",
  settings: "설정",
};

export function parseTab(v: string | undefined, isAdmin: boolean): OpsTab {
  const tab = OPS_TABS.find((t) => t === v);
  if (tab === undefined) return "application";
  return tab === "settings" && !isAdmin ? "application" : tab;
}

/** 월요일 `YYYY-MM-DD` 만 통과한다. */
export function parseWeekParam(v: string | undefined): string | null {
  if (v === undefined) return null;
  return weekRefFromStart(v) === null ? null : v;
}

/** 원서접수 탭의 하위 탭 키 — 첫 값이 기본이다. 묶음 키(merge)에 `unknown` 이 더해진 어휘. */
export const APP_SUBS = [
  "dev",
  "test",
  "unknown",
  "running",
  "opening",
  "closing",
  "other",
] as const;
/** PIMS 탭의 하위 탭 키 — 첫 값이 기본이다. */
export const PIMS_SUBS = ["thisWeek", "nextWeek"] as const;
export type SubTabArea = "application" | "pims";

const DEFAULT_SUB: Record<SubTabArea, string> = {
  application: "dev",
  pims: "thisWeek",
};

/**
 * `?sub=` 를 그 탭의 하위 탭 키로 — 없거나, 그 탭의 키가 아니거나, 지금 안 보이는 탭이면 기본값.
 * `visible` 은 그 탭의 키 목록 중 지금 화면에 있는 것(구분 미확인 0건이면 빠진다).
 * `fallback` 은 탭 기본값을 바꿀 때만 준다(원서접수는 구분 수집 여부로 갈린다).
 */
export function parseSub(
  tab: SubTabArea,
  raw: string | null,
  visible: readonly string[],
  fallback: string = DEFAULT_SUB[tab],
): string {
  return raw !== null && visible.includes(raw) ? raw : fallback;
}

/** 구분이 수집되기 전 주에는 개발·테스트가 '—' 한 줄이라, 첫 화면은 실제 목록이 있는 운영 중이다. */
export function defaultAppSub(devStatusCollected: boolean): string {
  return devStatusCollected ? "dev" : "running";
}

/** 원서접수의 보이는 하위 탭 키 — 구분 미확인은 수집됐고 건이 있을 때만 보인다. */
export function appVisibleSubs(showUnknown: boolean): readonly string[] {
  return APP_SUBS.filter((k) => k !== "unknown" || showUnknown);
}

/** 원서접수 하위 탭의 현재 키 — SubTabs 와 KPI 카드의 활성 판정이 이 한 곳을 쓴다. */
export function resolveAppSub(
  raw: string | null,
  state: { showUnknown: boolean; collected: boolean },
): string {
  return parseSub(
    "application",
    raw,
    appVisibleSubs(state.showUnknown),
    defaultAppSub(state.collected),
  );
}

export function opsWeeklyHref(
  weekStart: string,
  tab: string,
  op: string | null,
  sub: string | null = null,
): string {
  const base = `${OPS_WEEKLY_PATH}?week=${weekStart}&tab=${tab}`;
  const withOp = op === null ? base : `${base}&op=${encodeURIComponent(op)}`;
  return sub === null ? withOp : `${withOp}&sub=${sub}`;
}

export function buildTabs(args: {
  weekStart: string;
  op: string | null;
  isAdmin: boolean;
  checked: readonly Area[];
}): PageTab[] {
  const checked: ReadonlySet<string> = new Set(args.checked);
  return OPS_TABS.filter((t) => t !== "settings" || args.isAdmin).map((t) => ({
    key: t,
    label: checked.has(t) ? `${TAB_LABEL[t]} ✓` : TAB_LABEL[t],
    href: opsWeeklyHref(args.weekStart, t, args.op),
  }));
}

export type RoleTab = "report" | "status" | "manage";

export const ROLE_TAB_LABEL: Record<RoleTab, string> = {
  report: "내 보고서",
  status: "제출 현황",
  manage: "관리",
};

export function roleTabOf(tab: OpsTab): RoleTab {
  if (tab === "status") return "status";
  if (tab === "settings") return "manage";
  return "report";
}

export type TabAccess = {
  canReport: boolean;
  status: StatusAccess;
  manage: boolean;
};

/** 주소의 `tab` 을 권한으로 거른다 — 허용된 값은 그대로, 아니면 처음 화면(없으면 null). */
export function resolveTab(raw: string | undefined, access: TabAccess): OpsTab | null {
  const tab = OPS_TABS.find((t) => t === raw);
  if (tab !== undefined) {
    const role = roleTabOf(tab);
    const allowed =
      role === "report"
        ? access.canReport
        : role === "status"
          ? access.status !== null
          : access.manage;
    if (allowed) return tab;
  }
  if (access.canReport) return "application";
  return access.status !== null ? "status" : null;
}

export function roleTabsOf(access: TabAccess): RoleTab[] {
  const allowed: Record<RoleTab, boolean> = {
    report: access.canReport,
    status: access.status !== null,
    manage: access.manage,
  };
  return (["report", "status", "manage"] as const).filter((r) => allowed[r]);
}

const ROLE_TAB_TARGET: Record<RoleTab, OpsTab> = {
  report: "application",
  status: "status",
  manage: "settings",
};

export function buildRoleTabs(args: {
  weekStart: string;
  roles: readonly RoleTab[];
}): PageTab[] {
  return args.roles.map((r) => ({
    key: r,
    label: ROLE_TAB_LABEL[r],
    href: opsWeeklyHref(args.weekStart, ROLE_TAB_TARGET[r], null),
  }));
}

export const MANAGE_SECTIONS = [
  "overview",
  "duty",
  "recipients",
  "rotation",
  "exclusions",
  "projects",
  "unmatched",
] as const;
export type ManageSection = (typeof MANAGE_SECTIONS)[number];

export const MANAGE_SECTION_LABEL: Record<ManageSection, string> = {
  overview: "전체 현황",
  duty: "당번 지정",
  recipients: "받는 사람",
  rotation: "당번 순번표",
  exclusions: "작성 제외",
  projects: "프로젝트·TF 목록",
  unmatched: "안 붙은 서비스",
};

export function parseSection(raw: string | null): ManageSection {
  return MANAGE_SECTIONS.find((s) => s === raw) ?? "overview";
}

export function manageHref(weekStart: string, section: ManageSection): string {
  return `${opsWeeklyHref(weekStart, "settings", null)}&section=${section}`;
}
