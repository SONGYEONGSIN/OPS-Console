import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockInsertResult,
  mockUpdateResult,
  insertPayloads,
  updatePatches,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockInsertResult: vi.fn(),
  mockUpdateResult: vi.fn(),
  insertPayloads: [] as unknown[],
  updatePatches: [] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: (payload: unknown) => {
        insertPayloads.push(payload);
        return {
          select: () => ({
            single: () => Promise.resolve(mockInsertResult()),
          }),
        };
      },
      update: (patch: unknown) => {
        updatePatches.push(patch);
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve(mockUpdateResult()),
            }),
          }),
        };
      },
    }),
  })),
}));

import { createIncident, updateIncident } from "../actions";

const meOperator = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  email: "me@jinhakapply.com",
  team: "운영2팀",
  permission: "member",
  displayName: "나",
};

const validInput = {
  year: 2027,
  university_name: "건국대학교(서울)",
  app_type: "공통원서",
  category: "결제",
  occurred_date: "2026-05-16",
  title: "결제 오류",
  department: "운영부-운영1팀",
  status: "처리중",
};

const baseRow = {
  id: "11111111-1111-1111-1111-111111111111",
  ...validInput,
  resolved_date: null,
  cause_summary: null,
  root_cause: null,
  resolution: null,
  prevention: null,
  assignee_email: meOperator.email,
  assignee_name: meOperator.displayName,
  reporter_email: "alcure23@jinhakapply.com",
  reporter_name: "허승철",
  created_at: "2026-05-16T00:00:00Z",
  updated_at: "2026-05-16T00:00:00Z",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockInsertResult.mockReset();
  mockUpdateResult.mockReset();
  insertPayloads.length = 0;
  updatePatches.length = 0;
});

describe("createIncident", () => {
  it("정상 입력 → 부모 insert + 본인 자동 + 운영1팀 → 허승철 자동", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({ data: baseRow, error: null });

    const r = await createIncident(validInput);
    expect(r.ok).toBe(true);
    expect(insertPayloads).toHaveLength(1);
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      assignee_email: meOperator.email,
      assignee_name: meOperator.displayName,
      reporter_email: "alcure23@jinhakapply.com",
      reporter_name: "허승철",
    });
  });

  it("department=운영부-운영2팀 → reporter=송영신 자동", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({ data: baseRow, error: null });

    await createIncident({
      ...validInput,
      department: "운영부-운영2팀",
    });
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      reporter_email: "ys1114@jinhakapply.com",
      reporter_name: "송영신",
    });
  });

  it("비인증 → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await createIncident(validInput);
    expect(r.ok).toBe(false);
  });

  it("zod fail (title 누락) → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await createIncident({ ...validInput, title: "" });
    expect(r.ok).toBe(false);
  });

  it("supabase insert 실패 → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockInsertResult.mockReturnValue({
      data: null,
      error: { message: "db down" },
    });
    const r = await createIncident(validInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("db down");
  });
});

describe("updateIncident", () => {
  it("status 변경 → patch에 status + updated_at", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpdateResult.mockReturnValue({
      data: { ...baseRow, status: "처리완료" },
      error: null,
    });

    await updateIncident(baseRow.id, { status: "처리완료" });
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.status).toBe("처리완료");
    expect(patch.updated_at).toBeDefined();
  });

  it("department 변경 시 reporter_* 자동 재매핑", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpdateResult.mockReturnValue({ data: baseRow, error: null });

    await updateIncident(baseRow.id, {
      department: "운영부-운영2팀",
    });
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch).toMatchObject({
      department: "운영부-운영2팀",
      reporter_email: "ys1114@jinhakapply.com",
      reporter_name: "송영신",
    });
  });

  it("department 미변경 시 reporter_* 미포함", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockUpdateResult.mockReturnValue({ data: baseRow, error: null });

    await updateIncident(baseRow.id, { status: "처리완료" });
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.reporter_email).toBeUndefined();
    expect(patch.reporter_name).toBeUndefined();
  });

  it("비인증 → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await updateIncident(baseRow.id, { status: "처리완료" });
    expect(r.ok).toBe(false);
  });
});
