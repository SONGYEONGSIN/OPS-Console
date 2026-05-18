import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult, orCalls, rangeCalls } = vi.hoisted(() => {
  const mockResult = vi.fn();
  const orCalls: string[] = [];
  const rangeCalls: Array<[number, number]> = [];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = () => builder;
  builder.or = (s: string) => {
    orCalls.push(s);
    return builder;
  };
  builder.range = (f: number, t: number) => {
    rangeCalls.push([f, t]);
    return builder;
  };
  builder.maybeSingle = () => Promise.resolve(mockResult());
  builder.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(mockResult()).then(onFulfilled);
  const mockCreateClient = vi.fn(async () => ({
    from: () => builder,
  }));
  return { mockCreateClient, mockResult, orCalls, rangeCalls };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import {
  listServicesWithHandover,
  getHandoverByServiceId,
} from "../queries";

const sampleService = {
  id: "aaaaaaaa-1111-4111-8111-111111111111",
  service_id: 6101001,
  university_name: "서울대학교",
  service_name: "수시 일반전형",
  application_type: "공통원서",
  operator_name: "송영신",
  handover_records: null,
};

const sampleRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: "aaaaaaaa-1111-4111-8111-111111111111",
  contract_info_md: "정보",
  contract_data_md: null,
  work_basic_md: null,
  work_generator_md: null,
  work_site_md: null,
  work_output_md: null,
  work_rate_md: null,
  work_file_md: null,
  work_etc_md: null,
  payment_fee_md: null,
  payment_invoice_md: null,
  school_contact_md: null,
  docs_md: null,
  notes_md: null,
  author_email: "bob@example.com",
  author_name: "Bob",
  status: "draft",
  created_at: "2026-05-16T00:00:00Z",
  updated_at: "2026-05-16T00:00:00Z",
};

describe("listServicesWithHandover", () => {
  beforeEach(() => {
    mockResult.mockReset();
    orCalls.length = 0;
    rangeCalls.length = 0;
  });

  it("정상 row 매핑 + handover_status null", async () => {
    mockResult.mockReturnValue({
      data: [sampleService],
      error: null,
      count: 1,
    });
    const r = await listServicesWithHandover();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.university_name).toBe("서울대학교");
    expect(r.rows[0]?.handover_status).toBeNull();
    expect(r.total).toBe(1);
  });

  it("handover_records 있을 때 status 매핑", async () => {
    mockResult.mockReturnValue({
      data: [{ ...sampleService, handover_records: { status: "ready" } }],
      error: null,
      count: 1,
    });
    const r = await listServicesWithHandover();
    expect(r.rows[0]?.handover_status).toBe("ready");
  });

  it("q 검색 시 university/service or-clause", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listServicesWithHandover({ q: "서울" });
    expect(orCalls).toHaveLength(1);
    expect(orCalls[0]).toContain("university_name.ilike.%서울%");
    expect(orCalls[0]).toContain("service_name.ilike.%서울%");
  });

  it("page=2 pageSize=30 → range(30, 59)", async () => {
    mockResult.mockReturnValue({ data: [], error: null, count: 0 });
    await listServicesWithHandover({ page: 2, pageSize: 30 });
    expect(rangeCalls).toContainEqual([30, 59]);
  });

  it("status=none 필터 — handover_records null인 row만", async () => {
    mockResult.mockReturnValue({
      data: [
        sampleService, // null
        { ...sampleService, id: "x", handover_records: { status: "ready" } },
      ],
      error: null,
      count: 2,
    });
    const r = await listServicesWithHandover({ status: "none" });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.handover_status).toBeNull();
  });

  it("status=ready 필터 — ready row만", async () => {
    mockResult.mockReturnValue({
      data: [
        sampleService, // null
        { ...sampleService, id: "x", handover_records: { status: "ready" } },
        { ...sampleService, id: "y", handover_records: { status: "draft" } },
      ],
      error: null,
      count: 3,
    });
    const r = await listServicesWithHandover({ status: "ready" });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.handover_status).toBe("ready");
  });

  it("supabase error → 빈 rows + total 0", async () => {
    mockResult.mockReturnValue({
      data: null,
      error: { message: "boom" },
      count: null,
    });
    const r = await listServicesWithHandover();
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });
});

describe("getHandoverByServiceId", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환", async () => {
    mockResult.mockReturnValue({ data: sampleRecord, error: null });
    const r = await getHandoverByServiceId(sampleRecord.service_id);
    expect(r?.contract_info_md).toBe("정보");
  });

  it("not found → null", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const r = await getHandoverByServiceId(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(r).toBeNull();
  });

  it("supabase error → null", async () => {
    mockResult.mockReturnValue({ data: null, error: { message: "boom" } });
    const r = await getHandoverByServiceId(sampleRecord.service_id);
    expect(r).toBeNull();
  });
});
