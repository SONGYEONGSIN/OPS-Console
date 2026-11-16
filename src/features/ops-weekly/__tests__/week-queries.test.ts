import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeAdmin } from "./fake-admin";

vi.mock("server-only", () => ({}));

let db: ReturnType<typeof fakeAdmin>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => db.client,
}));

import { ensureWeek, getWeek, getWeekById, listWriters } from "../week-queries";

const WEEK_1116 = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: null,
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const op = (email: string, team = "운영1팀", role = "사원") => ({
  email,
  name: ` 이름-${email} `,
  team,
  role,
  status: "active",
});
const W1 = op("w1@example.com");
const W2_TEST = op("w2@example.com", "운영2팀");
const NOW = new Date("2026-11-18T01:00:00Z");
const SETTINGS = (anchor: string | null) => [
  { id: true, rotation_anchor_week: anchor, excluded_writer_emails: [] },
];

beforeEach(() => {
  db = fakeAdmin({});
});

describe("listWriters", () => {
  it("조회 에러를 던진다(빈 명단으로 최종 보고가 켜지지 않게)", async () => {
    db = fakeAdmin({ operators: [] });
    db.failTable("operators", "x");
    await expect(listWriters()).rejects.toThrow("[ops-weekly] operators: x");
  });

  it("설정 조회 에러도 던진다", async () => {
    db = fakeAdmin({ operators: [W1] });
    db.failTable("ops_weekly_settings", "y");
    await expect(listWriters()).rejects.toThrow(
      "[ops-weekly] ops_weekly_settings: y",
    );
  });

  it("settings 제외 목록·팀·역할·상태를 반영하고 이름을 다듬는다", async () => {
    db = fakeAdmin({
      operators: [
        W1,
        W2_TEST,
        op("boss@example.com", "운영1팀", "팀장"),
        op("other@example.com", "개발팀"),
        { ...op("off@example.com"), status: "inactive" },
      ],
      ops_weekly_settings: [
        { id: true, excluded_writer_emails: [W2_TEST.email] },
      ],
    });
    const got = await listWriters();
    expect(got.map((w) => w.email)).toEqual([W1.email]);
    expect(got[0].name).toBe(`이름-${W1.email}`);
  });

  it("settings 행이 없으면 제외 없이 읽는다", async () => {
    db = fakeAdmin({ operators: [W1] });
    expect((await listWriters()).map((w) => w.email)).toEqual([W1.email]);
  });
});

describe("getWeek / getWeekById", () => {
  it("없으면 null, 있으면 행", async () => {
    db = fakeAdmin({ ops_weekly_weeks: [WEEK_1116] });
    expect(await getWeek("2026-11-09")).toBeNull();
    expect((await getWeek("2026-11-16"))?.id).toBe("w1");
    expect((await getWeekById("w1"))?.week_start).toBe("2026-11-16");
    expect(await getWeekById("nope")).toBeNull();
  });

  it("조회 에러를 던진다", async () => {
    db = fakeAdmin({});
    db.failTable("ops_weekly_weeks", "z");
    await expect(getWeek("2026-11-16")).rejects.toThrow(
      "[ops-weekly] ops_weekly_weeks: z",
    );
  });
});

