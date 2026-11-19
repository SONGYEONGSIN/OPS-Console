import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock(
  "@/lib/supabase/admin",
  async () => (await import("./actions-fixture")).adminModule,
);

import {
  isRecipient,
  listRecipients,
  loadSettingsBundle,
} from "../settings-queries";
import { resetFixture, state } from "./actions-fixture";
import { fakeAdmin, type Row } from "./fake-admin";

function tables(t: Record<string, Row[]>) {
  state.db = fakeAdmin({
    ops_weekly_settings: [
      { id: true, excluded_writer_emails: [], rotation_anchor_week: null },
    ],
    ...t,
  });
}

beforeEach(() => {
  resetFixture();
});

describe("loadSettingsBundle", () => {
  it("운영자 명단에 없는 받는 사람은 not-operator", async () => {
    tables({
      ops_weekly_recipients: [{ email: "out@example.com" }],
      operators: [],
    });
    expect((await loadSettingsBundle()).recipients[0].warning).toBe(
      "not-operator",
    );
  });

  it("실제 행의 permission·allowed_menus 로 판정한다", async () => {
    tables({
      ops_weekly_recipients: [
        { email: "r@example.com" },
        { email: "s@example.com" },
      ],
      operators: [
        {
          email: "R@Example.com",
          name: "부서장A",
          status: "active",
          permission: "viewer",
          allowed_menus: [],
        },
        {
          email: "s@example.com",
          name: "부서장B",
          status: "inactive",
          permission: "member",
          allowed_menus: ["ops-weekly"],
        },
      ],
    });
    expect(
      (await loadSettingsBundle()).recipients.map((r) => [
        r.email,
        r.name,
        r.warning,
      ]),
    ).toEqual([
      ["r@example.com", "부서장A", null],
      ["s@example.com", "부서장B", "inactive"],
    ]);
  });

  it("후보는 제외를 반영하기 전 목록이고, 순번표·프로젝트·담당자를 묶는다", async () => {
    const op = (email: string): Row => ({
      email,
      name: "운영자A",
      team: "운영1팀",
      role: "사원",
      status: "active",
      permission: "member",
      allowed_menus: [],
    });
    tables({
      ops_weekly_settings: [
        {
          id: true,
          excluded_writer_emails: ["B@example.com"],
          rotation_anchor_week: "2026-11-16",
        },
      ],
      operators: [op("a@example.com"), op("b@example.com")],
      ops_weekly_duty_rotation: [
        { position: 1, operator_email: "b@example.com" },
        { position: 0, operator_email: "a@example.com" },
      ],
      ops_weekly_projects: [
        { id: "p2", name: "TF", kind: "tf", sort_order: 2, active: false },
        {
          id: "p1",
          name: "PIMS",
          kind: "project",
          sort_order: 1,
          active: true,
        },
      ],
      ops_weekly_project_owners: [
        { project_id: "p1", operator_email: "A@example.com" },
      ],
    });
    const b = await loadSettingsBundle();
    expect(b.writerCandidates.map((w) => w.email).sort()).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(b.excludedWriterEmails).toEqual(["b@example.com"]);
    expect(b.rotation).toEqual(["a@example.com", "b@example.com"]);
    expect(b.anchorWeekStart).toBe("2026-11-16");
    expect(b.projects).toEqual([
      {
        id: "p1",
        name: "PIMS",
        kind: "project",
        sortOrder: 1,
        active: true,
        owners: ["a@example.com"],
      },
      {
        id: "p2",
        name: "TF",
        kind: "tf",
        sortOrder: 2,
        active: false,
        owners: [],
      },
    ]);
  });

  it("쿼리 실패는 빈 목록이 아니라 던진다", async () => {
    tables({});
    state.db.failTable("ops_weekly_recipients", "boom");
    await expect(loadSettingsBundle()).rejects.toThrow(/ops_weekly_recipients/);
  });
});

describe("listRecipients", () => {
  it("정규화한 이메일 목록", async () => {
    tables({
      ops_weekly_recipients: [
        { email: "B@example.com" },
        { email: "a@example.com" },
      ],
    });
    expect(await listRecipients()).toEqual(["a@example.com", "b@example.com"]);
  });
});

describe("isRecipient", () => {
  it("isRecipient — 대소문자·공백을 맞춰 본인 하나만 대조, 조회 실패는 던진다", async () => {
    tables({ ops_weekly_recipients: [{ email: " R@X " }] });
    expect(await isRecipient("r@x")).toBe(true);
    expect(await isRecipient(" R@x ")).toBe(true);
    expect(await isRecipient("z@x")).toBe(false);
    state.db.failTable("ops_weekly_recipients", "boom");
    await expect(isRecipient("r@x")).rejects.toThrow(/ops_weekly_recipients/);
  });
});
