import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockRedirect } = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error("REDIRECT_CALLED");
  }),
}));

vi.mock("../queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { requireMenu } from "../menu-guard";

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockRedirect.mockClear();
});

describe("requireMenu", () => {
  it("admin은 모든 slug 자동 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "a@x.com",
      displayName: "a",
      role: "팀장",
      team: "운영2팀",
      operator: null,
      permission: "admin",
      allowedMenus: [],
    });
    const me = await requireMenu("team");
    expect(me.permission).toBe("admin");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("member가 allowedMenus 안 slug면 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "m@x.com",
      displayName: "m",
      role: "매니저",
      team: "운영1팀",
      operator: null,
      permission: "member",
      allowedMenus: ["alerts", "feedback"],
    });
    const me = await requireMenu("alerts");
    expect(me.permission).toBe("member");
  });

  it("member가 allowedMenus 밖 slug면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "m@x.com",
      displayName: "m",
      role: "매니저",
      team: "운영1팀",
      operator: null,
      permission: "member",
      allowedMenus: ["alerts"],
    });
    await expect(requireMenu("team")).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("비로그인(null) → /login으로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    await expect(requireMenu("alerts")).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
