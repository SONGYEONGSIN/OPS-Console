import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

type TableResponse = {
  data: unknown[] | null;
  error: { message: string } | null;
};

const responses = new Map<string, TableResponse>();
const fromSpy: Mock = vi.fn();
const gteSpy: Mock = vi.fn();
const lteSpy: Mock = vi.fn();
const orSpy: Mock = vi.fn();
const orderSpy: Mock = vi.fn();
const limitSpy: Mock = vi.fn();
// PostgREST Max-Rows — range 없이 읽으면 앞 1000행만 온다(실제 서버와 같은 절단).
const MAX_ROWS = 1000;

/** 모든 체인 메서드가 자기 자신을 돌려주고, await 하면 그 테이블 응답(range 구간)이 나온다. */
function chain(table: string) {
  const self: Record<string, unknown> = {};
  let range: [number, number] = [0, MAX_ROWS - 1];
  const passthrough =
    (spy?: Mock) =>
    (...a: unknown[]) => {
      spy?.(...a);
      return self;
    };
  self.select = passthrough();
  self.eq = passthrough();
  self.in = passthrough();
  self.gte = passthrough(gteSpy);
  self.lte = passthrough(lteSpy);
  self.or = passthrough(orSpy);
  self.order = passthrough(orderSpy);
  self.limit = passthrough(limitSpy);
  self.range = (from: number, to: number) => {
    range = [from, Math.min(to, from + MAX_ROWS - 1)];
    return self;
  };
  self.then = (resolve: (v: TableResponse) => unknown) => {
    const res = responses.get(table) ?? { data: [], error: null };
    const data = res.data?.slice(range[0], range[1] + 1) ?? null;
    return resolve({ ...res, data });
  };
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fromSpy(table);
      return chain(table);
    },
  }),
}));

import { listDevStatuses, loadAutoSnapshot } from "../auto-queries";

const ok = (data: unknown[]): TableResponse => ({ data, error: null });

function mockTables(t: Record<string, unknown[]>) {
  for (const [k, v] of Object.entries(t)) responses.set(k, ok(v));
}

const ARGS = {
  weekStart: "2026-11-16",
  operatorEmail: "A@Example.com",
  operatorName: " 운영자A ",
  writerNames: new Set(["운영자A", " 운영자B "]),
  now: new Date("2026-11-17T01:00:00.000Z"),
};

const CL_OPENING = {
  service_id: 1,
  university_name: "대학A",
  service_name: "수시",
  operator_name: "운영자A",
  write_start_at: "2026-11-23T01:00:00.000Z",
  write_end_at: "2026-12-10T01:00:00.000Z",
  pay_end_at: "2026-12-20T01:00:00.000Z",
};

const PIMS_THIS = {
  service_id: 9,
  university_name: "대학B",
  service_name: "정시",
  operator_name: "운영자A",
  last_announce_at: "2026-11-18T01:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  responses.clear();
});

