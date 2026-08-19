import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  rows: [] as Record<string, unknown>[],
  backups: [] as Record<string, unknown>[],
  filters: [] as [string, unknown, unknown?][],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
      select: () => chain,
      gte: (c: string, v: unknown) => {
        state.filters.push(["gte", c, v]);
        return chain;
      },
      lte: (c: string, v: unknown) => {
        state.filters.push(["lte", c, v]);
        return chain;
      },
      eq: (c: string, v: unknown) => {
        state.filters.push(["eq", c, v]);
        return chain;
      },
        order: () => chain,
        limit: () =>
          Promise.resolve({
            data: table === "backup_requests" ? state.backups : state.rows,
            error: null,
          }),
      };
      return chain;
    },
  }),
}));

const { GET } = await import("../route");

const req = (qs: string, auth = "Bearer s3cret") =>
  new Request(`http://x/api/assistant/tools/schedule${qs}`, {
    headers: { authorization: auth },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe("일정 조회 도구 endpoint", () => {
  beforeEach(() => {
    state.rows = [];
    state.backups = [];
    state.filters = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401 — 폴러만 부르는 창구다", async () => {
    expect((await GET(req("?from=2026-08-17&to=2026-08-23", "Bearer no"))).status).toBe(
      401,
    );
  });

  it("from·to가 없으면 400 — 기간 없이 전건을 퍼주지 않는다", async () => {
    expect((await GET(req(""))).status).toBe(400);
  });

  it("날짜 형식이 아니면 400", async () => {
    expect((await GET(req("?from=다음주&to=2026-08-23"))).status).toBe(400);
  });

  it("기간으로 걸러 돌려준다", async () => {
    state.rows = [
      {
        type: "leave",
        title: "운영2팀-이해영-연차",
        start_at: "2026-08-19T00:00:00+00:00",
        end_at: null,
        all_day: true,
        assignee_email: null,
      },
    ];
    const res = await GET(req("?from=2026-08-17&to=2026-08-23"));
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].title).toBe("운영2팀-이해영-연차");
    expect(state.filters).toContainEqual(["gte", "start_at", "2026-08-17"]);
  });

  it("type을 주면 그 종류만 — 휴가만 보고 싶을 때가 많다", async () => {
    await GET(req("?from=2026-08-17&to=2026-08-23&type=leave"));
    expect(state.filters).toContainEqual(["eq", "type", "leave"]);
  });

  it("type을 안 주면 종류로 거르지 않는다", async () => {
    await GET(req("?from=2026-08-17&to=2026-08-23"));
    expect(state.filters.some((f) => f[0] === "eq" && f[1] === "type")).toBe(false);
  });

  it("모르는 type은 400 — 오타로 조용히 0건이 나오면 '없다'고 답해버린다", async () => {
    expect((await GET(req("?from=2026-08-17&to=2026-08-23&type=휴가"))).status).toBe(
      400,
    );
  });
});

/**
 * 휴가가 두 곳에 나뉘어 있다 — 연차 백업요청 11건 중 6건이 일정에 없다.
 * 일정만 보고 답하면 절반을 놓친다(임종우 연차가 그렇게 빠졌다).
 */
describe("일정 조회 — 백업요청의 부재도 함께", () => {
  beforeEach(() => {
    state.rows = [];
    state.backups = [];
    state.filters = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("일정에 없는 연차를 백업요청에서 찾아 함께 준다", async () => {
    state.backups = [
      { title: "임종우 연차 백업요청(08.18~08.21)", created_at: "2026-06-22T00:00:00Z" },
    ];
    const body = await (await GET(req("?from=2026-08-17&to=2026-08-23"))).json();
    expect(body.backupAbsences).toHaveLength(1);
    expect(body.backupAbsences[0]).toMatchObject({
      name: "임종우",
      reason: "연차",
      startYmd: "2026-08-18",
    });
  });

  it("출처를 밝힌다 — 일정에 등록된 것과 구분돼야 한다", async () => {
    state.backups = [
      { title: "임종우 연차 백업요청(08.18~08.21)", created_at: "2026-06-22T00:00:00Z" },
    ];
    const body = await (await GET(req("?from=2026-08-17&to=2026-08-23"))).json();
    expect(body.backupAbsences[0].source).toBe("backup_request");
  });

  it("범위 밖 백업요청은 빼준다", async () => {
    state.backups = [
      { title: "박시현 연차 백업요청(06.19~06.23)", created_at: "2026-06-18T00:00:00Z" },
    ];
    const body = await (await GET(req("?from=2026-08-17&to=2026-08-23"))).json();
    expect(body.backupAbsences).toEqual([]);
  });

  it("type을 leave가 아닌 걸로 좁히면 백업요청은 안 붙인다 — 회의만 물었는데 휴가가 끼면 안 된다", async () => {
    state.backups = [
      { title: "임종우 연차 백업요청(08.18~08.21)", created_at: "2026-06-22T00:00:00Z" },
    ];
    const body = await (
      await GET(req("?from=2026-08-17&to=2026-08-23&type=meeting"))
    ).json();
    expect(body.backupAbsences).toEqual([]);
  });
});
