import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 경위서 쓰기 잠금(20261126_incident_reports_write_lock.sql) 쪽 action 테스트.
 * 결재·발송 칸은 서버(admin client)만 쓰고, 권한은 action 검사가 전부라 여기서 고정한다.
 * actions.test.ts 가 800줄을 넘어 나눴다 — mock 은 이 파일 몫으로 따로 둔다.
 */

const {
  mockGetCurrentOperator,
  mockResolveApprovalChain,
  mockUpdateResult,
  mockSelectMaybeSingle,
  mockOperatorRow,
  mockAdminUpdateResult,
  mockAdminInsertResult,
  adminUpdatePatches,
  adminInFilters,
  adminInsertPayloads,
  userInFilters,
  insertPayloads,
  updatePatches,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockResolveApprovalChain: vi.fn(),
  mockUpdateResult: vi.fn(),
  mockSelectMaybeSingle: vi.fn(),
  mockOperatorRow: vi.fn(),
  mockAdminUpdateResult: vi.fn(),
  mockAdminInsertResult: vi.fn(),
  adminUpdatePatches: [] as unknown[],
  adminInFilters: [] as { col: string; vals: unknown }[],
  adminInsertPayloads: [] as unknown[],
  userInFilters: [] as { col: string; vals: unknown }[],
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
    // operators 는 생성 권한 판정(canCreateReport) 몫 — 나머지 읽기 순서와 섞이지 않게 따로 둔다.
    from: (table: string) =>
      table === "operators"
        ? {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve(mockOperatorRow()),
              }),
            }),
          }
        : {
            insert: (payload: unknown) => {
              insertPayloads.push(payload);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: null, error: null }),
                }),
              };
            },
            update: (patch: unknown) => {
              updatePatches.push(patch);
              const tail = {
                select: () => ({
                  single: () => Promise.resolve(mockUpdateResult()),
                }),
              };
              return {
                eq: () => ({
                  ...tail,
                  in: (col: string, vals: unknown) => {
                    userInFilters.push({ col, vals });
                    return tail;
                  },
                }),
              };
            },
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve(mockSelectMaybeSingle()),
              }),
            }),
          },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      insert: (payload: unknown) => {
        adminInsertPayloads.push(payload);
        return {
          select: () => ({
            single: () => Promise.resolve(mockAdminInsertResult()),
          }),
        };
      },
      update: (patch: unknown) => {
        adminUpdatePatches.push(patch);
        return {
          eq: () => ({
            in: (col: string, vals: unknown) => {
              adminInFilters.push({ col, vals });
              return {
                select: () => ({
                  single: () => Promise.resolve(mockAdminUpdateResult()),
                }),
              };
            },
          }),
        };
      },
    }),
  })),
}));
vi.mock("../sharepoint-register", () => ({}));

import {
  createIncidentReport,
  updateIncidentReport,
  submitForApproval,
  approveIncidentReport,
  rejectIncidentReport,
  revokeApproval,
  revokeSend,
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
  mockOperatorRow.mockReturnValue({
    data: { permission: "member", status: "active" },
    error: null,
  });
  insertPayloads.length = 0;
  updatePatches.length = 0;
  adminUpdatePatches.length = 0;
  adminInFilters.length = 0;
  adminInsertPayloads.length = 0;
  userInFilters.length = 0;
});

