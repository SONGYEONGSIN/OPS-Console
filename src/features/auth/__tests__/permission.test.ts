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

import { requireAdmin, canEditOperators } from "../permission";

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockRedirect.mockClear();
});

describe("requireAdmin", () => {
  it("admin이면 currentOperator 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "ys1114@jinhakapply.com",
      displayName: "송영신",
      role: "팀장",
      team: "운영2팀",
      operator: null,
      permission: "admin",
    });
    const me = await requireAdmin();
    expect(me.permission).toBe("admin");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("member면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "x@y.com",
      displayName: "x",
      role: "매니저",
      team: "운영1팀",
      operator: null,
      permission: "member",
    });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("viewer면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@y.com",
      displayName: "v",
      role: "매니저",
      team: "운영1팀",
      operator: null,
      permission: "viewer",
    });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("permission=null이면 /dashboard로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "dev@y.com",
      displayName: "dev",
      role: "관리자",
      team: null,
      operator: null,
      permission: null,
    });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("로그인 안 됨(null)이면 /login으로 redirect", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});

describe("canEditOperators", () => {
  it("admin → true", () => {
    expect(canEditOperators("admin")).toBe(true);
  });

  it("member → false", () => {
    expect(canEditOperators("member")).toBe(false);
  });

  it("viewer → false", () => {
    expect(canEditOperators("viewer")).toBe(false);
  });

  it("null → false", () => {
    expect(canEditOperators(null)).toBe(false);
  });
});
