import { describe, expect, it } from "vitest";
import type { AutoItem } from "../auto-lists/application";
import type { LeaveItem } from "../auto-lists/leave";
import { mergeAllReports, type WriterReport } from "../all-view";
import { AREAS } from "../constants";
import type { AutoSnapshot, ItemOverride, ManualItem } from "../merge";
import type { ReportDetail } from "../report-queries";

const ai = (key: string, at: string | null = null, title = key): AutoItem => ({
  key,
  title,
  subtitle: `부${key}`,
  at,
});

function snap(over: Partial<AutoSnapshot["application"]> = {}, extra: Partial<AutoSnapshot> = {}): AutoSnapshot {
  return {
    version: 1,
    computedAt: "2026-11-18T00:00:00.000Z",
    application: {
      dev: [],
      test: [],
      unknown: [],
      opening: [],
      running: [],
      closing: [],
      devStatusCollected: true,
      ...over,
    },
    pims: { thisWeek: [], nextWeek: [] },
    leave: [],
    unmatched: { application: 2, pims: 0 },
    ...extra,
  };
}

function detail(over: Partial<ReportDetail> = {}): ReportDetail {
  return {
    notes: Object.fromEntries(
      AREAS.map((a) => [a, { thisWeek: "", nextWeek: "" }]),
    ) as ReportDetail["notes"],
    overrides: new Map<string, ItemOverride>(),
    manual: [],
    projects: [],
    ...over,
  };
}

const manual = (id: string, title: string): ManualItem => ({
  id,
  area: "application",
  group_key: "running",
  title,
  note: "",
  period_start: null,
  period_end: null,
  leave_kind: null,
});

const w = (name: string, s: AutoSnapshot, d: ReportDetail = detail()): WriterReport => ({
  writer: { email: `${name}@x`, name },
  snapshot: s,
  detail: d,
});

describe("mergeAllReports", () => {
  it("같은 서비스를 여럿이 맡으면 한 행으로 합치고 담당자를 모은다", () => {
    const v = mergeAllReports([
      w("가", snap({ running: [ai("closing:1", "2026-11-11T00:00:00Z")] })),
      w("나", snap({ running: [ai("closing:1", "2026-11-11T00:00:00Z"), ai("closing:2", "2026-11-10T00:00:00Z")] })),
    ]);
    expect(v.snapshot.application.running.map((i) => [i.key, i.owners])).toEqual([
      ["closing:2", ["나"]],
      ["closing:1", ["가", "나"]],
    ]);
    expect(v.kpis.running).toBe(2);
  });

  it("그 사람이 뺀 건은 그 사람 담당에서만 빠진다 — 아무도 안 남으면 행이 없다", () => {
    const excl = (key: string) =>
      new Map([[key, { item_key: key, note: "", excluded: true }]]);
    const v = mergeAllReports([
      w("가", snap({ running: [ai("closing:1"), ai("closing:3")] }), detail({ overrides: excl("closing:1") })),
      w("나", snap({ running: [ai("closing:1")] })),
      w("다", snap({ running: [ai("closing:3")] }), detail({ overrides: excl("closing:3") })),
    ]);
    const owners = new Map(v.snapshot.application.running.map((i) => [i.key, i.owners]));
    expect(owners.get("closing:1")).toEqual(["나"]);
    expect(owners.get("closing:3")).toEqual(["가"]);
  });

  it("건 메모는 '이름: 메모' 로 모은다", () => {
    const note = (key: string, text: string) =>
      new Map([[key, { item_key: key, note: text, excluded: false }]]);
    const v = mergeAllReports([
      w("가", snap({ running: [ai("closing:1")] }), detail({ overrides: note("closing:1", "연장") })),
      w("나", snap({ running: [ai("closing:1")] }), detail({ overrides: note("closing:1", "확인함") })),
    ]);
    expect(v.detail.overrides.get("closing:1")).toEqual({
      item_key: "closing:1",
      note: "가: 연장 · 나: 확인함",
      excluded: false,
    });
  });

  it("직접 추가 건은 전원 것을 담고 담당자를 붙인다", () => {
    const v = mergeAllReports([
      w("가", snap(), detail({ manual: [manual("m1", "수동1")] })),
      w("나", snap(), detail({ manual: [manual("m2", "수동2")] })),
    ]);
    expect(v.detail.manual.map((m) => [m.title, m.owner])).toEqual([
      ["수동1", "가"],
      ["수동2", "나"],
    ]);
    expect(v.kpis.running).toBe(2);
  });

  it("영역 특이사항은 쓴 사람만 이름과 함께", () => {
    const d = detail();
    const withNote = {
      ...d,
      notes: { ...d.notes, application: { thisWeek: "금주 메모", nextWeek: "" } },
    };
    const v = mergeAllReports([w("가", snap(), withNote), w("나", snap())]);
    expect(v.notes.application).toEqual([
      { name: "가", thisWeek: "금주 메모", nextWeek: "" },
    ]);
    expect(v.notes.pims).toEqual([]);
  });

  it("휴가는 사람별 항목이라 그대로 모으고 담당자를 붙인다", () => {
    const leave = (key: string, startYmd: string): LeaveItem => ({
      ...ai(key),
      family: "leave",
      kindLabel: "연차",
      startYmd,
      endYmd: startYmd,
      substituteName: null,
      sources: ["schedule"],
      needsBackup: false,
    });
    const v = mergeAllReports([
      w("가", snap({}, { leave: [leave("leave:s:1", "2026-11-20")] })),
      w("나", snap({}, { leave: [leave("leave:s:2", "2026-11-17")] })),
    ]);
    expect(v.snapshot.leave.map((l) => [l.key, l.owners])).toEqual([
      ["leave:s:2", ["나"]],
      ["leave:s:1", ["가"]],
    ]);
  });

  it("구분 수집 여부는 하나라도 수집됐으면 수집됨, 프로젝트 항목은 전원 것", () => {
    const entry = (name: string) => ({
      projectId: "p1",
      projectName: "PIMS",
      kind: "project" as const,
      sortOrder: 1,
      operatorEmail: `${name}@x`,
      operatorName: name,
      stage: null,
      thisWeek: "",
      nextWeek: "",
    });
    const v = mergeAllReports([
      w("가", snap({ devStatusCollected: false }), detail({ projects: [entry("가")] })),
      w("나", snap({ devStatusCollected: true }), detail({ projects: [entry("나")] })),
    ]);
    expect(v.snapshot.application.devStatusCollected).toBe(true);
    expect(v.detail.projects.map((p) => p.operatorName)).toEqual(["가", "나"]);
  });

  it("아무도 없으면 빈 화면", () => {
    const v = mergeAllReports([]);
    expect(v.snapshot.application.running).toEqual([]);
    expect(v.kpis.running).toBe(0);
  });
});