describe("loadAutoSnapshot", () => {
  it("조회 에러는 던진다 — 빈 목록으로 삼키지 않는다", async () => {
    mockTables({
      announcement_services: [],
      backup_requests: [],
      schedule_events: [],
    });
    responses.set("closing_services", {
      data: null,
      error: { message: "boom" },
    });
    await expect(loadAutoSnapshot(ARGS)).rejects.toThrow(
      "[ops-weekly] closing_services: boom",
    );
  });

  it("에러 없이 data 가 null 이어도 던진다 — 없는 테이블", async () => {
    mockTables({
      closing_services: [],
      announcement_services: [],
      backup_requests: [],
    });
    responses.set("schedule_events", { data: null, error: null });
    await expect(loadAutoSnapshot(ARGS)).rejects.toThrow(
      "[ops-weekly] schedule_events",
    );
  });

  it("PIMS 조회 창은 ISO 문자열로 넘긴다 — Date 객체가 아니다", async () => {
    mockTables({
      closing_services: [],
      announcement_services: [],
      backup_requests: [],
      schedule_events: [],
      ops_weekly_dev_status: [],
    });
    await loadAutoSnapshot(ARGS);
    expect(gteSpy).toHaveBeenCalledWith(
      "last_announce_at",
      "2026-11-15T15:00:00.000Z",
    );
    expect(lteSpy).toHaveBeenCalledWith(
      "last_announce_at",
      "2026-11-29T14:59:59.999Z",
    );
    for (const [, v] of [...gteSpy.mock.calls, ...lteSpy.mock.calls]) {
      expect(typeof v).toBe("string");
    }
  });

  it("원천 넷을 묶어 스냅샷을 만든다", async () => {
    mockTables({
      closing_services: [CL_OPENING],
      announcement_services: [PIMS_THIS],
      backup_requests: [],
      schedule_events: [],
      ops_weekly_dev_status: [],
    });
    const s = await loadAutoSnapshot(ARGS);
    expect(s.version).toBe(1);
    expect(s.application.opening.map((i) => i.key)).toEqual(["closing:1"]);
    expect(s.pims.thisWeek.map((i) => i.key)).toEqual(["pims:9"]);
    expect(s.unmatched).toEqual({ application: 0, pims: 0 });
  });

  it("담당자명·이메일의 공백·대소문자를 맞춘다", async () => {
    mockTables({
      closing_services: [CL_OPENING],
      announcement_services: [{ ...PIMS_THIS, operator_name: "운영자B" }],
      backup_requests: [],
      schedule_events: [
        {
          id: "s1",
          type: "leave",
          title: "휴가",
          start_at: "2026-11-17T00:00:00.000Z",
          end_at: null,
          assignee_email: "A@EXAMPLE.COM",
        },
      ],
      ops_weekly_dev_status: [],
    });
    const s = await loadAutoSnapshot(ARGS);
    // 명단에 " 운영자B " 가 공백 포함으로 들어 있어도 안 붙음으로 세지 않는다
    expect(s.unmatched.pims).toBe(0);
    expect(s.leave.map((l) => l.key)).toEqual(["leave:se:s1"]);
  });

  it("개발 구분은 시작 전 후보의 service_id 로만 조회한다", async () => {
    const upcoming = {
      ...CL_OPENING,
      write_start_at: "2026-11-30T01:00:00.000Z",
    };
    mockTables({
      closing_services: [upcoming],
      announcement_services: [],
      backup_requests: [],
      schedule_events: [],
      ops_weekly_dev_status: [
        {
          service_id: 1,
          stage: "dev",
          collected_at: "2026-11-16T05:00:00.000Z",
        },
      ],
    });
    const s = await loadAutoSnapshot(ARGS);
    expect(fromSpy).toHaveBeenCalledWith("ops_weekly_dev_status");
    expect(s.application.dev.map((i) => i.key)).toEqual(["closing:1"]);
    expect(s.application.devStatusCollected).toBe(true);
  });

  it("수집 여부는 전역으로 잰다 — 시작 전 서비스가 0건이어도 이번 주 수집이 있으면 수집됨", async () => {
    mockTables({
      closing_services: [CL_OPENING],
      announcement_services: [],
      backup_requests: [],
      schedule_events: [],
      ops_weekly_dev_status: [
        {
          service_id: 777,
          stage: "test",
          collected_at: "2026-11-18T00:30:00.000Z",
        },
      ],
    });
    const s = await loadAutoSnapshot({ ...ARGS, operatorName: "시작전없음" });
    expect(s.application.devStatusCollected).toBe(true);
    expect(gteSpy).toHaveBeenCalledWith(
      "collected_at",
      "2026-11-15T15:00:00.000Z",
    );
    expect(limitSpy).toHaveBeenCalledWith(1);
  });

  it("이번 주 수집 행이 없으면 수집 안 됨", async () => {
    mockTables({
      closing_services: [CL_OPENING],
      announcement_services: [],
      backup_requests: [],
      schedule_events: [],
      ops_weekly_dev_status: [],
    });
    const s = await loadAutoSnapshot(ARGS);
    expect(s.application.devStatusCollected).toBe(false);
  });

  it("수집 여부 조회 에러는 던진다 — '수집 안 됨' 으로 삼키지 않는다", async () => {
    mockTables({
      closing_services: [],
      announcement_services: [],
      backup_requests: [],
      schedule_events: [],
    });
    responses.set("ops_weekly_dev_status", {
      data: null,
      error: { message: "down" },
    });
    await expect(loadAutoSnapshot(ARGS)).rejects.toThrow(
      "[ops-weekly] ops_weekly_dev_status: down",
    );
  });
});

describe("loadAutoSnapshot — closing_services 페이징", () => {
  const filler = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      ...CL_OPENING,
      service_id: 10_000 + i,
      operator_name: "다른팀",
    }));
  const others = {
    announcement_services: [],
    backup_requests: [],
    schedule_events: [],
    ops_weekly_dev_status: [],
  };

  it("1000행을 넘어도 끝까지 읽는다 — 셋째 쪽의 본인 서비스가 빠지지 않는다", async () => {
    const rows = [...filler(2300), CL_OPENING, ...filler(44)];
    mockTables({ ...others, closing_services: rows });
    const s = await loadAutoSnapshot(ARGS);
    expect(s.application.opening.map((i) => i.key)).toEqual(["closing:1"]);
    expect(orderSpy).toHaveBeenCalledWith("service_id", { ascending: true });
  });

  it("쪽 상한을 다 채우면 던진다 — 잘린 목록을 조용히 쓰지 않는다", async () => {
    mockTables({ ...others, closing_services: filler(20_000) });
    await expect(loadAutoSnapshot(ARGS)).rejects.toThrow(
      "[ops-weekly] closing_services",
    );
  });
});

describe("listDevStatuses", () => {
  it("빈 입력은 조회하지 않는다", async () => {
    expect(await listDevStatuses([])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("에러는 던진다", async () => {
    responses.set("ops_weekly_dev_status", {
      data: null,
      error: { message: "nope" },
    });
    await expect(listDevStatuses([1])).rejects.toThrow(
      "[ops-weekly] ops_weekly_dev_status: nope",
    );
  });
});
