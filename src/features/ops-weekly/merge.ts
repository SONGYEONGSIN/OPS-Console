/**
 * 자동 목록에 운영자의 빼기·메모·직접 추가를 얹고, 건수 카드와 제출 스냅샷을 만든다.
 * 순수 모듈 — 조회는 `auto-queries.ts` 가 한다.
 */
import { z } from "zod";
import type { AutoArea, ProjectKind, ProjectStage } from "./constants";
import type { ApplicationGroups, AutoItem } from "./auto-lists/application";
import type { LeaveItem } from "./auto-lists/leave";
import type { PimsGroups } from "./auto-lists/pims";

export type ItemOverride = {
  item_key: string;
  note: string;
  excluded: boolean;
};

export type ManualItem = {
  id: string;
  area: AutoArea;
  group_key: string | null;
  title: string;
  note: string;
  period_start: string | null;
  period_end: string | null;
  leave_kind: string | null;
};

// `other` = 원서접수 외 서비스
export const APPLICATION_GROUP_KEYS = [
  "dev",
  "test",
  "opening",
  "running",
  "closing",
  "other",
] as const;
export const PIMS_GROUP_KEYS = ["thisWeek", "nextWeek"] as const;

export type AutoSnapshot = {
  version: 1;
  computedAt: string;
  application: ApplicationGroups;
  pims: PimsGroups;
  leave: LeaveItem[];
  unmatched: { application: number; pims: number };
};

const autoItemSchema = z.object({
  key: z.string(),
  title: z.string(),
  subtitle: z.string(),
  at: z.string().nullable(),
});

const leaveItemSchema = autoItemSchema.extend({
  family: z.enum(["leave", "field", "training"]),
  kindLabel: z.string(),
  startYmd: z.string(),
  endYmd: z.string(),
  substituteName: z.string().nullable(),
  sources: z.array(z.enum(["backup", "schedule"])),
  needsBackup: z.boolean(),
});

const itemList = z.array(autoItemSchema);

export const autoSnapshotSchema: z.ZodType<AutoSnapshot> = z.object({
  version: z.literal(1),
  computedAt: z.string(),
  application: z.object({
    dev: itemList,
    test: itemList,
    unknown: itemList,
    opening: itemList,
    running: itemList,
    closing: itemList,
    devStatusCollected: z.boolean(),
  }),
  pims: z.object({ thisWeek: itemList, nextWeek: itemList }),
  leave: z.array(leaveItemSchema),
  unmatched: z.object({
    application: z.number().int().min(0),
    pims: z.number().int().min(0),
  }),
});

export type ViewItem<T extends AutoItem = AutoItem> = T & {
  note: string;
  excluded: boolean;
};

/** 뺀 건도 돌려준다 — 화면이 되살리기를 보여야 하기 때문이다. */
export function applyOverrides<T extends AutoItem>(
  list: readonly T[],
  overrides: ReadonlyMap<string, ItemOverride>,
): ViewItem<T>[] {
  return list.map((item) => {
    const o = overrides.get(item.key);
    return { ...item, note: o?.note ?? "", excluded: o?.excluded ?? false };
  });
}

export type WeeklyKpis = {
  dev: number | null;
  test: number | null;
  opening: number;
  running: number;
  closing: number;
  pims: number;
};

function kept(
  list: readonly AutoItem[],
  overrides: ReadonlyMap<string, ItemOverride>,
): number {
  return list.filter((i) => !overrides.get(i.key)?.excluded).length;
}

function manualCount(
  manual: readonly ManualItem[],
  area: AutoArea,
  keys: readonly string[],
): number {
  return manual.filter(
    (m) =>
      m.area === area && m.group_key !== null && keys.includes(m.group_key),
  ).length;
}

export function computeKpis(
  snap: AutoSnapshot,
  overrides: ReadonlyMap<string, ItemOverride>,
  manual: readonly ManualItem[],
): WeeklyKpis {
  const app = snap.application;
  const appCount = (list: readonly AutoItem[], key: string) =>
    kept(list, overrides) + manualCount(manual, "application", [key]);
  const stageCount = (list: readonly AutoItem[], key: "dev" | "test") => {
    const extra = manualCount(manual, "application", [key]);
    if (!app.devStatusCollected && extra === 0) return null;
    return kept(list, overrides) + extra;
  };
  return {
    dev: stageCount(app.dev, "dev"),
    test: stageCount(app.test, "test"),
    opening: appCount(app.opening, "opening"),
    running: appCount(app.running, "running"),
    closing: appCount(app.closing, "closing"),
    pims:
      kept(snap.pims.thisWeek, overrides) +
      kept(snap.pims.nextWeek, overrides) +
      manualCount(manual, "pims", PIMS_GROUP_KEYS),
  };
}

export type ProjectEntryView = {
  projectId: string;
  projectName: string;
  kind: ProjectKind;
  sortOrder: number;
  operatorEmail: string;
  operatorName: string;
  stage: ProjectStage | null;
  thisWeek: string;
  nextWeek: string;
};

export type ProjectGroup = {
  projectId: string;
  projectName: string;
  kind: ProjectKind;
  owners: ProjectEntryView[];
};

/** 항목(sortOrder 순) → 담당자(운영자명 순). */
export function groupEntriesByProject(
  entries: readonly ProjectEntryView[],
): ProjectGroup[] {
  const byProject = new Map<string, ProjectEntryView[]>();
  for (const e of entries) {
    byProject.set(e.projectId, [...(byProject.get(e.projectId) ?? []), e]);
  }
  return [...byProject.values()]
    .sort((a, b) => a[0].sortOrder - b[0].sortOrder)
    .map((owners) => ({
      projectId: owners[0].projectId,
      projectName: owners[0].projectName,
      kind: owners[0].kind,
      owners: [...owners].sort((a, b) =>
        a.operatorName.localeCompare(b.operatorName, "ko"),
      ),
    }));
}
