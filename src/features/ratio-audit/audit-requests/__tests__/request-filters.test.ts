import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { loadRequestFilters } from "../request-filters";

const ID = "00000000-0000-4000-8000-000000000001";

// admin.from("ratio_audit_requests").select(...).eq("id", ...).maybeSingle()
function mockAdmin(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { from, select, eq, maybeSingle };
}

describe("loadRequestFilters", () => {
  beforeEach(() => {
    vi.mocked(createAdminClient).mockReset();
  });

  it("조건이 있으면 found + 정규화된 조건", async () => {
    const m = mockAdmin({
      data: {
        id: ID,
        filters: { univ: ["2년제", "4년제"], recruit: ["수시"] },
      },
      error: null,
    });
    await expect(loadRequestFilters(ID)).resolves.toEqual({
      status: "found",
      filters: { univ: ["4년제", "2년제"], recruit: ["수시"] },
    });
    expect(m.from).toHaveBeenCalledWith("ratio_audit_requests");
    expect(m.eq).toHaveBeenCalledWith("id", ID);
  });

  it("옛 요청(filters null)은 missing_filters", async () => {
    mockAdmin({ data: { id: ID, filters: null }, error: null });
    await expect(loadRequestFilters(ID)).resolves.toEqual({
      status: "missing_filters",
    });
  });

  it("허용값 밖 조건도 missing_filters", async () => {
    mockAdmin({
      data: { id: ID, filters: { univ: ["대학원"], recruit: ["수시"] } },
      error: null,
    });
    await expect(loadRequestFilters(ID)).resolves.toEqual({
      status: "missing_filters",
    });
  });

  it("행이 없으면 not_found", async () => {
    mockAdmin({ data: null, error: null });
    await expect(loadRequestFilters(ID)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("조회 오류는 던진다", async () => {
    mockAdmin({ data: null, error: { message: "boom" } });
    await expect(loadRequestFilters(ID)).rejects.toThrow("boom");
  });
});
