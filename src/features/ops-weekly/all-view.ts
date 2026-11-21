// 전체 보고 — 작성자 전원의 보고서를 한 화면으로 합친다. 순수 함수.
//
// 같은 서비스를 여럿이 맡으면(하위유형이 갈린 대학 등) 한 행으로 합치고 담당자를 모은다.
// 그 사람이 뺀 건은 그 사람 담당에서만 빠진다 — 아무도 안 남으면 행이 없다.
// 합친 결과를 같은 화면 부품(ApplicationTab 등)에 읽기 전용으로 넘기므로 모양은 AutoSnapshot·ReportDetail 그대로다.

import type { AutoItem } from "./auto-lists/application";
import type { LeaveItem } from "./auto-lists/leave";
import { AREAS, type Area } from "./constants";
import {
  computeKpis,
  type AutoSnapshot,
  type ItemOverride,
  type ManualItem,
  type WeeklyKpis,
} from "./merge";
import type { ReportDetail } from "./report-queries";

export type WriterReport = {
  writer: { email: string; name: string };
  snapshot: AutoSnapshot;
  detail: ReportDetail;
};

export type AreaNoteByWriter = { name: string; thisWeek: string; nextWeek: string };

export type AllReportsView = {
  snapshot: AutoSnapshot;
  /** overrides 는 건 메모를 '이름: 메모' 로 모은 것(뺀 건은 이미 목록에서 빠졌다). notes 는 비어 있다 — 사람별은 `notes` */
  detail: ReportDetail;
  notes: Record<Area, AreaNoteByWriter[]>;
  kpis: WeeklyKpis;
};

type Merged<T extends AutoItem> = {
  items: T[];
  notes: Map<string, string[]>;
};

function mergeList<T extends AutoItem>(
  lists: readonly { name: string; list: readonly T[]; overrides: ReadonlyMap<string, ItemOverride> }[],
): Merged<T> {
  const byKey = new Map<string, T>();
  const notes = new Map<string, string[]>();
  for (const { name, list, overrides } of lists) {
    for (const item of list) {
      const o = overrides.get(item.key);
      if (o?.excluded) continue;
      const prev = byKey.get(item.key);
      byKey.set(item.key, {
        ...(prev ?? item),
        owners: [...(prev?.owners ?? []), name],
      });
      if (o?.note) notes.set(item.key, [...(notes.get(item.key) ?? []), `${name}: ${o.note}`]);
    }
  }
  return { items: [...byKey.values()], notes };
}

function atMs(at: string | null): number {
  const t = at ? Date.parse(at) : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** 원서접수·발표 묶음과 같은 순서 — 시각, 같으면 대학명. */
function byAt<T extends AutoItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const d = atMs(a.at) - atMs(b.at);
    if (d !== 0 && !Number.isNaN(d)) return d;
    return a.title.localeCompare(b.title, "ko");
  });
}

function byStart(items: readonly LeaveItem[]): LeaveItem[] {
  return [...items].sort(
    (a, b) => a.startYmd.localeCompare(b.startYmd) || a.title.localeCompare(b.title, "ko"),
  );
}

function emptySnapshot(): AutoSnapshot {
  return {
    version: 1,
    computedAt: new Date(0).toISOString(),
    application: {
      dev: [],
      test: [],
      unknown: [],
      opening: [],
      running: [],
      closing: [],
      devStatusCollected: false,
    },
    pims: { thisWeek: [], nextWeek: [] },
    leave: [],
    unmatched: { application: 0, pims: 0 },
  };
}

const APP_GROUPS = ["dev", "test", "unknown", "opening", "running", "closing"] as const;

export function mergeAllReports(reports: readonly WriterReport[]): AllReportsView {
  const notes = new Map<string, string[]>();
  const take = <T extends AutoItem>(pick: (s: AutoSnapshot) => readonly T[]): T[] => {
    const m = mergeList(
      reports.map((r) => ({
        name: r.writer.name,
        list: pick(r.snapshot),
        overrides: r.detail.overrides,
      })),
    );
    for (const [k, v] of m.notes) notes.set(k, [...(notes.get(k) ?? []), ...v]);
    return m.items;
  };
  const base = emptySnapshot();
  const application = { ...base.application };
  for (const g of APP_GROUPS) application[g] = byAt(take((s) => s.application[g]));
  application.devStatusCollected = reports.some(
    (r) => r.snapshot.application.devStatusCollected,
  );
  const snapshot: AutoSnapshot = {
    ...base,
    computedAt: reports[0]?.snapshot.computedAt ?? base.computedAt,
    application,
    pims: {
      thisWeek: byAt(take((s) => s.pims.thisWeek)),
      nextWeek: byAt(take((s) => s.pims.nextWeek)),
    },
    leave: byStart(take((s) => s.leave)),
    // 안 붙은 서비스는 작성자와 무관한 전역 값이다 — 아무 보고서의 값이나 같다.
    unmatched: reports[0]?.snapshot.unmatched ?? base.unmatched,
  };
  const overrides = new Map<string, ItemOverride>(
    [...notes].map(([key, list]) => [key, { item_key: key, note: list.join(" · "), excluded: false }]),
  );
  const manual: ManualItem[] = reports.flatMap((r) =>
    r.detail.manual.map((m) => ({ ...m, owner: r.writer.name })),
  );
  const emptyNotes = Object.fromEntries(
    AREAS.map((a) => [a, { thisWeek: "", nextWeek: "" }]),
  ) as ReportDetail["notes"];
  const byArea = Object.fromEntries(
    AREAS.map((a) => [
      a,
      reports
        .map((r) => ({ name: r.writer.name, ...r.detail.notes[a] }))
        .filter((n) => n.thisWeek.trim() !== "" || n.nextWeek.trim() !== ""),
    ]),
  ) as Record<Area, AreaNoteByWriter[]>;
  return {
    snapshot,
    detail: {
      notes: emptyNotes,
      overrides,
      manual,
      projects: reports.flatMap((r) => r.detail.projects),
    },
    notes: byArea,
    kpis: computeKpis(snapshot, overrides, manual),
  };
}
