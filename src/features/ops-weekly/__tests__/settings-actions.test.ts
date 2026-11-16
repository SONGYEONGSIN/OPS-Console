import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock(
  "@/lib/supabase/admin",
  async () => (await import("./actions-fixture")).adminModule,
);
vi.mock(
  "@/features/auth/queries",
  async () => (await import("./actions-fixture")).authModule,
);

import {
  addRecipient,
  removeRecipient,
  saveExcludedWriters,
  saveRotation,
  setProjectOwners,
  setWeekDuty,
  upsertProject,
} from "../settings-actions";
import { me, P1, resetFixture, state, W } from "./actions-fixture";
import { fakeAdmin, type Row } from "./fake-admin";

const ADMIN_ONLY = {
  ok: false,
  error: "관리자만 설정할 수 있습니다.",
};

const writerRow = (email: string): Row => ({
  email,
  name: "운영자A",
  team: "운영1팀",
  role: "사원",
  status: "active",
});

function setup(extra: Record<string, Row[]> = {}) {
  state.db = fakeAdmin({
    operators: [],
    ops_weekly_settings: [
      { id: true, excluded_writer_emails: [], rotation_anchor_week: null },
    ],
    ...extra,
  });
}
const writers = (emails: string[]) =>
  setup({ operators: emails.map(writerRow) });

const weekRow = (over: Row = {}): Row => ({
  id: W,
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
  ...over,
});

beforeEach(() => {
  resetFixture();
  setup();
});

describe("권한", () => {
  it("admin 이 아니면 모두 거절", async () => {
    me("a@example.com", false);
    const results = [
      await addRecipient({ email: "r@example.com" }),
      await removeRecipient({ email: "r@example.com" }),
      await saveRotation({ emails: [], anchorWeekStart: null }),
      await saveExcludedWriters({ emails: [] }),
      await upsertProject({
        name: "A",
        kind: "project",
        sortOrder: 0,
        active: true,
      }),
      await setProjectOwners({ projectId: P1, emails: [] }),
      await setWeekDuty({ weekId: W, dutyEmail: "a@example.com" }),
    ];
    for (const r of results) expect(r).toEqual(ADMIN_ONLY);
    expect(state.db.spies.insert).not.toHaveBeenCalled();
    expect(state.db.spies.upsert).not.toHaveBeenCalled();
    expect(state.db.spies.rpc).not.toHaveBeenCalled();
  });
});

describe("받는 사람", () => {
  it("저장하고 메뉴 권한 경고를 돌려준다", async () => {
    me("z@example.com", true);
    setup({
      operators: [
        {
          email: "r@example.com",
          name: "부서장A",
          status: "inactive",
          permission: "member",
          allowed_menus: [],
        },
      ],
    });
    expect(await addRecipient({ email: " R@Example.com " })).toEqual({
      ok: true,
      warning: "inactive",
    });
    expect(state.db.rows("ops_weekly_recipients")).toEqual([
      expect.objectContaining({
        email: "r@example.com",
        created_by: "z@example.com",
      }),
    ]);
  });

  it("운영자 명단에 없으면 not-operator 경고", async () => {
    me("z@example.com", true);
    expect(await addRecipient({ email: "out@example.com" })).toEqual({
      ok: true,
      warning: "not-operator",
    });
  });

  it("이메일 형식이 아니면 거절", async () => {
    me("z@example.com", true);
    expect((await addRecipient({ email: "nope" })).ok).toBe(false);
  });

  it("저장 실패는 ok:false", async () => {
    me("z@example.com", true);
    state.db.failTable("ops_weekly_recipients", "boom");
    expect((await addRecipient({ email: "r@example.com" })).ok).toBe(false);
  });

  it("삭제는 정규화한 이메일로 한다", async () => {
    me("z@example.com", true);
    setup({
      ops_weekly_recipients: [{ email: "r@example.com", created_by: "z" }],
    });
    expect(await removeRecipient({ email: "R@example.com" })).toEqual({
      ok: true,
    });
    expect(state.db.rows("ops_weekly_recipients")).toEqual([]);
  });
});

