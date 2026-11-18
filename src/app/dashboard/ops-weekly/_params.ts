import type { PageTab } from "@/components/common/PageTabs";
import {
  AREA_LABEL,
  OPS_WEEKLY_PATH,
  type Area,
} from "@/features/ops-weekly/constants";
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
 */
export function parseSub(
  tab: SubTabArea,
  raw: string | null,
  visible: readonly string[],
): string {
  return raw !== null && visible.includes(raw) ? raw : DEFAULT_SUB[tab];
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
