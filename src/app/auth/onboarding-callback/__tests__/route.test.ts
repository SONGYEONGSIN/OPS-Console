import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExchange = vi.fn();
const mockSelectMaybeSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockSelect = vi.fn(() => ({ eq: () => ({ maybeSingle: mockSelectMaybeSingle }) }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mockExchange },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ select: mockSelect, update: mockUpdate }),
  })),
}));

import { GET } from "../route";

describe("/auth/onboarding-callback", () => {
  beforeEach(() => {
    mockExchange.mockReset();
    mockSelectMaybeSingle.mockReset();
    mockUpdateEq.mockReset();
  });

  it("code 없음 → /login?error=invite-no-code", async () => {
    const req = new Request("http://localhost/auth/onboarding-callback");
    const res = await GET(req as never);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=invite-no-code");
  });

  it("error_description 있음 → /login?error=...", async () => {
    const req = new Request(
      "http://localhost/auth/onboarding-callback?error_description=expired",
    );
    const res = await GET(req as never);
    expect(res.headers.get("location")).toContain("/login?error=expired");
  });

  it("exchange 실패 → /login?error=...", async () => {
    mockExchange.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "bad-code" },
    });
    const req = new Request("http://localhost/auth/onboarding-callback?code=abc");
    const res = await GET(req as never);
    expect(res.headers.get("location")).toContain("/login?error=bad-code");
  });

  it("cohort 매칭 + 첫 수락 → /dashboard/onboarding?welcome=1", async () => {
    mockExchange.mockResolvedValueOnce({
      data: { user: { email: "kjn@jinhakapply.com" } },
      error: null,
    });
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: { id: "c1", status: "planned", accepted_at: null },
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });

    const req = new Request("http://localhost/auth/onboarding-callback?code=abc");
    const res = await GET(req as never);
    expect(res.headers.get("location")).toContain(
      "/dashboard/onboarding?welcome=1",
    );
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("cohort 미매칭 → /dashboard fallback", async () => {
    mockExchange.mockResolvedValueOnce({
      data: { user: { email: "stranger@example.com" } },
      error: null,
    });
    mockSelectMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const req = new Request("http://localhost/auth/onboarding-callback?code=abc");
    const res = await GET(req as never);
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });

  it("cohort 이미 accepted → status update skip + 같은 redirect", async () => {
    mockExchange.mockResolvedValueOnce({
      data: { user: { email: "kjn@jinhakapply.com" } },
      error: null,
    });
    mockSelectMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "c1",
        status: "in_progress",
        accepted_at: "2026-05-15T00:00:00Z",
      },
      error: null,
    });

    const req = new Request("http://localhost/auth/onboarding-callback?code=abc");
    const res = await GET(req as never);
    expect(res.headers.get("location")).toContain("/dashboard/onboarding");
    // 첫 수락이 아니므로 update 호출 안 됨
  });
});
