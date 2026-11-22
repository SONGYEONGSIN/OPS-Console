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
  /** 전체 보고에서만 — 이 건을 추가한 작성자 이름 */
  owner?: string;
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
  universityType: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
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

/** 뺀 건을 뺀 자동 건수 — KPI 와 하위 탭 숫자가 같은 식을 쓴다. */
export function kept(
  list: readonly AutoItem[],
  overrides: ReadonlyMap<string, ItemOverride>,
): number {
  return list.filter((i) => !overrides.get(i.key)?.excluded).length;
}

/** 그 영역·묶음 키들의 직접 추가 건수. */
export function manualCount(
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

export type UnivBreakdown = { label: string; count: number }[];

const UNIV_ORDER = ["4년제", "2년제", "대학원", "기타", "직접"] as const;

/** 대학구분 원값 → 카드 칸. 전문대는 2년제(경쟁률 점검 조건과 같은 묶음), 그 밖은 기타. */
function univBucket(type: string | null | undefined): string {
  if (type === "4년제" || type === "대학원") return type;
  if (type === "2년제" || type === "전문대") return "2년제";
  return "기타";
}

/**
 * 개발·테스트·운영·차주 오픈/마감 카드의 대학구분 칸 — 카드 숫자(computeKpis)와 같은 식(뺀 건 제외 + 직접 추가)이라
 * 칸의 합이 카드 숫자와 같다. 직접 추가는 대학구분이 없어 `직접` 칸이다. 0 인 칸은 내지 않는다.
 */
export function stageBreakdowns(
  snap: AutoSnapshot,
  overrides: ReadonlyMap<string, ItemOverride>,
  manual: readonly ManualItem[],
): Record<"dev" | "test" | "running" | "opening" | "closing", UnivBreakdown> {
  const of = (list: readonly AutoItem[], key: string): UnivBreakdown => {
    const counts = new Map<string, number>();
    for (const i of list) {
      if (overrides.get(i.key)?.excluded) continue;
      const b = univBucket(i.universityType);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const extra = manualCount(manual, "application", [key]);
    if (extra > 0) counts.set("직접", extra);
    return UNIV_ORDER.filter((l) => (counts.get(l) ?? 0) > 0).map((l) => ({
      label: l,
      count: counts.get(l) ?? 0,
    }));
  };
  const app = snap.application;
  return {
    dev: of(app.dev, "dev"),
    test: of(app.test, "test"),
    running: of(app.running, "running"),
    opening: of(app.opening, "opening"),
    closing: of(app.closing, "closing"),
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
