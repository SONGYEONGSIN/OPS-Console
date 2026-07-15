import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const selectFlagsMock: Mock = vi.fn(async () => ({
  data: { flags: [] },
  error: null,
}));
const updateMock: Mock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: selectFlagsMock }),
      }),
      update: () => ({
        eq: updateMock,
      }),
    }),
  })),
}));

const getCurrentOperator: Mock = vi.fn(async () => ({
  email: "me@op.com",
  displayName: "나",
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => getCurrentOperator(),
}));

import { updateDevControlFlag } from "../actions";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";

function input(over: Record<string, unknown> = {}) {
  return {
    analysisId: ANALYSIS_ID,
    flagKey: "k1",
    checked: true,
    note: "확인함",
    ...over,
  };
}

describe("updateDevControlFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentOperator.mockResolvedValue({
      email: "me@op.com",
      displayName: "나",
    });
    updateMock.mockResolvedValue({ error: null });
  });

  it("미인증이면 ok:false", async () => {
    getCurrentOperator.mockResolvedValue(null as unknown);
    const r = await updateDevControlFlag(input());
    expect(r.ok).toBe(false);
  });

  it("DB에 저장된 flags가 스키마를 벗어나면 throw 대신 ok:false 반환", async () => {
    selectFlagsMock.mockResolvedValue({
      data: {
        flags: [
          {
            key: "k1",
            label: "",
            snippet: "s",
            severity: "critical",
            checked: false,
            note: "",
          },
        ],
      },
      error: null,
    });
    const r = await updateDevControlFlag(input());
    expect(r.ok).toBe(false);
    expect(r.error).toBe("저장된 플래그 형식이 올바르지 않습니다");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("정상 flags면 update 호출 + ok:true", async () => {
    selectFlagsMock.mockResolvedValue({
      data: {
        flags: [
          {
            key: "k1",
            label: "L1",
            snippet: "s",
            severity: "warn",
            checked: false,
            note: "",
          },
        ],
      },
      error: null,
    });
    const r = await updateDevControlFlag(input());
    expect(updateMock).toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
});
