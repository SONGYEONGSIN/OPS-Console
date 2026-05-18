import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockSelect, mockGetCurrentOperator } = vi.hoisted(
  () => {
    const mockSelect = vi.fn();
    const builder: Record<string, unknown> = {};
    const chain =
      (..._args: unknown[]) =>
      () => {
        return builder;
      };
    builder.select = (...args: unknown[]) => {
      mockSelect(...args);
      return builder;
    };
    builder.eq = chain();
    builder.order = chain();
    builder.in = chain();
    builder.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(mockSelect.mock.results.at(-1)?.value ?? {
        data: [],
        error: null,
      }).then(onFulfilled);
    const mockCreateClient = vi.fn(async () => ({ from: () => builder }));
    const mockGetCurrentOperator = vi.fn();
    return { mockCreateClient, mockSelect, mockGetCurrentOperator };
  },
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));

import {
  listMyProjects,
  listProjectTasks,
  listMyProjectsWithTasks,
} from "../queries";

const validProject = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "신제품 프로모션",
  description: null,
  owner_email: "me@x.com",
  start_at: "2026-05-20",
  end_at: "2026-06-30",
  priority: "high",
  progress: 30,
  status: "in_progress",
  created_by_email: "me@x.com",
  created_at: "2026-05-18T00:00:00Z",
  updated_at: "2026-05-18T00:00:00Z",
};

const validTask = {
  id: "22222222-2222-4222-8222-222222222222",
  project_id: validProject.id,
  name: "블로그 포스팅",
  assignee_email: "me@x.com",
  start_at: "2026-05-22",
  end_at: "2026-05-23",
  priority: "medium",
  progress: 50,
  status: "in_progress",
  created_by_email: "me@x.com",
  created_at: "2026-05-18T00:00:00Z",
  updated_at: "2026-05-18T00:00:00Z",
};

describe("listMyProjects", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("미로그인 — 빈 배열 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue(null);
    const result = await listMyProjects();
    expect(result).toEqual([]);
  });

  it("로그인 + projects 1건 — parse 후 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    mockSelect.mockReturnValue({ data: [validProject], error: null });
    const result = await listMyProjects();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("신제품 프로모션");
  });

  it("supabase 에러 — 빈 배열 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    mockSelect.mockReturnValue({
      data: null,
      error: { message: "boom" },
    });
    const result = await listMyProjects();
    expect(result).toEqual([]);
  });
});

describe("listProjectTasks", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("projectId 입력 → task 배열 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    mockSelect.mockReturnValue({ data: [validTask], error: null });
    const result = await listProjectTasks(validProject.id);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("블로그 포스팅");
  });
});

describe("listMyProjectsWithTasks", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockGetCurrentOperator.mockReset();
  });

  it("projects + tasks 병합 반환", async () => {
    mockGetCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    // 첫 select: projects, 두 번째 select: tasks
    mockSelect
      .mockReturnValueOnce({ data: [validProject], error: null })
      .mockReturnValueOnce({ data: [validTask], error: null });
    const result = await listMyProjectsWithTasks();
    expect(result).toHaveLength(1);
    expect(result[0]?.project.id).toBe(validProject.id);
    expect(result[0]?.tasks).toHaveLength(1);
    expect(result[0]?.tasks[0]?.name).toBe("블로그 포스팅");
  });
});
