import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeAdmin } from "./fake-admin";

vi.mock("server-only", () => ({}));

let db: ReturnType<typeof fakeAdmin>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => db.client,
}));

import {
  ensureReport,
  listPendingWriters,
  listReports,
} from "../report-queries";

const WEEK_BASE = {
  label_year: 2026,
  label_month: 11,
  duty_email: null,
  summary_this: "",
  summary_next: "",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const WEEK_1109 = {
  ...WEEK_BASE,
  id: "w0",
  week_start: "2026-11-09",
  label_week: 2,
  status: "reported",
};
const WEEK_1116 = {
  ...WEEK_BASE,
  id: "w1",
  week_start: "2026-11-16",
  label_week: 3,
  status: "open",
};
const op = (email: string, name: string) => ({
  email,
  name,
  team: "운영1팀",
  role: "사원",
  status: "active",
});
const W1 = op("w1@example.com", "운영자A");
const W3 = op("w3@example.com", "운영자C");

const ENSURE_TABLES = () => ({
  ops_weekly_weeks: [WEEK_1109, WEEK_1116],
  ops_weekly_reports: [
    {
      id: "r0",
      week_id: "w0",
      operator_email: "a@x",
      status: "submitted",
      snapshot: null,
      checked_tabs: [],
    },
  ],
  ops_weekly_project_owners: [
    { project_id: "p1", operator_email: "a@x" },
    { project_id: "p2", operator_email: "a@x" },
    { project_id: "p3", operator_email: "b@x" },
  ],
  ops_weekly_projects: [
    { id: "p1", active: true },
    { id: "p2", active: false },
    { id: "p3", active: true },
  ],
  ops_weekly_project_entries: [
    {
      id: "e0",
      report_id: "r0",
      project_id: "p1",
      stage: "설계",
      this_week: "",
      next_week: "개발 착수",
    },
  ],
});
const entryInserts = () =>
  db.spies.insert.mock.calls.filter(
    ([t]) => t === "ops_weekly_project_entries",
  );

beforeEach(() => {
  db = fakeAdmin({});
});

describe("ensureReport", () => {
  it("맡은 활성 프로젝트만, 지난주 같은 (프로젝트, 운영자) 값으로 채운다", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    const rep = await ensureReport("w1", "a@x");
    expect(rep).toMatchObject({
      week_id: "w1",
      operator_email: "a@x",
      status: "draft",
    });
    expect(db.spies.insert).toHaveBeenCalledWith("ops_weekly_project_entries", [
      {
        report_id: rep.id,
        project_id: "p1",
        stage: "설계",
        this_week: "개발 착수",
        next_week: "",
      },
    ]);
  });

  it("두 번 불러도 entry 는 한 번만 넣는다(멱등)", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    await ensureReport("w1", "a@x");
    await ensureReport("w1", "a@x");
    expect(entryInserts()).toHaveLength(1);
    expect(
      db.rows("ops_weekly_reports").filter((r) => r.week_id === "w1"),
    ).toHaveLength(1);
  });

  it("지난주 주 행이 없으면 빈 값으로 채운다", async () => {
    db = fakeAdmin({ ...ENSURE_TABLES(), ops_weekly_weeks: [WEEK_1116] });
    const rep = await ensureReport("w1", "a@x");
    expect(db.spies.insert).toHaveBeenCalledWith("ops_weekly_project_entries", [
      {
        report_id: rep.id,
        project_id: "p1",
        stage: null,
        this_week: "",
        next_week: "",
      },
    ]);
  });

  it("지난주 보고서가 없는 운영자는 빈 값으로 채운다", async () => {
    db = fakeAdmin({
      ...ENSURE_TABLES(),
      ops_weekly_project_owners: [{ project_id: "p3", operator_email: "b@x" }],
    });
    const rep = await ensureReport("w1", "b@x");
    expect(entryInserts()[0][1]).toEqual([
      {
        report_id: rep.id,
        project_id: "p3",
        stage: null,
        this_week: "",
        next_week: "",
      },
    ]);
  });

  it("담당 프로젝트가 없으면 entry 를 넣지 않는다", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    await ensureReport("w1", "nobody@x");
    expect(entryInserts()).toHaveLength(0);
  });

  it("동시 첫 접근 — 보고서 행을 다른 요청이 먼저 만들었어도 그 행을 쓴다", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    db.spies.upsert.mockImplementationOnce(() => {
      db.rows("ops_weekly_reports").push({
        id: "winner",
        week_id: "w1",
        operator_email: "a@x",
        status: "draft",
        snapshot: null,
        checked_tabs: [],
        submitted_at: null,
        returned_at: null,
        returned_by: null,
        return_reason: null,
      });
    });
    const rep = await ensureReport("w1", "a@x");
    expect(rep.id).toBe("winner");
    expect(
      db.rows("ops_weekly_reports").filter((r) => r.week_id === "w1"),
    ).toHaveLength(1);
  });

  it("동시 첫 접근 — entry 중복(23505)은 다른 요청이 채운 것이니 넘어간다", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    db.failNextWrite("ops_weekly_project_entries", "duplicate", "23505");
    await expect(ensureReport("w1", "a@x")).resolves.toMatchObject({
      week_id: "w1",
    });
  });

  it("entry 삽입의 다른 에러는 던진다", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    db.failNextWrite("ops_weekly_project_entries", "disk", "XX000");
    await expect(ensureReport("w1", "a@x")).rejects.toThrow(
      "[ops-weekly] ops_weekly_project_entries: disk",
    );
  });

  it("대소문자가 달라도 보고서 행은 하나다(저장은 소문자)", async () => {
    db = fakeAdmin(ENSURE_TABLES());
    const a = await ensureReport("w1", " A@Example.com ");
    const b = await ensureReport("w1", "a@example.com");
    expect(b.id).toBe(a.id);
    expect(a.operator_email).toBe("a@example.com");
    expect(
      db.rows("ops_weekly_reports").filter((r) => r.week_id === "w1"),
    ).toHaveLength(1);
  });

  it("주 행이 없으면 던진다", async () => {
    db = fakeAdmin({ ops_weekly_weeks: [] });
    await expect(ensureReport("ghost", "a@x")).rejects.toThrow("[ops-weekly]");
  });

  it("스냅샷이 옛 버전이면 null 로 읽는다", async () => {
    db = fakeAdmin({
      ...ENSURE_TABLES(),
      ops_weekly_reports: [
        {
          id: "r1",
          week_id: "w1",
          operator_email: "a@x",
          status: "draft",
          snapshot: { version: 0 },
          checked_tabs: [],
          submitted_at: null,
          returned_at: null,
          returned_by: null,
          return_reason: null,
        },
      ],
    });
    expect((await ensureReport("w1", "a@x")).snapshot).toBeNull();
  });
});

