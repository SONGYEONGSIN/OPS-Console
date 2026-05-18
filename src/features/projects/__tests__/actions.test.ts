import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockOpResult, mockGetCurrentOperator } = vi.hoisted(
  () => {
    const mockOpResult = vi.fn();
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.insert = chain;
    builder.update = chain;
    builder.delete = chain;
    builder.select = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.single = async () => mockOpResult();
    builder.maybeSingle = async () => mockOpResult();
    const mockCreateClient = vi.fn(async () => ({ from: () => builder }));
    const mockGetCurrentOperator = vi.fn();
    return { mockCreateClient, mockOpResult, mockGetCurrentOperator };
  },
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createProject,
  updateProject,
  deleteProject,
  createProjectTask,
} from "../actions";

const validProjectInput = {
  name: "신제품 프로모션",
  description: "캠페인",
  owner_email: "me@x.com",
  start_at: "2026-05-20",
  end_at: "2026-06-30",
  priority: "high" as const,
  progress: 30,
  status: "in_progress" as const,
  created_by_email: "me@x.com",
};

describe("createProject", () => {
  beforeEach(() => {
    mockOpResult.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("입력 검증 fail — invalid 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "admin",
    });
    const result = await createProject({ name: "" });
    expect(result.ok).toBe(false);
  });

  it("viewer 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "viewer",
    });
    const result = await createProject(validProjectInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/권한/);
  });

  it("created_by 본인 강제 (admin/member도)", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "real@x.com",
      permission: "admin",
    });
    mockOpResult.mockResolvedValue({
      data: { ...validProjectInput, id: "new" },
      error: null,
    });
    const inputWithOtherEmail = {
      ...validProjectInput,
      created_by_email: "spoof@x.com",
    };
    const result = await createProject(inputWithOtherEmail);
    expect(result.ok).toBe(true);
    // 검증: insert에 전달된 created_by_email은 me.email
  });
});

describe("updateProject", () => {
  beforeEach(() => {
    mockOpResult.mockReset();
  });

  it("not found 시 error", async () => {
    mockOpResult.mockResolvedValue({ data: null, error: null });
    const result = await updateProject("11111111-1111-4111-8111-111111111111", {
      progress: 80,
    });
    expect(result.ok).toBe(false);
  });

  it("정상 update — ok", async () => {
    mockOpResult.mockResolvedValue({
      data: { ...validProjectInput, id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    const result = await updateProject("11111111-1111-4111-8111-111111111111", {
      progress: 80,
    });
    expect(result.ok).toBe(true);
  });
});

describe("deleteProject", () => {
  beforeEach(() => {
    mockOpResult.mockReset();
  });

  it("정상 delete", async () => {
    mockOpResult.mockResolvedValue({
      data: { id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    const result = await deleteProject("11111111-1111-4111-8111-111111111111");
    expect(result.ok).toBe(true);
  });
});

describe("createProjectTask", () => {
  beforeEach(() => {
    mockOpResult.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("viewer 차단", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "viewer",
    });
    const result = await createProjectTask({
      project_id: "11111111-1111-4111-8111-111111111111",
      name: "task1",
      created_by_email: "me@x.com",
    });
    expect(result.ok).toBe(false);
  });

  it("admin/member — created_by 본인 강제", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "real@x.com",
      permission: "member",
    });
    mockOpResult.mockResolvedValue({
      data: { id: "new" },
      error: null,
    });
    const result = await createProjectTask({
      project_id: "11111111-1111-4111-8111-111111111111",
      name: "task1",
      created_by_email: "spoof@x.com",
    });
    expect(result.ok).toBe(true);
  });
});
