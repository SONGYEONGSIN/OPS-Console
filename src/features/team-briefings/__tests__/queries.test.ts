import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: null as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { getTeamBriefingByShareToken } from "../queries";

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  return b;
}

describe("getTeamBriefingByShareToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { data: null, error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("빈 토큰 → null (조회 없이)", async () => {
    expect(await getTeamBriefingByShareToken("")).toBeNull();
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("토큰 일치 → issueNo/briefingDate/payload 반환", async () => {
    state.result = {
      data: {
        issue_no: 12,
        briefing_date: "2026-07-17",
        payload: { dateLabel: "2026-07-17 (금)" },
      },
      error: null,
    };
    const r = await getTeamBriefingByShareToken("tok123");
    expect(r).not.toBeNull();
    expect(r!.issueNo).toBe(12);
    expect(r!.briefingDate).toBe("2026-07-17");
    expect(r!.payload.dateLabel).toBe("2026-07-17 (금)");
  });

  it("미존재/에러 → null", async () => {
    state.result = { data: null, error: { message: "boom" } };
    expect(await getTeamBriefingByShareToken("nope")).toBeNull();
  });
});