describe("순번표", () => {
  it("명단 밖·중복·월요일 아닌 anchor 는 거절하고 순번표를 건드리지 않는다", async () => {
    me("z@example.com", true);
    writers(["a@example.com", "b@example.com"]);
    const bad = [
      await saveRotation({
        emails: ["a@example.com", "q@example.com"],
        anchorWeekStart: "2026-11-16",
      }),
      await saveRotation({
        emails: ["a@example.com", "A@example.com"],
        anchorWeekStart: "2026-11-16",
      }),
      await saveRotation({
        emails: ["a@example.com"],
        anchorWeekStart: "2026-11-17",
      }),
    ];
    for (const r of bad) expect(r.ok).toBe(false);
    expect(state.db.spies.rpc).not.toHaveBeenCalled();
  });

  it("순번표가 있는데 기준 주가 없으면 거절한다 — 모든 주 당번이 조용히 비지 않게", async () => {
    me("z@example.com", true);
    writers(["a@example.com"]);
    expect(
      await saveRotation({ emails: ["a@example.com"], anchorWeekStart: null }),
    ).toEqual({ ok: false, error: "순번표가 있으면 기준 주를 정하세요." });
    expect(state.db.spies.rpc).not.toHaveBeenCalled();
    expect(await saveRotation({ emails: [], anchorWeekStart: null })).toEqual({
      ok: true,
    });
  });

  it("rpc 한 번으로 교체하고 기준 주를 쓴다 — 클라이언트 delete 없음", async () => {
    me("z@example.com", true);
    writers(["a@example.com", "b@example.com"]);
    expect(
      await saveRotation({
        emails: ["b@example.com", "a@example.com"],
        anchorWeekStart: "2026-11-16",
      }),
    ).toEqual({ ok: true });
    expect(state.db.spies.rpc).toHaveBeenCalledTimes(1);
    expect(state.db.spies.rpc).toHaveBeenCalledWith(
      "ops_weekly_replace_rotation",
      { emails: ["b@example.com", "a@example.com"] },
    );
    expect(state.db.spies.update).toHaveBeenCalledWith(
      "ops_weekly_settings",
      expect.objectContaining({
        rotation_anchor_week: "2026-11-16",
        updated_by: "z@example.com",
      }),
    );
    expect(state.db.spies.delete).not.toHaveBeenCalled();
  });

  it("이미 만들어진 주의 duty_email 은 바꾸지 않는다", async () => {
    me("z@example.com", true);
    setup({
      operators: [writerRow("a@example.com")],
      ops_weekly_weeks: [weekRow({ duty_email: "old@example.com" })],
    });
    await saveRotation({
      emails: ["a@example.com"],
      anchorWeekStart: "2026-11-16",
    });
    expect(state.db.rows("ops_weekly_weeks")[0].duty_email).toBe(
      "old@example.com",
    );
  });

  it("rpc 에러면 저장 실패를 알리고 기준 주도 쓰지 않는다", async () => {
    me("z@example.com", true);
    writers(["a@example.com"]);
    state.db.spies.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    expect(
      await saveRotation({
        emails: ["a@example.com"],
        anchorWeekStart: "2026-11-16",
      }),
    ).toEqual({ ok: false, error: "순번표를 저장하지 못했습니다." });
    expect(state.db.spies.update).not.toHaveBeenCalled();
  });

  it("기준 주 쓰기가 실패하면 ok:false", async () => {
    me("z@example.com", true);
    writers(["a@example.com"]);
    state.db.failNextWrite("ops_weekly_settings", "boom");
    expect(
      (
        await saveRotation({
          emails: ["a@example.com"],
          anchorWeekStart: "2026-11-16",
        })
      ).ok,
    ).toBe(false);
  });
});

describe("작성 제외", () => {
  it("정규화·중복 제거해서 저장한다", async () => {
    me("z@example.com", true);
    expect(
      await saveExcludedWriters({
        emails: ["A@example.com", "a@example.com", "b@example.com"],
      }),
    ).toEqual({ ok: true });
    expect(
      state.db.rows("ops_weekly_settings")[0].excluded_writer_emails,
    ).toEqual(["a@example.com", "b@example.com"]);
  });
});

describe("프로젝트/TF", () => {
  const base = {
    kind: "project" as const,
    sortOrder: 1,
    active: true,
  };

  it("새 항목을 만든다(이름 trim)", async () => {
    me("z@example.com", true);
    expect(await upsertProject({ ...base, name: "  경쟁률  " })).toEqual({
      ok: true,
    });
    expect(state.db.rows("ops_weekly_projects")[0]).toMatchObject({
      name: "경쟁률",
      kind: "project",
      sort_order: 1,
      active: true,
    });
  });

  it("빈 이름·51자 이름은 거절", async () => {
    me("z@example.com", true);
    expect((await upsertProject({ ...base, name: "   " })).ok).toBe(false);
    expect((await upsertProject({ ...base, name: "가".repeat(51) })).ok).toBe(
      false,
    );
  });

  it("중복 이름은 거절, 자기 자신 이름으로 수정은 허용", async () => {
    me("z@example.com", true);
    setup({
      ops_weekly_projects: [
        { id: P1, name: "PIMS", kind: "project", sort_order: 0, active: true },
      ],
    });
    expect(await upsertProject({ ...base, name: "PIMS" })).toEqual({
      ok: false,
      error: "이미 있는 항목 이름입니다.",
    });
    expect(
      await upsertProject({ ...base, id: P1, name: "PIMS", active: false }),
    ).toEqual({ ok: true });
    expect(state.db.rows("ops_weekly_projects")[0].active).toBe(false);
  });

  it("없는 id 수정은 거절", async () => {
    me("z@example.com", true);
    expect(
      (await upsertProject({ ...base, id: P1, name: "없는항목" })).ok,
    ).toBe(false);
  });
});