describe("createIncidentReport — 생성은 서버만", () => {
  const SAMPLE_INCIDENT_ID = crypto.randomUUID();

  const input = {
    incident_id: SAMPLE_INCIDENT_ID,
    recipient_university: "건국대학교(서울)",
    title: "결제 오류 경위서",
  };

  for (const [name, row] of [
    ["viewer", { permission: "viewer", status: "active" }],
    ["권한 없음", { permission: null, status: "active" }],
    ["비활성 admin", { permission: "admin", status: "inactive" }],
    ["operators 행 없음", null],
  ] as const) {
    it(`${name} → 경위서 작성 권한이 없습니다 (사고 등록과 같은 기준), 쓰지 않는다`, async () => {
      mockGetCurrentOperator.mockResolvedValue(meOperator);
      mockOperatorRow.mockReturnValue({ data: row, error: null });
      mockSelectMaybeSingle.mockReturnValue({ data: null, error: null });
      mockAdminInsertResult.mockReturnValue({ data: baseRow, error: null });

      const r = await createIncidentReport(input);
      expect(r).toEqual({ ok: false, error: "경위서 작성 권한이 없습니다." });
      expect(adminInsertPayloads).toHaveLength(0);
      expect(insertPayloads).toHaveLength(0);
    });
  }

  it("활성 admin 은 만든다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      ...meOperator,
      permission: "admin",
    });
    mockOperatorRow.mockReturnValue({
      data: { permission: "admin", status: "active" },
      error: null,
    });
    mockResolveApprovalChain.mockResolvedValue(approverChain);
    mockSelectMaybeSingle.mockReturnValue({ data: null, error: null });
    mockAdminInsertResult.mockReturnValue({ data: baseRow, error: null });

    const r = await createIncidentReport(input);
    expect(r.ok).toBe(true);
    expect(adminInsertPayloads).toHaveLength(1);
  });

  it("insert 는 admin client 로만 — authenticated 에게 insert 권한이 없다(20261126 잠금)", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockResolveApprovalChain.mockResolvedValue(approverChain);
    mockSelectMaybeSingle.mockReturnValue({ data: null, error: null });
    mockAdminInsertResult.mockReturnValue({ data: baseRow, error: null });

    const r = await createIncidentReport({
      incident_id: SAMPLE_INCIDENT_ID,
      recipient_university: "건국대학교(서울)",
      title: "결제 오류 경위서",
    });
    expect(r.ok).toBe(true);
    expect(adminInsertPayloads).toHaveLength(1);
    expect(insertPayloads).toHaveLength(0);
    expect(adminInsertPayloads[0]).toMatchObject({
      incident_id: SAMPLE_INCIDENT_ID,
      author_email: meOperator.email,
      status: "draft",
    });
  });
});

