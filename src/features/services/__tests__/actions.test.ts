import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockInsert,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: () => ({
        select: () => ({ single: mockInsert }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({ single: mockUpdate }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          select: () => ({ maybeSingle: mockDelete }),
        }),
      }),
    }),
  })),
}));

import { createService, updateService, deleteService } from "../actions";

const adminMe = {
  email: "admin@x.com",
  displayName: "admin",
  role: "팀장",
  team: "운영2팀" as const,
  operator: null,
  permission: "admin" as const,
  allowedMenus: [] as string[],
};

const memberMe = { ...adminMe, email: "member@x.com", permission: "member" as const };
const viewerMe = { ...adminMe, email: "viewer@x.com", permission: "viewer" as const };

const validInput = {
  service_id: 1234567,
  application_type: "공통원서",
  region: "서울",
  university_name: "○○대학교",
  service_name: "2026 수시",
  university_type: "4년제",
  category: "수시",
  operator_email: null,
  operator_name: null,
  developer_email: null,
  developer_name: null,
  write_start_at: null,
  write_end_at: null,
  pay_start_at: null,
  pay_end_at: null,
  solo: false,
  source: "folio_create",
};

beforeEach(() => {
  mockGetCurrentOperator.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

describe("createService", () => {
  it("viewer → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await createService(validInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/권한/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("미인증 → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const r = await createService(validInput);
    expect(r.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("zod 실패 입력 → 거부", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    const r = await createService({ ...validInput, university_name: "" });
    expect(r.ok).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("member → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockInsert.mockResolvedValue({
      data: { id: "x", ...validInput },
      error: null,
    });
    const r = await createService(validInput);
    expect(r.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("admin → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(adminMe);
    mockInsert.mockResolvedValue({
      data: { id: "x", ...validInput },
      error: null,
    });
    const r = await createService(validInput);
    expect(r.ok).toBe(true);
  });

  it("service_id 충돌(23505) → 한국어 매핑", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockInsert.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const r = await createService(validInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/이미 존재|service_id/);
  });
});

describe("updateService", () => {
  it("viewer → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await updateService("x", { category: "정시" });
    expect(r.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("member → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockUpdate.mockResolvedValue({ data: { id: "x" }, error: null });
    const r = await updateService("x", { category: "정시" });
    expect(r.ok).toBe(true);
  });

  it("service_id 충돌(23505) → 한국어 매핑", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockUpdate.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const r = await updateService("x", { service_id: 1234567 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/이미 존재|service_id/);
  });
});

describe("deleteService", () => {
  it("viewer → 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue(viewerMe);
    const r = await deleteService("x");
    expect(r.ok).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("member → 통과", async () => {
    mockGetCurrentOperator.mockResolvedValue(memberMe);
    mockDelete.mockResolvedValue({ data: { id: "x" }, error: null });
    const r = await deleteService("x");
    expect(r.ok).toBe(true);
  });
});
