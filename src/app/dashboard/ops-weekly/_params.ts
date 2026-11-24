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
  "submit",
  "status",
  "settings",
] as const;
export type OpsTab = (typeof OPS_TABS)[number];

/** 화면이 영역을 부르는 이름 — 도메인 `AREA_LABEL` 은 그대로 두고 합격자 발표만 다르게 부른다. */
export const AREA_TAB_LABEL: Record<Area, string> = {
  ...AREA_LABEL,
  pims: "합격자 발표",
};

/** 영역 탭 넷 — 프로젝트·TF 는 한 탭에 프로젝트·TF 두 절(확인 영역은 여전히 다섯). */
export const AREA_TABS = ["application", "pims", "project", "leave"] as const;
export type AreaTab = (typeof AREA_TABS)[number];

/** 자동 목록이 있어 직접 추가가 붙는 영역 — 프로젝트·TF 는 특이사항만 쓸 것 칸에 둔다. */
export const PANEL_AREAS = ["application", "pims", "leave"] as const;
export type PanelArea = (typeof PANEL_AREAS)[number];

/** 쓸 것 칸(특이사항)이 있는 탭 — 제출 탭만 없다. 직접 추가는 PANEL_AREAS 셋에만 있다. */
export const hasWritePanel = (a: ReportTab): a is AreaTab => a !== "submit";

/** 영역 탭 라벨 — `project` 탭은 TF 까지 담는다. */
export const AREA_TAB_TITLE: Record<AreaTab, string> = {
  application: AREA_TAB_LABEL.application,
  pims: AREA_TAB_LABEL.pims,
  project: "프로젝트·TF",
  leave: AREA_TAB_LABEL.leave,
};

/** 보고서 화면의 탭 — 영역 넷 + 맨 끝 `제출`(본인 보고서에서만, 요약을 보고 제출하는 자리). */
export const REPORT_TABS = [...AREA_TABS, "submit"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];
export const SUBMIT_TAB_TITLE = "제출";

/** 주소의 `tab` 을 보고서 탭으로 — `tf` 는 프로젝트·TF 탭, 역할 탭 값이나 없는 값은 원서접수. */
export function resolveArea(raw: string | null): ReportTab {
  if (raw === "tf") return "project";
  return REPORT_TABS.find((a) => a === raw) ?? "application";
}

/** 제출 탭이 없는 화면(전체 보고·남의 보고서)에서 `tab=submit` 이면 원서접수를 보인다. */
export function visibleArea(area: ReportTab, withSubmit: boolean): ReportTab {
  return area === "submit" && !withSubmit ? "application" : area;
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

/** `?op=all` — 전체 보고(작성자 전원의 내용을 한 화면에). 이메일 자리를 빌려 쓰므로 주·하위 탭·KPI 링크가 그대로 들고 다닌다. */
export const ALL_OP = "all";

/**
 * `?op=me` — 본인 보고서를 고른 것. 관리자·당번은 op 가 없으면 전체 보고로 열리므로,
 * 내 보고서를 고른 선택이 주 이동·하위 탭 링크에 실려 다니게 따로 적는다.
 */
export const MINE_OP = "me";

export function opsWeeklyHref(
  weekStart: string,
  tab: string,
  op: string | null,
  sub: string | null = null,
  /** 어느 메뉴의 주소인지 — 기존 메뉴와 새 화면 메뉴(관리자 전용)가 같은 화면 부품을 쓴다. */
  path: string = OPS_WEEKLY_PATH,
): string {
  const base = `${path}?week=${weekStart}&tab=${tab}`;
  const withOp = op === null ? base : `${base}&op=${encodeURIComponent(op)}`;
  return sub === null ? withOp : `${withOp}&sub=${sub}`;
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
export function resolveTab(
  raw: string | undefined,
  access: TabAccess,
): OpsTab | null {
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
  path?: string;
}): PageTab[] {
  return args.roles.map((r) => ({
    key: r,
    label: ROLE_TAB_LABEL[r],
    href: opsWeeklyHref(
      args.weekStart,
      ROLE_TAB_TARGET[r],
      null,
      null,
      args.path,
    ),
  }));
}

export const MANAGE_SECTIONS = [
  "overview",
  "recipients",
  "duty",
  "rotation",
  "projects",
  "exclusions",
  "unmatched",
] as const;
export type ManageSection = (typeof MANAGE_SECTIONS)[number];

export const MANAGE_SECTION_LABEL: Record<ManageSection, string> = {
  overview: "전체 현황",
  duty: "당번 지정",
  recipients: "받는 사람",
  rotation: "당번 순번",
  exclusions: "작성 제외",
  projects: "프로젝트·TF",
  unmatched: "지정 안된 서비스",
};

export function parseSection(raw: string | null): ManageSection {
  return MANAGE_SECTIONS.find((s) => s === raw) ?? "overview";
}

export function manageHref(
  weekStart: string,
  section: ManageSection,
  path?: string,
): string {
  return `${opsWeeklyHref(weekStart, "settings", null, null, path)}&section=${section}`;
}