describe("updateIncidentReport — 작성자·admin, 작성 중·반려만 (DB 잠금과 두 겹)", () => {
  const adminOperator = { ...meOperator, permission: "admin" };

  beforeEach(() => {
    mockSelectMaybeSingle.mockReset();
    mockUpdateResult.mockReset();
    mockUpdateResult.mockReturnValue({ data: baseRow, error: null });
  });

  function rowOf(author_email: string, status: string) {
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: { author_email, approver_email: "lead@jinhakapply.com", status },
      error: null,
    });
  }

  function expectNoWrite() {
    expect(updatePatches).toHaveLength(0);
    expect(adminUpdatePatches).toHaveLength(0);
  }

  it("비로그인 → 에러", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
    expectNoWrite();
  });

  for (const status of ["approved", "sent", "pending_approval"]) {
    it(`${status} 은 작성자여도 거절 — 쓰지 않는다`, async () => {
      mockGetCurrentOperator.mockResolvedValue(meOperator);
      rowOf(meOperator.email, status);
      const r = await updateIncidentReport(baseRow.id, { apology: "x" });
      expect(r).toEqual({
        ok: false,
        error: "작성 중이거나 반려된 경위서만 고칠 수 있습니다.",
      });
      expectNoWrite();
    });
  }

  it("비작성자 member 는 거절", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    rowOf("other@jinhakapply.com", "draft");
    const r = await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(r).toEqual({ ok: false, error: "수정 권한이 없습니다." });
    expectNoWrite();
  });

  it("승인자(팀장)도 거절 — 본문 편집은 작성자·admin 만(결정 1-a)", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      ...meOperator,
      email: "lead@jinhakapply.com",
    });
    rowOf(meOperator.email, "draft");
    const r = await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(r).toEqual({ ok: false, error: "수정 권한이 없습니다." });
    expectNoWrite();
  });

  it("경위서가 없으면 거절", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValueOnce({ data: null, error: null });
    const r = await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(r).toEqual({ ok: false, error: "경위서를 찾을 수 없습니다." });
    expectNoWrite();
  });

  for (const status of ["draft", "rejected"]) {
    it(`작성자 + ${status} → 사용자 client 로 저장`, async () => {
      mockGetCurrentOperator.mockResolvedValue(meOperator);
      rowOf(meOperator.email, status);
      const r = await updateIncidentReport(baseRow.id, {
        apology: "새 사과문",
      });
      expect(r.ok).toBe(true);
      expect(updatePatches).toHaveLength(1);
      expect(adminUpdatePatches).toHaveLength(0);
      expect(updatePatches[0]).toMatchObject({ apology: "새 사과문" });
    });
  }

  it("update 에 상태 조건을 건다 — 읽은 뒤 제출·승인돼도 덮어쓰지 않는다", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    rowOf(meOperator.email, "draft");
    await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(userInFilters).toEqual([
      { col: "status", vals: ["draft", "rejected"] },
    ]);
  });

  it("읽은 뒤 상태가 바뀌어 0행(PGRST116)이면 한국어 문구로 거절", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    rowOf(meOperator.email, "draft");
    mockUpdateResult.mockReturnValue({
      data: null,
      error: {
        code: "PGRST116",
        message: "JSON object requested, multiple (or no) rows returned",
      },
    });
    const r = await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(r).toEqual({
      ok: false,
      error: "작성 중이거나 반려된 경위서만 고칠 수 있습니다.",
    });
  });

  it("admin 은 남의 draft 도 저장", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminOperator);
    rowOf("other@jinhakapply.com", "draft");
    const r = await updateIncidentReport(baseRow.id, { apology: "x" });
    expect(r.ok).toBe(true);
    expect(updatePatches).toHaveLength(1);
  });

  it("입력의 incident_id 는 patch 에 실리지 않는다", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    rowOf(meOperator.email, "draft");
    await updateIncidentReport(baseRow.id, {
      incident_id: crypto.randomUUID(),
      apology: "x",
    });
    const patch = updatePatches[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("incident_id");
    expect(Object.keys(patch).sort()).toEqual(["apology", "updated_at"]);
  });
});

describe("상태 전이 — admin client 로 쓰고 update 에 상태 조건을 건다", () => {
  const adminOperator = { ...meOperator, permission: "admin" };

  const cases: {
    name: string;
    run: () => Promise<unknown>;
    me: typeof meOperator;
    rep: Record<string, unknown>;
    from: string[];
  }[] = [
    {
      name: "submitForApproval",
      run: () => submitForApproval(baseRow.id),
      me: meOperator,
      rep: {
        author_email: meOperator.email,
        approver_email: "lead@jinhakapply.com",
      },
      from: ["draft", "rejected"],
    },
    {
      name: "approveIncidentReport",
      run: () => approveIncidentReport(baseRow.id),
      me: meOperator,
      rep: { approver_email: meOperator.email, title: "t", incident_id: null },
      from: ["pending_approval"],
    },
    {
      name: "rejectIncidentReport",
      run: () => rejectIncidentReport(baseRow.id, "보완"),
      me: meOperator,
      rep: { approver_email: meOperator.email, title: "t" },
      from: ["pending_approval"],
    },
    {
      name: "revokeApproval",
      run: () => revokeApproval(baseRow.id),
      me: meOperator,
      rep: { approver_email: meOperator.email, title: "t", doc_number: null },
      from: ["approved"],
    },
    {
      name: "revokeSend",
      run: () => revokeSend(baseRow.id),
      me: adminOperator,
      rep: { title: "t" },
      from: ["sent"],
    },
  ];

  for (const c of cases) {
    it(`${c.name} — admin client update + .in("status", ${JSON.stringify(c.from)}), 사용자 client 로는 안 쓴다`, async () => {
      mockGetCurrentOperator.mockResolvedValue(c.me);
      mockSelectMaybeSingle
        .mockReturnValueOnce({ data: c.rep, error: null })
        .mockReturnValueOnce({ data: { status: c.from[0] }, error: null });
      mockAdminUpdateResult.mockReturnValue({ data: baseRow, error: null });

      const r = (await c.run()) as { ok: boolean };
      expect(r.ok).toBe(true);
      expect(adminUpdatePatches).toHaveLength(1);
      expect(adminInFilters).toEqual([{ col: "status", vals: c.from }]);
      expect(updatePatches).toHaveLength(0);
    });

    it(`${c.name} — 읽은 뒤 상태가 바뀌어 0행이면(PGRST116) 실패로 돌려준다`, async () => {
      mockGetCurrentOperator.mockResolvedValue(c.me);
      mockSelectMaybeSingle
        .mockReturnValueOnce({ data: c.rep, error: null })
        .mockReturnValueOnce({ data: { status: c.from[0] }, error: null });
      mockAdminUpdateResult.mockReturnValue({
        data: null,
        error: {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
        },
      });

      const r = (await c.run()) as { ok: boolean; error?: string };
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/할 수 없는 상태입니다\.$/);
    });
  }
});

