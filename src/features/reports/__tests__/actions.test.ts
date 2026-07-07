import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("../queries", async () => {
  const actual =
    await vi.importActual<typeof import("../queries")>("../queries");
  return {
    ...actual,
    getReportKpis: vi.fn(async () => ({
      period: "this-month",
      generatedAt: "2026-05-25T10:00:00Z",
      periodRange: { startYmd: "2026-05-01", endYmd: "2026-05-31" },
      kpis: [
        {
          key: "service-open",
          label: "서비스 오픈",
          value: 32,
          prevValue: 31,
          delta: 1,
          deltaPct: 3.2,
          unit: "건",
          goodOnIncrease: true,
        },
      ],
    })),
  };
});

import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReport, updateReportTitle } from "../actions";

function mockAdmin(returnedRow: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({
    data: returnedRow,
    error: returnedRow ? null : { message: "fail" },
  });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { insert, single };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createReport", () => {
  it("viewer 권한 거부", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "v@x.com",
      operator: null,
      displayName: "v",
      role: "",
      team: null,
      permission: "viewer",
      allowedMenus: [],
    });
    const r = await createReport({ title: "X", period: "this-month" });
    expect(r.ok).toBe(false);
  });

  it("member 권한 성공 — KPI 스냅샷 fetch 후 insert", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      operator: null,
      displayName: "m",
      role: "",
      team: null,
      permission: "member",
      allowedMenus: [],
    });
    const { insert } = mockAdmin({ id: "r-1" });
    const r = await createReport({ title: "Q2 리포트", period: "quarter" });
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Q2 리포트",
        period: "quarter",
        created_by: "m@x.com",
        status: "completed",
      }),
    );
  });

  it("입력 검증 실패 (title 빈 값)", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      operator: null,
      displayName: "m",
      role: "",
      team: null,
      permission: "member",
      allowedMenus: [],
    });
    const r = await createReport({ title: "", period: "this-month" });
    expect(r.ok).toBe(false);
  });
});

const UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockAdminUpdate(err: { message: string } | null) {
  const eq = vi.fn().mockResolvedValue({ error: err });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { from, update, eq };
}

function mockOperator(permission: "admin" | "member" | "viewer" | null) {
  vi.mocked(getCurrentOperator).mockResolvedValue({
    email: "m@x.com",
    operator: null,
    displayName: "m",
    role: "",
    team: null,
    permission,
    allowedMenus: [],
  });
}

describe("updateReportTitle", () => {
  it("viewer 권한 거부 — DB 미호출", async () => {
    mockOperator("viewer");
    const { from } = mockAdminUpdate(null);
    const r = await updateReportTitle({ id: UUID, title: "새 제목" });
    expect(r.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("member 권한 성공 — title UPDATE", async () => {
    mockOperator("member");
    const { update, eq } = mockAdminUpdate(null);
    const r = await updateReportTitle({ id: UUID, title: "고친 제목" });
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ title: "고친 제목" });
    expect(eq).toHaveBeenCalledWith("id", UUID);
  });

  it("title 빈 값 → 검증 실패", async () => {
    mockOperator("member");
    mockAdminUpdate(null);
    const r = await updateReportTitle({ id: UUID, title: "" });
    expect(r.ok).toBe(false);
  });

  it("id가 uuid 아님 → 검증 실패", async () => {
    mockOperator("member");
    mockAdminUpdate(null);
    const r = await updateReportTitle({ id: "not-a-uuid", title: "X" });
    expect(r.ok).toBe(false);
  });

  it("DB 에러 → ok:false", async () => {
    mockOperator("admin");
    mockAdminUpdate({ message: "db fail" });
    const r = await updateReportTitle({ id: UUID, title: "X" });
    expect(r.ok).toBe(false);
  });
});
