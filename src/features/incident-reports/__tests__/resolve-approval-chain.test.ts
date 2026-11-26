import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryResult } = vi.hoisted(() => ({ mockQueryResult: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        in: () => Promise.resolve(mockQueryResult()),
      }),
    }),
  })),
}));

import { resolveApprovalChain } from "../queries";

const rows = [
  {
    email: "h@x.com",
    name: "허승철",
    team: "운영1팀",
    role: "부장",
    leader: null,
    emp_no: "2001",
  },
  {
    email: "k@x.com",
    name: "기자의",
    team: "운영1팀",
    role: "매니저",
    leader: null,
    emp_no: "3001",
  },
];

beforeEach(() => vi.clearAllMocks());

describe("resolveApprovalChain", () => {
  it("운영자 조회가 실패하면 null 이 아니라 던진다 — '못 찾음' 과 갈라야 한다", async () => {
    mockQueryResult.mockReturnValue({
      data: null,
      error: { message: "timeout" },
    });
    await expect(resolveApprovalChain("k@x.com")).rejects.toThrow();
  });

  it("담당자가 없으면 두 번째 인자(작성자) 기준", async () => {
    mockQueryResult.mockReturnValue({ data: rows, error: null });
    const chain = await resolveApprovalChain("gone@x.com", "k@x.com");
    expect(chain?.author.name).toBe("기자의");
    expect(chain?.approver?.name).toBe("허승철");
  });

  it("아무도 못 찾으면 null", async () => {
    mockQueryResult.mockReturnValue({ data: rows, error: null });
    await expect(resolveApprovalChain("gone@x.com")).resolves.toBeNull();
  });
});
