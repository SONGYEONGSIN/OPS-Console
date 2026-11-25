import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockCreateAdminClient,
  mockUpsertResult,
  mockRevalidatePath,
  mockLogActivity,
  upsertCalls,
  fromCalls,
} = vi.hoisted(() => {
  const upsertCalls: Array<[unknown, unknown]> = [];
  const fromCalls: string[] = [];
  const mockUpsertResult = vi.fn();
  return {
    mockGetCurrentOperator: vi.fn(),
    mockUpsertResult,
    mockRevalidatePath: vi.fn(),
    mockLogActivity: vi.fn(),
    upsertCalls,
    fromCalls,
    mockCreateAdminClient: vi.fn(() => ({
      from: (table: string) => {
        fromCalls.push(table);
        return {
          upsert: (rows: unknown, opts: unknown) => {
            upsertCalls.push([rows, opts]);
            return Promise.resolve(mockUpsertResult());
          },
        };
      },
    })),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));
vi.mock("@/features/worklog/log", () => ({ logActivity: mockLogActivity }));

import { updateSeverityCriteria } from "../severity-criteria-actions";

const member = {
  email: "me@jinhakapply.com",
  permission: "member",
  displayName: "나",
};
const admin = { ...member, email: "boss@jinhakapply.com", permission: "admin" };

const input = {
  심각: "다수 지원자 영향",
  높음: "여러 지원자 영향",
  보통: "일부 지원자 영향",
  낮음: "지원자 영향 없음",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockCreateAdminClient.mockClear();
  mockUpsertResult.mockReset();
  mockUpsertResult.mockReturnValue({ error: null });
  mockRevalidatePath.mockReset();
  mockLogActivity.mockReset();
  upsertCalls.length = 0;
  fromCalls.length = 0;
});

describe("updateSeverityCriteria", () => {
  it("비로그인 → 로그인 안내, DB 를 부르지 않는다", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await updateSeverityCriteria(input);
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
  });

  it("member → 관리자 안내, upsert 안 함 (폼이 아니라 세션으로 판정)", async () => {
    mockGetCurrentOperator.mockResolvedValue(member);
    const r = await updateSeverityCriteria({ ...input, permission: "admin" });
    expect(r).toEqual({
      ok: false,
      error: "관리자만 기준을 고칠 수 있습니다.",
    });
    expect(upsertCalls).toHaveLength(0);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("admin + 빈 문구 → zod 안내, upsert 안 함", async () => {
    mockGetCurrentOperator.mockResolvedValue(admin);
    const r = await updateSeverityCriteria({ ...input, 보통: "  " });
    expect(r).toEqual({ ok: false, error: "기준 문구를 입력하세요." });
    expect(upsertCalls).toHaveLength(0);
  });

  it("admin + 정상 입력 → 4행을 등급 순서로 upsert, 다시 그리고 ok", async () => {
    mockGetCurrentOperator.mockResolvedValue(admin);
    const r = await updateSeverityCriteria({
      ...input,
      높음: "  재안내 필요 ",
    });

    expect(r).toEqual({ ok: true });
    expect(fromCalls).toEqual(["incident_severity_criteria"]);
    expect(upsertCalls).toEqual([
      [
        [
          {
            severity: "심각",
            description: "다수 지원자 영향",
            updated_by: admin.email,
          },
          {
            severity: "높음",
            description: "재안내 필요",
            updated_by: admin.email,
          },
          {
            severity: "보통",
            description: "일부 지원자 영향",
            updated_by: admin.email,
          },
          {
            severity: "낮음",
            description: "지원자 영향 없음",
            updated_by: admin.email,
          },
        ],
        { onConflict: "severity" },
      ],
    ]);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/incidents");
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity.mock.calls[0][0]).toMatchObject({
      domain: "incidents",
      action: "update",
    });
  });

  it("upsert 오류 → 저장 실패 안내, 다시 그리지 않는다", async () => {
    mockGetCurrentOperator.mockResolvedValue(admin);
    mockUpsertResult.mockReturnValue({ error: { message: "db down" } });
    const r = await updateSeverityCriteria(input);
    expect(r).toEqual({
      ok: false,
      error: "기준 저장에 실패했습니다: db down",
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
