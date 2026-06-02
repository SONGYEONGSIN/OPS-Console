import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult, eqCalls, orCalls, rangeCalls, inCalls } =
  vi.hoisted(() => {
    const mockResult = vi.fn();
    const eqCalls: Array<[string, unknown]> = [];
    const orCalls: string[] = [];
    const rangeCalls: Array<[number, number]> = [];
    const inCalls: Array<[string, unknown[]]> = [];

    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.order = () => builder;
    builder.eq = (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    };
    builder.or = (clause: string) => {
      orCalls.push(clause);
      return builder;
    };
    builder.in = (col: string, vals: unknown[]) => {
      inCalls.push([col, vals]);
      return builder;
    };
    builder.range = (from: number, to: number) => {
      rangeCalls.push([from, to]);
      return builder;
    };
    builder.maybeSingle = () => Promise.resolve(mockResult());
    builder.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(mockResult()).then(onFulfilled);

    const mockCreateClient = vi.fn(async () => ({
      from: () => builder,
    }));
    return {
      mockCreateClient,
      mockResult,
      eqCalls,
      orCalls,
      rangeCalls,
      inCalls,
    };
  });

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import {
  listIncidents,
  getIncidentById,
  listIncidentsByIds,
} from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  year: 2027,
  university_name: "건국대학교(서울)",
  app_type: "공통원서",
  category: "결제",
  occurred_date: "2026-05-16",
  resolved_date: null,
  title: "결제 오류",
  cause_summary: "다수 발생",
  root_cause: null,
  resolution: null,
  prevention: null,
  department: "운영부-운영1팀",
  assignee_email: "x@example.com",
  assignee_name: "X",
  reporter_email: "alcure23@jinhakapply.com",
  reporter_name: "허승철",
  status: "처리중",
  created_at: "2026-05-16T00:00:00Z",
  updated_at: "2026-05-16T00:00:00Z",
};

describe("listIncidents", () => {
  beforeEach(() => {
    mockResult.mockReset();
    eqCalls.length = 0;
    orCalls.length = 0;
    rangeCalls.length = 0;
  });

  it("정상 row 반환 + total count", async () => {
    mockResult.mockReturnValue({
      data: [validRow],
      error: null,
      count: 12,
    });
    const r = await listIncidents();
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]?.title).toBe("결제 오류");
    expect(r.total).toBe(12);
  });

  it("year 필터 적용 시 eq('year', 2027)", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listIncidents({ year: 2027 });
    expect(eqCalls).toContainEqual(["year", 2027]);
  });

  it("status / department 필터 모두 적용", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listIncidents({ status: "처리중", department: "운영부-운영1팀" });
    expect(eqCalls).toContainEqual(["status", "처리중"]);
    expect(eqCalls).toContainEqual(["department", "운영부-운영1팀"]);
  });

  it("mine=true + meEmail → eq('assignee_email', meEmail)", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listIncidents({ mine: true, meEmail: "me@example.com" });
    expect(eqCalls).toContainEqual(["assignee_email", "me@example.com"]);
  });

  it("q 검색 시 title/university/cause_summary/assignee_name or-clause", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listIncidents({ q: "결제" });
    expect(orCalls).toHaveLength(1);
    expect(orCalls[0]).toContain("title.ilike.%결제%");
    expect(orCalls[0]).toContain("university_name.ilike.%결제%");
    expect(orCalls[0]).toContain("cause_summary.ilike.%결제%");
    expect(orCalls[0]).toContain("assignee_name.ilike.%결제%");
  });

  it("page=2, pageSize=30 → range(30, 59)", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listIncidents({ page: 2, pageSize: 30 });
    expect(rangeCalls).toContainEqual([30, 59]);
  });

  it("supabase error → 빈 rows", async () => {
    mockResult.mockReturnValue({
      data: null,
      error: { message: "boom" },
      count: null,
    });
    const r = await listIncidents();
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, status: "엉뚱한값" }],
      error: null,
      count: 2,
    });
    const r = await listIncidents();
    expect(r.rows.length).toBe(1);
  });
});

describe("listIncidentsByIds", () => {
  beforeEach(() => {
    mockResult.mockReset();
    inCalls.length = 0;
  });

  it("빈 ids → 빈 배열 (DB 미조회)", async () => {
    const r = await listIncidentsByIds([]);
    expect(r).toEqual([]);
    expect(inCalls).toHaveLength(0);
  });

  it("in('id', ids) 필터로 정상 row 반환", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const r = await listIncidentsByIds([validRow.id]);
    expect(r.length).toBe(1);
    expect(r[0]?.title).toBe("결제 오류");
    expect(inCalls).toContainEqual(["id", [validRow.id]]);
  });

  it("supabase error → 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: { message: "boom" } });
    const r = await listIncidentsByIds([validRow.id]);
    expect(r).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, status: "엉뚱한값" }],
      error: null,
    });
    const r = await listIncidentsByIds([validRow.id]);
    expect(r.length).toBe(1);
  });
});

describe("getIncidentById", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환", async () => {
    mockResult.mockReturnValue({ data: validRow, error: null });
    const r = await getIncidentById(validRow.id);
    expect(r?.title).toBe("결제 오류");
  });

  it("not found → null", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const r = await getIncidentById(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(r).toBeNull();
  });
});