describe("ensureWeek", () => {
  it("이번 주는 만들고 라벨·당번을 채운다", async () => {
    db = fakeAdmin({
      ops_weekly_weeks: [],
      ops_weekly_duty_rotation: [{ position: 0, operator_email: "a@x" }],
      ops_weekly_settings: SETTINGS("2026-11-16"),
    });
    const w = await ensureWeek("2026-11-16", NOW);
    expect(db.spies.upsert).toHaveBeenCalledWith(
      "ops_weekly_weeks",
      expect.objectContaining({
        week_start: "2026-11-16",
        label_year: 2026,
        label_month: 11,
        label_week: 3,
        duty_email: "a@x",
      }),
      { onConflict: "week_start", ignoreDuplicates: true },
    );
    expect(w?.week_start).toBe("2026-11-16");
  });

  it("이번 주가 보고 전이면 다음 주는 만들지 않는다", async () => {
    db = fakeAdmin({ ops_weekly_weeks: [WEEK_1116] });
    expect(await ensureWeek("2026-11-23", NOW)).toBeNull();
    expect(db.spies.upsert).not.toHaveBeenCalled();
  });

  it("이번 주가 보고됐으면 다음 주를 만든다", async () => {
    db = fakeAdmin({
      ops_weekly_weeks: [{ ...WEEK_1116, status: "reported" }],
      ops_weekly_duty_rotation: [],
      ops_weekly_settings: SETTINGS(null),
    });
    expect((await ensureWeek("2026-11-23", NOW))?.week_start).toBe(
      "2026-11-23",
    );
    expect(db.spies.upsert).toHaveBeenCalledWith(
      "ops_weekly_weeks",
      expect.objectContaining({ week_start: "2026-11-23", duty_email: null }),
      expect.anything(),
    );
  });

  it("월요일이 아닌 값은 null", async () => {
    expect(await ensureWeek("2026-11-17")).toBeNull();
  });

  it("지난 주·먼 미래 주는 만들지 않는다", async () => {
    db = fakeAdmin({ ops_weekly_weeks: [WEEK_1116] });
    expect(await ensureWeek("2026-11-09", NOW)).toBeNull();
    expect(await ensureWeek("2026-11-30", NOW)).toBeNull();
    expect(db.spies.upsert).not.toHaveBeenCalled();
  });

  it("이미 있으면 upsert 하지 않고 그 행을 돌려준다", async () => {
    db = fakeAdmin({ ops_weekly_weeks: [{ ...WEEK_1116, duty_email: "d@x" }] });
    expect((await ensureWeek("2026-11-16", NOW))?.duty_email).toBe("d@x");
    expect(db.spies.upsert).not.toHaveBeenCalled();
    expect(db.spies.update).not.toHaveBeenCalled();
  });

  it("이미 있고 당번이 비었으며 순번표가 있으면 채운다", async () => {
    db = fakeAdmin({
      ops_weekly_weeks: [WEEK_1116],
      ops_weekly_duty_rotation: [{ position: 0, operator_email: "a@x" }],
      ops_weekly_settings: SETTINGS("2026-11-16"),
    });
    expect((await ensureWeek("2026-11-16", NOW))?.duty_email).toBe("a@x");
    expect(db.spies.update).toHaveBeenCalledWith("ops_weekly_weeks", {
      duty_email: "a@x",
    });
  });

  it("이미 있고 순번표가 없으면 그대로 둔다", async () => {
    db = fakeAdmin({ ops_weekly_weeks: [WEEK_1116] });
    expect((await ensureWeek("2026-11-16", NOW))?.duty_email).toBeNull();
    expect(db.spies.update).not.toHaveBeenCalled();
  });

  it("동시 첫 접근 — 그 사이 다른 요청이 행을 만들었으면 그 행을 돌려주고 중복을 만들지 않는다", async () => {
    db = fakeAdmin({
      ops_weekly_weeks: [],
      ops_weekly_duty_rotation: [{ position: 0, operator_email: "a@x" }],
      ops_weekly_settings: SETTINGS("2026-11-16"),
    });
    db.spies.upsert.mockImplementationOnce(() => {
      db.rows("ops_weekly_weeks").push({
        ...WEEK_1116,
        id: "other",
        duty_email: "winner@x",
      });
    });
    const w = await ensureWeek("2026-11-16", NOW);
    expect(w?.id).toBe("other");
    expect(db.rows("ops_weekly_weeks")).toHaveLength(1);
  });

  it("upsert 에러를 던진다", async () => {
    db = fakeAdmin({
      ops_weekly_settings: SETTINGS(null),
      ops_weekly_duty_rotation: [],
    });
    db.failNextWrite("ops_weekly_weeks", "w");
    await expect(ensureWeek("2026-11-16", NOW)).rejects.toThrow(
      "[ops-weekly] ops_weekly_weeks: w",
    );
  });
});