describe("listReports / listPendingWriters", () => {
  const tables = () => ({
    operators: [W1, W3],
    ops_weekly_settings: [{ id: true, excluded_writer_emails: [] }],
    ops_weekly_reports: [
      {
        id: "r1",
        week_id: "w1",
        operator_email: W1.email,
        status: "submitted",
      },
      {
        id: "rx",
        week_id: "w0",
        operator_email: W3.email,
        status: "submitted",
      },
      { id: "r3", week_id: "w1", operator_email: "z@x", status: "draft" },
    ],
  });

  it("보고서 행이 없는 사람도 미제출, 다른 주 제출은 안 친다", async () => {
    db = fakeAdmin(tables());
    expect((await listPendingWriters("w1")).map((w) => w.email)).toEqual([
      W3.email,
    ]);
  });

  it("operators.email 이 대문자 섞여 있어도 제출한 사람은 미제출이 아니다", async () => {
    db = fakeAdmin({
      ...tables(),
      operators: [{ ...W1, email: "W1@Example.com" }, W3],
    });
    expect((await listPendingWriters("w1")).map((w) => w.email)).toEqual([
      W3.email,
    ]);
  });

  it("draft·returned 보고서의 작성자도 미제출", async () => {
    db = fakeAdmin({
      ...tables(),
      ops_weekly_reports: [
        {
          id: "r1",
          week_id: "w1",
          operator_email: W1.email,
          status: "returned",
        },
      ],
    });
    expect((await listPendingWriters("w1")).map((w) => w.email)).toEqual([
      W1.email,
      W3.email,
    ]);
  });

  it("명단·보고서 조회 에러를 던진다", async () => {
    db = fakeAdmin(tables());
    db.failTable("ops_weekly_reports", "r");
    await expect(listPendingWriters("w1")).rejects.toThrow(
      "[ops-weekly] ops_weekly_reports: r",
    );
  });

  it("listReports — 그 주 보고서만", async () => {
    db = fakeAdmin({
      ops_weekly_reports: [
        { id: "r1", week_id: "w1", operator_email: "a@x", status: "draft" },
        { id: "rx", week_id: "w0", operator_email: "a@x", status: "draft" },
      ].map((r) => ({
        ...r,
        snapshot: null,
        checked_tabs: [],
        submitted_at: null,
        returned_at: null,
        returned_by: null,
        return_reason: null,
      })),
    });
    expect((await listReports("w1")).map((r) => r.id)).toEqual(["r1"]);
  });
});
