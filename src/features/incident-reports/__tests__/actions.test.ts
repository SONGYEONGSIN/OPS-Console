import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockResolveApprovalChain,
  mockInsertResult,
  mockUpdateResult,
  mockSelectMaybeSingle,
  insertPayloads,
  updatePatches,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockResolveApprovalChain: vi.fn(),
  mockInsertResult: vi.fn(),
  mockUpdateResult: vi.fn(),
  mockSelectMaybeSingle: vi.fn(),
  insertPayloads: [] as unknown[],
  updatePatches: [] as unknown[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));
vi.mock("../queries", () => ({
  resolveApprovalChain: mockResolveApprovalChain,
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
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(mockSelectMaybeSingle()),
        }),
      }),
    }),
  })),
}));

import {
  createIncidentReport,
  submitForApproval,
  approveIncidentReport,
  rejectIncidentReport,
} from "../actions";

const meOperator = {
  email: "me@jinhakapply.com",
  displayName: "나",
  permission: "member",
};

const approverChain = {
  author: { name: "나", email: meOperator.email },
  approver: { name: "팀장", email: "lead@jinhakapply.com" },
  director: { name: "본부장" },
  ceo: { name: "사장" },
};

const baseRow = {
  id: "11111111-1111-1111-1111-111111111111",
  incident_id: null,
  recipient_university: "건국대학교(서울)",
  title: "결제 오류 경위서",
  status: "draft",
  approver_email: "lead@jinhakapply.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  insertPayloads.length = 0;
  updatePatches.length = 0;
});

describe("createIncidentReport", () => {
  it("비로그인 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await createIncidentReport({
      recipient_university: "건국대",
      title: "t",
    });
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });

  it("정상 입력 → author=me + approval chain snapshot + apology 기본", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockResolveApprovalChain.mockResolvedValue(approverChain);
    mockInsertResult.mockReturnValue({ data: baseRow, error: null });

    const r = await createIncidentReport({
      recipient_university: "건국대학교(서울)",
      title: "결제 오류 경위서",
    });
    expect(r.ok).toBe(true);
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      author_email: meOperator.email,
      author_name: meOperator.displayName,
      approver_email: "lead@jinhakapply.com",
      approver_name: "팀장",
      director_name: "본부장",
      ceo_name: "사장",
      status: "draft",
    });
    expect(payload.apology).toContain("건국대학교(서울)");
  });

  it("zod fail (title 누락) → ok:false", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await createIncidentReport({
      recipient_university: "건국대",
      title: "",
    });
    expect(r.ok).toBe(false);
  });
});

describe("submitForApproval", () => {
  it("비로그인 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await submitForApproval("id-1");
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });

  it("draft → pending_approval 전이", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({
        data: { author_email: meOperator.email },
        error: null,
      })
      .mockReturnValueOnce({
        data: { status: "draft" },
        error: null,
      });
    mockUpdateResult.mockReturnValue({
      data: { ...baseRow, status: "pending_approval" },
      error: null,
    });
    const r = await submitForApproval(baseRow.id);
    expect(r.ok).toBe(true);
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.status).toBe("pending_approval");
    expect(patch.reject_reason).toBeNull();
  });

  it("작성자/admin 아님 → 제출 권한 없음", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValue({
      data: { author_email: "other@jinhakapply.com", status: "draft" },
      error: null,
    });
    const r = await submitForApproval(baseRow.id);
    expect(r).toEqual({ ok: false, error: "제출 권한이 없습니다." });
  });

  it("approved 상태에서 제출 시도 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({
        data: { author_email: meOperator.email },
        error: null,
      })
      .mockReturnValueOnce({
        data: { status: "approved" },
        error: null,
      });
    const r = await submitForApproval(baseRow.id);
    expect(r.ok).toBe(false);
  });
});

describe("approveIncidentReport", () => {
  it("비로그인 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await approveIncidentReport("id-1");
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });

  it("approver 불일치 → 승인 권한 없음", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValue({
      data: {
        status: "pending_approval",
        approver_email: "other@jinhakapply.com",
        title: "t",
      },
      error: null,
    });
    const r = await approveIncidentReport(baseRow.id);
    expect(r).toEqual({ ok: false, error: "승인 권한이 없습니다." });
  });

  it("approver 일치 + pending → approved", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({
        data: {
          status: "pending_approval",
          approver_email: meOperator.email,
          title: "t",
        },
        error: null,
      })
      .mockReturnValueOnce({
        data: { status: "pending_approval" },
        error: null,
      });
    mockUpdateResult.mockReturnValue({
      data: { ...baseRow, status: "approved" },
      error: null,
    });
    const r = await approveIncidentReport(baseRow.id);
    expect(r.ok).toBe(true);
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.status).toBe("approved");
    expect(patch.approved_at).toBeDefined();
  });
});

describe("rejectIncidentReport", () => {
  it("approver 일치 + pending → rejected + reason", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({
        data: { approver_email: meOperator.email, title: "t" },
        error: null,
      })
      .mockReturnValueOnce({
        data: { status: "pending_approval" },
        error: null,
      });
    mockUpdateResult.mockReturnValue({
      data: { ...baseRow, status: "rejected" },
      error: null,
    });
    const r = await rejectIncidentReport(baseRow.id, "내용 보완 필요");
    expect(r.ok).toBe(true);
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.status).toBe("rejected");
    expect(patch.reject_reason).toBe("내용 보완 필요");
  });

  it("approver 불일치 → 반려 권한 없음", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValue({
      data: { approver_email: "other@jinhakapply.com", title: "t" },
      error: null,
    });
    const r = await rejectIncidentReport(baseRow.id, "x");
    expect(r).toEqual({ ok: false, error: "반려 권한이 없습니다." });
  });
});
