import { describe, it, expect, vi } from "vitest";
import { fakeAdmin } from "./fake-admin";

vi.mock("server-only", () => ({}));

let db: ReturnType<typeof fakeAdmin>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => db.client,
}));

import { listProjectEntriesForWeek, loadReportDetail } from "../report-queries";

const op = (email: string, name: string) => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});
const W1 = op("w1@example.com", "운영자A");
const W3 = op("w3@example.com", "운영자C");

describe("loadReportDetail / listProjectEntriesForWeek", () => {
  const detailTables = () => ({
    operators: [W1, { ...W3, name: " 운영자C " }],
    ops_weekly_reports: [
      { id: "r1", week_id: "w1", operator_email: W1.email },
      { id: "r2", week_id: "w1", operator_email: W3.email },
      { id: "rx", week_id: "w0", operator_email: W1.email },
    ],
    ops_weekly_projects: [
      {
        id: "p1",
        name: "프로젝트B",
        kind: "project",
        sort_order: 2,
        active: true,
      },
      { id: "p2", name: "프로젝트A", kind: "tf", sort_order: 1, active: true },
    ],
    ops_weekly_project_entries: [
      {
        id: "e1",
        report_id: "r1",
        project_id: "p1",
        stage: "개발",
        this_week: "a",
        next_week: "b",
      },
      {
        id: "e2",
        report_id: "r2",
        project_id: "p2",
        stage: null,
        this_week: "c",
        next_week: "d",
      },
      {
        id: "ex",
        report_id: "rx",
        project_id: "p1",
        stage: null,
        this_week: "old",
        next_week: "",
      },
    ],
    ops_weekly_area_notes: [
      { report_id: "r1", area: "pims", this_week: "t", next_week: "n" },
      { report_id: "r2", area: "leave", this_week: "other", next_week: "" },
    ],
    ops_weekly_item_overrides: [
      {
        report_id: "r1",
        item_key: "k1",
        area: "pims",
        note: "메모",
        excluded: true,
      },
      {
        report_id: "r2",
        item_key: "k2",
        area: "pims",
        note: "",
        excluded: false,
      },
    ],
    ops_weekly_manual_items: [
      {
        id: "m1",
        report_id: "r1",
        area: "leave",
        group_key: null,
        title: "직접",
        note: "",
        period_start: null,
        period_end: null,
        leave_kind: null,
      },
      {
        id: "m2",
        report_id: "r2",
        area: "leave",
        group_key: null,
        title: "남의것",
        note: "",
        period_start: null,
        period_end: null,
        leave_kind: null,
      },
    ],
  });

  it("loadReportDetail — 그 보고서의 것만, 영역 메모는 빈 칸까지 채운다", async () => {
    db = fakeAdmin(detailTables());
    const d = await loadReportDetail("r1");
    expect(d.notes.pims).toEqual({ thisWeek: "t", nextWeek: "n" });
    expect(d.notes.leave).toEqual({ thisWeek: "", nextWeek: "" });
    expect([...d.overrides.keys()]).toEqual(["k1"]);
    expect(d.overrides.get("k1")).toEqual({
      item_key: "k1",
      note: "메모",
      excluded: true,
    });
    expect(d.manual.map((m) => m.id)).toEqual(["m1"]);
    expect(d.projects).toEqual([
      {
        projectId: "p1",
        projectName: "프로젝트B",
        kind: "project",
        sortOrder: 2,
        operatorEmail: W1.email,
        operatorName: "운영자A",
        stage: "개발",
        thisWeek: "a",
        nextWeek: "b",
      },
    ]);
  });

  it("loadReportDetail — 보고서가 없으면 던진다", async () => {
    db = fakeAdmin(detailTables());
    await expect(loadReportDetail("nope")).rejects.toThrow("[ops-weekly]");
  });

  it("listProjectEntriesForWeek — 그 주 전체, 정렬 순서·이름 다듬기", async () => {
    db = fakeAdmin(detailTables());
    const list = await listProjectEntriesForWeek("w1");
    expect(list.map((e) => [e.projectName, e.operatorName])).toEqual([
      ["프로젝트A", "운영자C"],
      ["프로젝트B", "운영자A"],
    ]);
  });

  it("viewsOf — 대소문자가 다른 operators.email 도 이름으로 보인다", async () => {
    const t = detailTables();
    db = fakeAdmin({
      ...t,
      operators: [{ ...W1, email: "W1@EXAMPLE.com" }, t.operators[1]],
    });
    const list = await listProjectEntriesForWeek("w1");
    expect(list.map((e) => e.operatorName)).toEqual(["운영자C", "운영자A"]);
  });

  it("listProjectEntriesForWeek — 보고서가 없으면 빈 배열", async () => {
    db = fakeAdmin({});
    expect(await listProjectEntriesForWeek("w1")).toEqual([]);
  });
});
