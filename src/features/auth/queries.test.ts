import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentOperator } from "./queries";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

const makeClient = (user: { email: string } | null) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
});

beforeEach(() => vi.clearAllMocks());

describe("getCurrentOperator", () => {
  it("매칭되는 OPERATORS 멤버는 풀 데이터 반환", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ys1114@jinhakapply.com" }) as never
    );
    const result = await getCurrentOperator();
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("송영신");
    expect(result!.role).toBe("팀장");
    expect(result!.team).toBe("운영2팀");
    expect(result!.operator).not.toBeNull();
  });

  it("매칭 안 되는 이메일은 fallback (email username + 관리자)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ysong2526@gmail.com" }) as never
    );
    const result = await getCurrentOperator();
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("ysong2526");
    expect(result!.role).toBe("관리자");
    expect(result!.team).toBeNull();
    expect(result!.operator).toBeNull();
  });

  it("user 없음(null) → null 반환", async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never);
    const result = await getCurrentOperator();
    expect(result).toBeNull();
  });
});
