import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockResolveApprovalChain,
  mockInsertResult,
  mockUpdateResult,
  mockSelectMaybeSingle,
  mockAssignDocNumber,
  mockAdminMaybeSingle,
  adminUpdatePatches,
  insertPayloads,
  updatePatches,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockResolveApprovalChain: vi.fn(),
  mockInsertResult: vi.fn(),
  mockUpdateResult: vi.fn(),
  mockSelectMaybeSingle: vi.fn(),
  mockAssignDocNumber: vi.fn(),
  mockAdminMaybeSingle: vi.fn(),
  adminUpdatePatches: [] as unknown[],
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
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(mockAdminMaybeSingle()),
        }),
      }),
      update: (patch: unknown) => {
        adminUpdatePatches.push(patch);
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    }),
  })),
}));
vi.mock("../sharepoint-register", () => ({
  assignDocNumber: mockAssignDocNumber,
}));

import {
  createIncidentReport,
  submitForApproval,
  approveIncidentReport,
  rejectIncidentReport,
  revokeApproval,
  revokeSend,
  issueIncidentReportDocNumber,
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
  adminUpdatePatches.length = 0;
});

describe("createIncidentReport", () => {
  const SAMPLE_INCIDENT_ID = crypto.randomUUID();

  it("비로그인 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await createIncidentReport({
      incident_id: SAMPLE_INCIDENT_ID,
      recipient_university: "건국대",
      title: "t",
    });
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });

  it("정상 입력 → author=me + approval chain snapshot + apology 기본", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockResolveApprovalChain.mockResolvedValue(approverChain);
    // incident_id prefill 조회 (incidents maybeSingle) — 연결 사고 미발견으로 입력값 그대로 사용
    mockSelectMaybeSingle.mockReturnValue({ data: null, error: null });
    mockInsertResult.mockReturnValue({ data: baseRow, error: null });

    const r = await createIncidentReport({
      incident_id: SAMPLE_INCIDENT_ID,
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

  it("incident_id 만 입력 + 사고 발견 → 수신대학·제목·4섹션 사고에서 파생", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockResolveApprovalChain.mockResolvedValue(approverChain);
    mockSelectMaybeSingle.mockReturnValue({
      data: {
        university_name: "조선대학교",
        title: "원서 작성페이지 오류",
        cause_summary: "경위 내용",
        root_cause: "원인 내용",
        resolution: "처리 내용",
        prevention: "대책 내용",
      },
      error: null,
    });
    mockInsertResult.mockReturnValue({ data: baseRow, error: null });

    const r = await createIncidentReport({ incident_id: SAMPLE_INCIDENT_ID });
    expect(r.ok).toBe(true);
    const payload = insertPayloads[0] as Record<string, unknown>;
    expect(payload.recipient_university).toBe("조선대학교");
    expect(payload.title).toBe("원서 작성페이지 오류");
    expect(payload.gyeongwi).toBe("경위 내용");
    expect(payload.prevention).toBe("대책 내용");
  });

  it("사고 미발견 + 수신대학·제목 입력 없음 → ok:false (사고 정보 없음 가드)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValue({ data: null, error: null });
    const r = await createIncidentReport({ incident_id: SAMPLE_INCIDENT_ID });
    expect(r.ok).toBe(false);
  });

  it("incident_id 누락 → zod 실패 (ok:false)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    const r = await createIncidentReport({
      recipient_university: "건국대",
      title: "t",
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

  it("승인 시 연결 사고의 공유 필드를 경위서 스냅샷으로 동결 복사한다", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle
      // rep 조회 (incident_id 포함)
      .mockReturnValueOnce({
        data: {
          status: "pending_approval",
          approver_email: meOperator.email,
          title: "t",
          incident_id: "inc-1",
        },
        error: null,
      })
      // 연결 사고 조회 (공유 필드)
      .mockReturnValueOnce({
        data: {
          university_name: "조선대학교",
          service_name: "수시모집",
          title: "사고 제목X",
          cause_summary: "경위X",
          root_cause: "원인X",
          handling_rows: [{ time: "09.27", content: "처리X" }],
          resolution: "처리텍스트",
          prevention: "대책X",
        },
        error: null,
      })
      // transition 상태 확인
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
    expect(patch.recipient_university).toBe("조선대학교");
    expect(patch.service_name).toBe("수시모집");
    expect(patch.title).toBe("사고 제목X");
    expect(patch.gyeongwi).toBe("경위X");
    expect(patch.cause).toBe("원인X");
    expect(patch.prevention).toBe("대책X");
    expect(patch.handling_rows).toEqual([{ time: "09.27", content: "처리X" }]);
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

describe("revokeApproval", () => {
  it("승인자/admin 아님 → 승인 취소 권한 없음", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValue({
      data: { approver_email: "other@jinhakapply.com", title: "t" },
      error: null,
    });
    const r = await revokeApproval(baseRow.id);
    expect(r).toEqual({ ok: false, error: "승인 취소 권한이 없습니다." });
  });

  it("승인자 일치 + approved → draft (approved_at 초기화)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({
        data: { approver_email: meOperator.email, title: "t" },
        error: null,
      })
      .mockReturnValueOnce({ data: { status: "approved" }, error: null });
    mockUpdateResult.mockReturnValue({
      data: { ...baseRow, status: "draft" },
      error: null,
    });
    const r = await revokeApproval(baseRow.id);
    expect(r.ok).toBe(true);
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.status).toBe("draft");
    expect(patch.approved_at).toBeNull();
  });
});

