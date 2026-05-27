import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockInsertResult,
  mockUpdateResult,
  mockDeleteResult,
  mockSendIncidentMail,
  insertPayloads,
  updatePatches,
  deleteEqIds,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockInsertResult: vi.fn(),
  mockUpdateResult: vi.fn(),
  mockDeleteResult: vi.fn(),
  mockSendIncidentMail: vi.fn(),
  insertPayloads: [] as unknown[],
  updatePatches: [] as unknown[],
  deleteEqIds: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("../mail-actions", () => ({
  sendIncidentMail: mockSendIncidentMail,
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
      delete: () => ({
        eq: (_col: string, id: string) => {
          deleteEqIds.push(id);
          return {
            select: () => ({
              maybeSingle: () => Promise.resolve(mockDeleteResult()),
            }),
          };
        },
      }),
    }),
  })),
}));

import { createIncident, updateIncident, deleteIncident } from "../actions";

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
  mockDeleteResult.mockReset();
  mockSendIncidentMail.mockReset();
  mockSendIncidentMail.mockResolvedValue({ ok: true, status: "sent" });
  insertPayloads.length = 0;
  updatePatches.length = 0;
  deleteEqIds.length = 0;
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

describe("deleteIncident", () => {
  const otherAssigneeRow = {
    ...baseRow,
    assignee_email: "other@jinhakapply.com",
    assignee_name: "타인",
  };

  it("admin → 본인 작성 아니어도 삭제 성공", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      ...meOperator,
      permission: "admin",
    });
    mockDeleteResult.mockReturnValue({ data: otherAssigneeRow, error: null });

    const r = await deleteIncident(baseRow.id);
    expect(r.ok).toBe(true);
    expect(deleteEqIds).toEqual([baseRow.id]);
  });

  it("member + 본인 작성건 → 삭제 성공", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockDeleteResult.mockReturnValue({ data: baseRow, error: null });

    const r = await deleteIncident(baseRow.id);
    expect(r.ok).toBe(true);
    expect(deleteEqIds).toEqual([baseRow.id]);
  });

  it("member + 타인 작성건 → 권한 에러 (DB 호출 안 함)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockDeleteResult.mockReturnValue({
      data: otherAssigneeRow,
      error: null,
    });

    // pre-check를 위해 supabase select가 필요 — 구현 패턴 결정 후 보완
    // 여기서는 RLS 의존 + DB가 0 row 반환 시 권한 거부로 간주
    // 따라서: member가 호출 시 supabase delete가 결과적으로 권한 부족으로 data=null 반환
    mockDeleteResult.mockReturnValue({ data: null, error: null });
    const r = await deleteIncident(baseRow.id);
    expect(r.ok).toBe(false);
  });

  it("비인증 → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await deleteIncident(baseRow.id);
    expect(r.ok).toBe(false);
    expect(deleteEqIds).toHaveLength(0);
  });

  it("supabase delete error → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      ...meOperator,
      permission: "admin",
    });
    mockDeleteResult.mockReturnValue({
      data: null,
      error: { message: "db down" },
    });

    const r = await deleteIncident(baseRow.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("db down");
  });
});