describe("권한 없음 — 어느 client 로도 쓰지 않는다 (admin client 로 옮긴 뒤 권한은 action 검사가 전부)", () => {
  // clearAllMocks 는 mockReturnValueOnce 대기열을 안 비운다 — 안 쓰인 armWrite 값이 다음 테스트로 새면
  // 엉뚱한 행으로 거절되어 검사가 빠져도 초록이 된다.
  beforeEach(() => {
    mockSelectMaybeSingle.mockReset();
    mockAdminUpdateResult.mockReset();
  });

  function expectNoWrite() {
    expect(updatePatches).toHaveLength(0);
    expect(insertPayloads).toHaveLength(0);
    expect(adminUpdatePatches).toHaveLength(0);
    expect(adminInsertPayloads).toHaveLength(0);
  }

  // 권한 검사를 통과하면 쓰기가 일어나도록 다음 읽기(상태)와 update 결과를 열어 둔다 —
  // 검사가 빠지면 이 테스트가 빨강이 된다.
  function armWrite(status: string) {
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: { status },
      error: null,
    });
    mockAdminUpdateResult.mockReturnValue({ data: baseRow, error: null });
  }

  it("비작성자·비admin 제출", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: {
        author_email: "other@jinhakapply.com",
        approver_email: "lead@jinhakapply.com",
      },
      error: null,
    });
    armWrite("draft");
    const r = await submitForApproval(baseRow.id);
    expect(r).toEqual({ ok: false, error: "제출 권한이 없습니다." });
    expectNoWrite();
  });

  it("비승인자 승인 — admin 도 못 한다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      ...meOperator,
      permission: "admin",
    });
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: {
        approver_email: "lead@jinhakapply.com",
        title: "t",
        incident_id: null,
      },
      error: null,
    });
    armWrite("pending_approval");
    const r = await approveIncidentReport(baseRow.id);
    expect(r).toEqual({ ok: false, error: "승인 권한이 없습니다." });
    expectNoWrite();
  });

  it("비승인자 반려", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: { approver_email: "lead@jinhakapply.com", title: "t" },
      error: null,
    });
    armWrite("pending_approval");
    const r = await rejectIncidentReport(baseRow.id, "x");
    expect(r).toEqual({ ok: false, error: "반려 권한이 없습니다." });
    expectNoWrite();
  });

  it("비승인자·비admin 승인 취소", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: {
        approver_email: "lead@jinhakapply.com",
        title: "t",
        doc_number: null,
      },
      error: null,
    });
    armWrite("approved");
    const r = await revokeApproval(baseRow.id);
    expect(r).toEqual({ ok: false, error: "승인 취소 권한이 없습니다." });
    expectNoWrite();
  });

  it("비admin 발송 취소", async () => {
    mockGetCurrentOperator.mockResolvedValue(meOperator);
    mockSelectMaybeSingle.mockReturnValueOnce({
      data: { title: "t" },
      error: null,
    });
    armWrite("sent");
    const r = await revokeSend(baseRow.id);
    expect(r).toEqual({ ok: false, error: "발송 취소는 관리자만 가능합니다." });
    expectNoWrite();
  });
});
