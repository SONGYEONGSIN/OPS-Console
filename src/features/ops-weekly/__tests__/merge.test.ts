import { describe, it, expect } from "vitest";
import type { AutoItem } from "../auto-lists/application";
import type { LeaveItem } from "../auto-lists/leave";
import {
  applyOverrides,
  autoSnapshotSchema,
  computeKpis,
  groupEntriesByProject,
  type AutoSnapshot,
  type ItemOverride,
  type ManualItem,
  type ProjectEntryView,
} from "../merge";

const ai = (key: string): AutoItem => ({
  key,
  title: "대학A",
  subtitle: "수시",
  at: null,
});

const ov = (key: string, excluded: boolean, note = ""): ItemOverride => ({
  item_key: key,
  note,
  excluded,
});

function leaveItem(key: string, over: Partial<LeaveItem> = {}): LeaveItem {
  return {
    ...ai(key),
    family: "leave",
    kindLabel: "휴가",
    startYmd: "2026-11-16",
    endYmd: "2026-11-16",
    substituteName: null,
    sources: ["backup"],
    needsBackup: false,
    ...over,
  };
}

function snapshot(
  over: {
    dev?: string[];
    test?: string[];
    opening?: string[];
    running?: string[];
    closing?: string[];
    pimsThis?: string[];
    pimsNext?: string[];
    leave?: string[];
    devStatusCollected?: boolean;
  } = {},
): AutoSnapshot {
  const list = (keys: string[] = []) => keys.map(ai);
  return {
    version: 1,
    computedAt: "2026-11-16T00:00:00.000Z",
    application: {
      dev: list(over.dev),
      test: list(over.test),
      unknown: [],
      opening: list(over.opening),
      running: list(over.running),
      closing: list(over.closing),
      devStatusCollected: over.devStatusCollected ?? false,
    },
    pims: { thisWeek: list(over.pimsThis), nextWeek: list(over.pimsNext) },
    leave: (over.leave ?? []).map((k) => leaveItem(k)),
    unmatched: { application: 0, pims: 0 },
  };
}

const manual = (area: ManualItem["area"], group_key: string): ManualItem => ({
  id: `m-${area}-${group_key}`,
  area,
  group_key,
  title: "직접 추가",
  note: "",
  period_start: null,
  period_end: null,
  leave_kind: null,
});

const entry = (
  projectId: string,
  sortOrder: number,
  operatorName: string,
): ProjectEntryView => ({
  projectId,
  projectName: `프로젝트 ${projectId}`,
  kind: "project",
  sortOrder,
  operatorEmail: "a@example.com",
  operatorName,
  stage: null,
  thisWeek: "",
  nextWeek: "",
});

describe("applyOverrides", () => {
  it("빼기는 남기되 표시만 바꾸고, 메모를 붙인다", () => {
    const v = applyOverrides(
      [ai("closing:1"), ai("closing:2")],
      new Map([["closing:2", ov("closing:2", true, "연기")]]),
    );
    expect(v.map((x) => [x.key, x.excluded, x.note])).toEqual([
      ["closing:1", false, ""],
      ["closing:2", true, "연기"],
    ]);
  });

  it("빼기는 휴가 항목에도 걸린다 — 제네릭이라 기간 칸이 남는다", () => {
    const [v] = applyOverrides(
      [leaveItem("leave:br:b1", { startYmd: "2026-11-18" })],
      new Map([["leave:br:b1", ov("leave:br:b1", false, "오전만")]]),
    );
    expect([v.key, v.note, v.excluded, v.startYmd]).toEqual([
      "leave:br:b1",
      "오전만",
      false,
      "2026-11-18",
    ]);
  });
});

describe("computeKpis", () => {
  it("뺀 건 제외 + 직접 추가 포함 + 수집 전 개발/테스트는 null", () => {
    const snap = snapshot({
      opening: ["closing:1", "closing:2"],
      running: ["closing:3"],
      pimsThis: ["pims:1"],
      pimsNext: ["pims:2"],
    });
    const k = computeKpis(
      snap,
      new Map([["closing:2", ov("closing:2", true)]]),
      [manual("application", "running"), manual("application", "test")],
    );
    expect(k).toEqual({
      dev: null,
      test: 1,
      opening: 1,
      running: 2,
      closing: 0,
      pims: 2,
      scoreCalc: null,
      leave: 0,
    });
  });

  it("수집됐는데 0건이면 null 이 아니라 0", () => {
    const k = computeKpis(
      snapshot({ devStatusCollected: true }),
      new Map(),
      [],
    );
    expect(k.dev).toBe(0);
    expect(k.test).toBe(0);
  });

  it("합격자 발표는 금주·차주를 합쳐 세고(뺀 건 제외), 직접 추가를 더한다", () => {
    const k = computeKpis(
      snapshot({ pimsThis: ["pims:1", "pims:2"], pimsNext: ["pims:3"] }),
      new Map([["pims:2", ov("pims:2", true)]]),
      [manual("pims", "thisWeek"), manual("pims", "nextWeek")],
    );
    expect(k.pims).toBe(4);
  });

  it("휴가·외근은 탭 제목과 같이 뺀 건도 세고 직접 추가를 더한다", () => {
    const k = computeKpis(
      snapshot({ leave: ["leave:br:1", "leave:br:2"] }),
      new Map([["leave:br:2", ov("leave:br:2", true)]]),
      [manual("leave", "leave:br")],
    );
    expect(k.leave).toBe(3);
  });
});

describe("autoSnapshotSchema", () => {
  it("스냅샷 스키마가 버전을 지킨다", () => {
    expect(
      autoSnapshotSchema.safeParse({ ...snapshot(), version: 2 }).success,
    ).toBe(false);
  });

  it("대학구분·카테고리는 굳힌 값에 남고, 없던 예전 스냅샷도 통과한다", () => {
    const base = snapshot({ dev: ["closing:1"] });
    const withCols = {
      ...base,
      application: {
        ...base.application,
        dev: [
          {
            ...base.application.dev[0],
            universityType: "4년제",
            category: "수시",
          },
        ],
      },
    };
    const parsed = autoSnapshotSchema.parse(withCols);
    expect(parsed.application.dev[0]).toMatchObject({
      universityType: "4년제",
      category: "수시",
    });
    expect(autoSnapshotSchema.safeParse(base).success).toBe(true);
  });

  it("휴가 항목의 기간 칸까지 검사한다", () => {
    const ok = { ...snapshot(), leave: [leaveItem("leave:br:b1")] };
    expect(autoSnapshotSchema.safeParse(ok).success).toBe(true);
    const bad = { ...ok, leave: [{ ...ok.leave[0], startYmd: undefined }] };
    expect(autoSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});

describe("groupEntriesByProject", () => {
  it("프로젝트를 항목 → 담당자로 묶는다", () => {
    const g = groupEntriesByProject([
      entry("p2", 20, "운영자B"),
      entry("p1", 10, "운영자B"),
      entry("p1", 10, "운영자A"),
    ]);
    expect(
      g.map((x) => [x.projectId, x.owners.map((o) => o.operatorName)]),
    ).toEqual([
      ["p1", ["운영자A", "운영자B"]],
      ["p2", ["운영자B"]],
    ]);
  });
});