describe("프로젝트 담당자", () => {
  const withProject = (owners: string[], ops: string[]) =>
    setup({
      operators: ops.map(writerRow),
      ops_weekly_projects: [
        { id: P1, name: "PIMS", kind: "project", sort_order: 0, active: true },
      ],
      ops_weekly_project_owners: owners.map((e) => ({
        project_id: P1,
        operator_email: e,
      })),
    });

  it("작성 대상 밖 이메일은 거절", async () => {
    me("z@example.com", true);
    withProject([], ["a@example.com"]);
    expect(
      (await setProjectOwners({ projectId: P1, emails: ["q@example.com"] })).ok,
    ).toBe(false);
    expect(state.db.rows("ops_weekly_project_owners")).toEqual([]);
  });

  it("추가분은 넣고 빠진 사람은 지운다(정규화 키)", async () => {
    me("z@example.com", true);
    withProject(
      ["a@example.com", "b@example.com"],
      ["a@example.com", "b@example.com", "c@example.com"],
    );
    expect(
      await setProjectOwners({
        projectId: P1,
        emails: ["A@example.com", "c@example.com"],
      }),
    ).toEqual({ ok: true });
    expect(
      state.db
        .rows("ops_weekly_project_owners")
        .map((r) => r.operator_email)
        .sort(),
    ).toEqual(["a@example.com", "c@example.com"]);
  });

  it("없는 프로젝트는 거절", async () => {
    me("z@example.com", true);
    writers(["a@example.com"]);
    expect(
      (await setProjectOwners({ projectId: P1, emails: ["a@example.com"] })).ok,
    ).toBe(false);
  });

  it("추가 쓰기가 실패하면 기존 담당자를 지우지 않는다", async () => {
    me("z@example.com", true);
    withProject(["a@example.com"], ["a@example.com", "c@example.com"]);
    state.db.failNextWrite("ops_weekly_project_owners", "boom");
    expect(
      (await setProjectOwners({ projectId: P1, emails: ["c@example.com"] })).ok,
    ).toBe(false);
    expect(state.db.rows("ops_weekly_project_owners")).toHaveLength(1);
  });
});

describe("주별 당번", () => {
  it("보고된 주는 못 바꾼다", async () => {
    me("z@example.com", true);
    setup({
      operators: [writerRow("a@example.com")],
      ops_weekly_weeks: [weekRow({ status: "reported" })],
    });
    expect(
      (await setWeekDuty({ weekId: W, dutyEmail: "a@example.com" })).ok,
    ).toBe(false);
    expect(state.db.rows("ops_weekly_weeks")[0].duty_email).toBeNull();
  });

  it("작성 대상이 아니면 거절", async () => {
    me("z@example.com", true);
    setup({
      operators: [writerRow("a@example.com")],
      ops_weekly_weeks: [weekRow()],
    });
    expect(
      (await setWeekDuty({ weekId: W, dutyEmail: "q@example.com" })).ok,
    ).toBe(false);
  });

  it("그 주의 당번만 바꾼다", async () => {
    me("z@example.com", true);
    setup({
      operators: [writerRow("a@example.com")],
      ops_weekly_weeks: [
        weekRow(),
        weekRow({
          id: "99999999-9999-4999-8999-999999999999",
          week_start: "2026-11-23",
        }),
      ],
    });
    expect(
      await setWeekDuty({ weekId: W, dutyEmail: "A@example.com" }),
    ).toEqual({ ok: true });
    expect(state.db.rows("ops_weekly_weeks").map((r) => r.duty_email)).toEqual([
      "a@example.com",
      null,
    ]);
  });

  it("없는 주는 거절", async () => {
    me("z@example.com", true);
    writers(["a@example.com"]);
    expect(
      (await setWeekDuty({ weekId: W, dutyEmail: "a@example.com" })).ok,
    ).toBe(false);
  });
});
