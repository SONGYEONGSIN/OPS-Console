import { describe, it, expect, vi, beforeEach } from "vitest";
import { listRatioAuditTargets } from "../queries";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  gte: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  // range 호출 순서대로 돌려줄 페이지
  pages: [] as { data: unknown[] | null; error: { message: string } | null }[],
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));

const NOW = new Date("2026-11-10T01:00:00Z");

beforeEach(() => {
  h.pages = [{ data: [], error: null }];
  for (const m of [h.gte, h.order, h.range, h.select, h.from]) m.mockReset();
  h.range.mockImplementation(async () => {
    const i = h.range.mock.calls.length - 1;
    return h.pages[i] ?? { data: [], error: null };
  });
  h.order.mockReturnValue({ range: h.range });
  h.gte.mockReturnValue({ order: h.order });
  h.select.mockReturnValue({ gte: h.gte });
  h.from.mockReturnValue({ select: h.select });
});

describe("listRatioAuditTargets", () => {
  it("기간은 DB 에서 — 접수 마감이 지금 이후인 것만", async () => {
    await listRatioAuditTargets({ univ: ["4년제"], recruit: ["수시"] }, NOW);
    expect(h.from).toHaveBeenCalledWith("closing_services");
    expect(h.gte).toHaveBeenCalledWith("write_end_at", NOW.toISOString());
    expect(h.select.mock.calls[0][0]).toMatch(/university_type/);
    expect(h.select.mock.calls[0][0]).toMatch(/category/);
  });

  it("대학구분·모집구분은 판정 함수로 거른다", async () => {
    h.pages[0].data = [
      {
        service_id: 9001001,
        university_name: "테스트대학교A",
        service_name: "2027학년도 수시모집",
        operator_name: "운영자A",
        university_type: "전문대",
        category: "수시",
      },
      {
        service_id: 9001002,
        university_name: "테스트대학교B",
        service_name: "재외국민",
        operator_name: "운영자A",
        university_type: "2년제",
        category: "수시 재외국민",
      },
      {
        service_id: 9001003,
        university_name: "테스트대학교C",
        service_name: "정시",
        operator_name: "운영자B",
        university_type: "4년제",
        category: "정시 가나다",
      },
    ];
    const r = await listRatioAuditTargets(
      { univ: ["2년제"], recruit: ["수시"] },
      NOW,
    );
    expect(r).toEqual([
      {
        serviceId: 9001001,
        universityName: "테스트대학교A",
        serviceName: "2027학년도 수시모집",
        operatorName: "운영자A",
      },
    ]);
  });

  it("조회 오류는 던진다 — 조용한 0건 금지", async () => {
    h.pages = [{ data: null, error: { message: "boom" } }];
    await expect(
      listRatioAuditTargets({ univ: ["4년제"], recruit: ["수시"] }, NOW),
    ).rejects.toThrow(/대상 조회 실패/);
  });

  it("1000행 상한 — 정렬하고 페이지를 끝까지 읽어 합친다", async () => {
    const row = (id: number) => ({
      service_id: id,
      university_name: "테스트대학교A",
      service_name: "2027학년도 수시모집",
      operator_name: "운영자A",
      university_type: "4년제",
      category: "수시",
    });
    h.pages = [
      {
        data: Array.from({ length: 1000 }, (_, i) => row(9001000 + i)),
        error: null,
      },
      { data: [row(9002000), row(9002001)], error: null },
    ];
    const r = await listRatioAuditTargets(
      { univ: ["4년제"], recruit: ["수시"] },
      NOW,
    );
    expect(r).toHaveLength(1002);
    expect(h.order).toHaveBeenCalledWith("service_id");
    expect(h.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(h.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(h.range).toHaveBeenCalledTimes(2);
  });

  it("둘째 페이지 오류도 던진다", async () => {
    h.pages = [
      {
        data: Array.from({ length: 1000 }, (_, i) => ({
          service_id: i,
          university_type: "4년제",
          category: "수시",
        })),
        error: null,
      },
      { data: null, error: { message: "boom" } },
    ];
    await expect(
      listRatioAuditTargets({ univ: ["4년제"], recruit: ["수시"] }, NOW),
    ).rejects.toThrow(/대상 조회 실패/);
  });
});
