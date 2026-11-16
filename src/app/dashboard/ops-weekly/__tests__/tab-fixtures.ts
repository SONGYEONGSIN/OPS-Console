import type { LeaveItem } from "@/features/ops-weekly/auto-lists/leave";
import type { AutoItem } from "@/features/ops-weekly/auto-lists/application";
import type {
  AutoSnapshot,
  ItemOverride,
  ManualItem,
} from "@/features/ops-weekly/merge";
import type { ReportDetail } from "@/features/ops-weekly/report-queries";

export const EMPTY: ReportDetail = {
  notes: {
    application: { thisWeek: "", nextWeek: "" },
    pims: { thisWeek: "", nextWeek: "" },
    project: { thisWeek: "", nextWeek: "" },
    tf: { thisWeek: "", nextWeek: "" },
    leave: { thisWeek: "", nextWeek: "" },
  },
  overrides: new Map<string, ItemOverride>(),
  manual: [],
  projects: [],
};

export const item = (key: string, over: Partial<AutoItem> = {}): AutoItem => ({
  key,
  title: "가대학교",
  subtitle: "수시모집",
  at: null,
  ...over,
});

export function leaveItem(over: Partial<LeaveItem> = {}): LeaveItem {
  return {
    ...item("leave:br:b1", { title: "운영자A", subtitle: "백업 운영자B" }),
    family: "leave",
    kindLabel: "연차",
    startYmd: "2026-11-18",
    endYmd: "2026-11-18",
    substituteName: "운영자B",
    sources: ["backup"],
    needsBackup: false,
    ...over,
  };
}

export function manualLeave(over: Partial<ManualItem> = {}): ManualItem {
  return {
    id: "m1",
    area: "leave",
    group_key: null,
    title: "외부 교육",
    note: "",
    period_start: "2026-11-25",
    period_end: null,
    leave_kind: "교육",
    ...over,
  };
}

export function snap(
  o: {
    devStatusCollected?: boolean;
    unknown?: number;
    unmatchedApplication?: number;
    unmatchedPims?: number;
    pimsThis?: string[];
    pimsNext?: string[];
    leave?: LeaveItem[];
  } = {},
): AutoSnapshot {
  const unknown = Array.from({ length: o.unknown ?? 0 }, (_, i) =>
    item(`closing:u${i}`),
  );
  return {
    version: 1,
    computedAt: "2026-11-16T00:00:00.000Z",
    application: {
      dev: [],
      test: [],
      unknown,
      opening: [],
      running: [],
      closing: [],
      devStatusCollected: o.devStatusCollected ?? true,
    },
    pims: {
      thisWeek: (o.pimsThis ?? []).map((k) => item(k)),
      nextWeek: (o.pimsNext ?? []).map((k) => item(k)),
    },
    leave: o.leave ?? [],
    unmatched: {
      application: o.unmatchedApplication ?? 0,
      pims: o.unmatchedPims ?? 0,
    },
  };
}