describe("revokeSend", () => {
  const adminOperator = { ...meOperator, permission: "admin" };

  it("admin 아님 → 발송 취소 권한 없음 (select 안 함)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator); // member
    const r = await revokeSend(baseRow.id);
    expect(r).toEqual({ ok: false, error: "발송 취소는 관리자만 가능합니다." });
  });

  it("admin + sent → approved", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({ data: { title: "t" }, error: null })
      .mockReturnValueOnce({ data: { status: "sent" }, error: null });
    mockUpdateResult.mockReturnValue({
      data: { ...baseRow, status: "approved" },
      error: null,
    });
    const r = await revokeSend(baseRow.id);
    expect(r.ok).toBe(true);
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch.status).toBe("approved");
  });

  it("admin + sent 아님(approved) → 취소 불가", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminOperator);
    mockSelectMaybeSingle
      .mockReturnValueOnce({ data: { title: "t" }, error: null })
      .mockReturnValueOnce({ data: { status: "approved" }, error: null });
    const r = await revokeSend(baseRow.id);
    expect(r).toEqual({
      ok: false,
      error: "발송 취소할 수 없는 상태입니다.",
    });
  });
});

describe("issueIncidentReportDocNumber", () => {
  const approvedRep = {
    id: baseRow.id,
    status: "approved",
    doc_number: null,
    recipient_university: "건국대학교",
    title: "전산파일 오류 건",
    author_name: "나",
    author_email: meOperator.email,
    draft_date: "2026-06-02",
    handling_rows: [],
  };

  it("비로그인 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });

  it("이미 doc_number 있으면 그 번호 반환 + 채번 안 함 (멱등)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockAdminMaybeSingle.mockResolvedValue({
      data: { ...approvedRep, doc_number: "운영2606-0205" },
    });
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r).toEqual({ ok: true, docNumber: "운영2606-0205" });
    expect(mockAssignDocNumber).not.toHaveBeenCalled();
    expect(adminUpdatePatches).toHaveLength(0);
  });

  it("status≠approved → docNumber:null + 채번 안 함 (no-op)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockAdminMaybeSingle.mockResolvedValue({
      data: { ...approvedRep, status: "draft" },
    });
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r).toEqual({ ok: true, docNumber: null });
    expect(mockAssignDocNumber).not.toHaveBeenCalled();
  });

  it("approved + 미발번 → assignDocNumber 호출 + doc_number update + 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockAdminMaybeSingle.mockResolvedValue({ data: approvedRep });
    mockAssignDocNumber.mockResolvedValue({ docNumber: "운영2606-0202" });
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r).toEqual({ ok: true, docNumber: "운영2606-0202" });
    expect(mockAssignDocNumber).toHaveBeenCalledTimes(1);
    const patch = adminUpdatePatches[0] as Record<string, unknown>;
    expect(patch.doc_number).toBe("운영2606-0202");
  });

  it("sent + 미발번(과거 누락) → 복구 채번(assignDocNumber 호출)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockAdminMaybeSingle.mockResolvedValue({
      data: { ...approvedRep, status: "sent" },
    });
    mockAssignDocNumber.mockResolvedValue({ docNumber: "운영2606-1001" });
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r).toEqual({ ok: true, docNumber: "운영2606-1001" });
    expect(mockAssignDocNumber).toHaveBeenCalledTimes(1);
  });

  it("경위서 미발견 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockAdminMaybeSingle.mockResolvedValue({ data: null });
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r.ok).toBe(false);
  });

  it("approved + cfg 없음(assignDocNumber null) → docNumber:null", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockAdminMaybeSingle.mockResolvedValue({ data: approvedRep });
    mockAssignDocNumber.mockResolvedValue(null);
    const r = await issueIncidentReportDocNumber(baseRow.id);
    expect(r).toEqual({ ok: true, docNumber: null });
    expect(adminUpdatePatches).toHaveLength(0);
  });
});
