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

export function opsWeeklyHref(
  weekStart: string,
  tab: string,
  op: string | null,
): string {
  const base = `${OPS_WEEKLY_PATH}?week=${weekStart}&tab=${tab}`;
  return op === null ? base : `${base}&op=${encodeURIComponent(op)}`;
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
