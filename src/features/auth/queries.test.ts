import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentOperator } from "./queries";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

const makeClient = (
  user: { email: string } | null,
  dbPermission: "admin" | "member" | "viewer" | null,
  allowedMenus: string[] = []
) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({
            data: dbPermission
              ? { permission: dbPermission, allowed_menus: allowedMenus }
              : null,
            error: null,
          }),
      })),
    })),
  })),
});

beforeEach(() => vi.clearAllMocks());

describe("getCurrentOperator", () => {
  it("매칭되는 OPERATORS 멤버는 풀 데이터 + DB permission 반환", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ys1114@jinhakapply.com" }, "admin") as never
    );
    const result = await getCurrentOperator();
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("송영신");
    expect(result!.role).toBe("팀장");
    expect(result!.team).toBe("운영2팀");
    expect(result!.operator).not.toBeNull();
    expect(result!.permission).toBe("admin");
  });

  it("DB에서 permission='member' 반환 → result.permission='member'", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ys1114@jinhakapply.com" }, "member") as never
    );
    const result = await getCurrentOperator();
    expect(result!.permission).toBe("member");
  });

  it("매칭 안 되는 이메일은 fallback (email username + 관리자) + permission=null", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "dev-admin@example.com" }, null) as never
    );
    const result = await getCurrentOperator();
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("dev-admin");
    expect(result!.role).toBe("관리자");
    expect(result!.team).toBeNull();
    expect(result!.operator).toBeNull();
    expect(result!.permission).toBeNull();
  });

  it("user 없음(null) → null 반환", async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null, null) as never);
    const result = await getCurrentOperator();
    expect(result).toBeNull();
  });

  it("DB allowed_menus 배열 반환 → result.allowedMenus 노출", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ys1114@jinhakapply.com" }, "member", [
        "alerts",
        "services",
      ]) as never
    );
    const result = await getCurrentOperator();
    expect(result!.allowedMenus).toEqual(["alerts", "services"]);
  });

  it("매칭 안 되는 이메일 — allowedMenus 빈 배열 fallback", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "dev@example.com" }, null) as never
    );
    const result = await getCurrentOperator();
    expect(result!.allowedMenus).toEqual([]);
  });
});
