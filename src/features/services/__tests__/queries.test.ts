import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult, builderCalls } = vi.hoisted(() => {
  const mockResult = vi.fn();
  const builderCalls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const trace =
    (name: string) =>
    (...args: unknown[]) => {
      builderCalls.push({ method: name, args });
      return builder;
    };
  builder.select = trace("select");
  builder.eq = trace("eq");
  builder.or = trace("or");
  builder.ilike = trace("ilike");
  builder.range = trace("range");
  builder.order = trace("order");
  builder.not = trace("not");
  builder.gte = trace("gte");
  builder.lte = trace("lte");
  builder.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(mockResult()).then(onFulfilled);
  const mockCreateClient = vi.fn(async () => ({
    from: () => builder,
  }));
  return { mockCreateClient, mockResult, builderCalls };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listServices, listServicesForCalendar } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  service_id: 1234567,
  application_type: "공통원서",
  region: "서울",
  university_name: "○○대학교",
  service_name: "2026 수시",
  university_type: "4년제",
  category: "수시",
  operator_email: "op1@example.com",
  operator_name: "박운영",
  developer_email: null,
  developer_name: null,
  write_start_at: "2026-08-01T00:00:00Z",
  write_end_at: "2026-09-15T00:00:00Z",
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
  source: "google_sheet_import",
  imported_at: "2026-05-13T00:00:00Z",
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
};

describe("listServices", () => {
  beforeEach(() => {
    mockResult.mockReset();
    builderCalls.length = 0;
  });

  it("정상 row 반환 + zod parse + total count", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 1, error: null });
    const result = await listServices();
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].university_name).toBe("○○대학교");
    expect(result.total).toBe(1);
  });

  it("ownerMe + ownerEmail — or(operator_email.eq, developer_email.eq) 사용", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 1, error: null });
    await listServices({ ownerEmail: "me@x.com", ownerMe: true });
    const orCall = builderCalls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    expect(String(orCall?.args[0])).toContain("operator_email.eq.me@x.com");
    expect(String(orCall?.args[0])).toContain("developer_email.eq.me@x.com");
  });

  it("ownerEmail 단독 — eq(operator_email)", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 1, error: null });
    await listServices({ ownerEmail: "op@x.com" });
    const eqCalls = builderCalls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some((c) => c.args[0] === "operator_email" && c.args[1] === "op@x.com"),
    ).toBe(true);
  });

  it("category/region/universityType/applicationType/solo eq 필터", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 1, error: null });
    await listServices({
      category: "수시",
      region: "서울",
      universityType: "4년제",
      applicationType: "공통원서",
      solo: true,
    });
    const eqCalls = builderCalls.filter((c) => c.method === "eq");
    expect(eqCalls.some((c) => c.args[0] === "category")).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === "region")).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === "university_type")).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === "application_type")).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === "solo" && c.args[1] === true)).toBe(true);
  });

  it("search — university_name + service_name ilike or", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 1, error: null });
    await listServices({ search: "○○" });
    const orCall = builderCalls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    expect(String(orCall?.args[0])).toContain("university_name.ilike.%○○%");
    expect(String(orCall?.args[0])).toContain("service_name.ilike.%○○%");
  });

  it("pagination — range(from, to) 호출", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 100, error: null });
    await listServices({ page: 2, pageSize: 30 });
    const rangeCall = builderCalls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([30, 59]);
  });

  it("supabase error → 빈 결과 + total 0", async () => {
    mockResult.mockReturnValue({ data: null, count: null, error: { message: "boom" } });
    const result = await listServices();
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, service_id: "not-a-number" }],
      count: 2,
      error: null,
    });
    const result = await listServices();
    expect(result.rows.length).toBe(1);
  });
});

describe("listServicesForCalendar", () => {
  beforeEach(() => {
    mockResult.mockReset();
    builderCalls.length = 0;
  });

  it("range start/end로 nested or 빌더 호출 (write_start 또는 write_end가 range 내)", async () => {
    mockResult.mockReturnValue({ data: [validRow], count: 1, error: null });
    await listServicesForCalendar("2026-05-01", "2026-06-08");

    const orCall = builderCalls.find((c) => c.method === "or");
    expect(orCall).toBeDefined();
    const orBody = orCall?.args[0];
    expect(orBody).toContain("write_start_at.gte.2026-05-01");
    expect(orBody).toContain("write_start_at.lte.2026-06-08");
    expect(orBody).toContain("write_end_at.gte.2026-05-01");
    expect(orBody).toContain("write_end_at.lte.2026-06-08");
  });

  it("정상 row만 zod parse 통과해 반환", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, service_id: "bad" }],
      count: 2,
      error: null,
    });
    const result = await listServicesForCalendar("2026-05-01", "2026-06-08");
    expect(result.length).toBe(1);
  });

  it("supabase 에러 시 빈 배열 반환", async () => {
    mockResult.mockReturnValue({
      data: null,
      count: null,
      error: { message: "boom" },
    });
    const result = await listServicesForCalendar("2026-05-01", "2026-06-08");
    expect(result).toEqual([]);
  });
});
