import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockCreateAiTip,
  mockCandidateSelect,
  mockUpdate,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockCreateAiTip: vi.fn(),
  mockCandidateSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("@/features/ai-tips/actions", () => ({ createAiTip: mockCreateAiTip }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mockCandidateSelect }) }),
      update: () => ({ eq: mockUpdate }),
    }),
  })),
}));

import { promoteCandidate, hideCandidate } from "../actions";

const candidate = {
  id: "11111111-1111-4111-8111-111111111111",
  repo_full_name: "a/one",
  repo_url: "https://github.com/a/one",
  stars: 300,
  repo_description: "설명",
  draft_title: "제목",
  draft_summary_md: "요약",
  draft_reuse_prompt: "프롬프트",
  draft_tags: ["자동화"],
  draft_ai_tool: "claude",
  draft_category: "automation",
  status: "pending",
  collected_at: "2026-08-11T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentOperator.mockResolvedValue({
    email: "me@x.com",
    permission: "member",
  });
  mockCandidateSelect.mockResolvedValue({ data: candidate, error: null });
  mockCreateAiTip.mockResolvedValue({ ok: true, row: { id: "tip-1" } });
  mockUpdate.mockResolvedValue({ error: null });
});

describe("promoteCandidate", () => {
  it("초안으로 TIP을 만든다", async () => {
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(true);
    expect(mockCreateAiTip).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "제목",
        summary_md: "요약",
        reuse_prompt: "프롬프트",
      }),
    );
  });

  it("초안이 없으면 리포 정보로 최소값을 채운다 — TIP은 요약·프롬프트가 필수다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: {
        ...candidate,
        draft_title: null,
        draft_summary_md: null,
        draft_reuse_prompt: null,
        draft_ai_tool: null,
        draft_category: null,
      },
      error: null,
    });
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(true);
    const arg = mockCreateAiTip.mock.calls[0][0];
    expect(arg.title).toContain("a/one");
    expect(arg.summary_md.length).toBeGreaterThan(0);
    expect(arg.reuse_prompt.length).toBeGreaterThan(0);
  });

  it("TIP 생성이 실패하면 후보 상태를 바꾸지 않는다", async () => {
    mockCreateAiTip.mockResolvedValue({ ok: false, error: "권한 없음" });
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("없는 후보면 실패한다", async () => {
    mockCandidateSelect.mockResolvedValue({ data: null, error: null });
    expect((await promoteCandidate(candidate.id)).ok).toBe(false);
  });

  it("viewer는 등록할 수 없다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@x.com",
      permission: "viewer",
    });
    expect((await promoteCandidate(candidate.id)).ok).toBe(false);
    expect(mockCreateAiTip).not.toHaveBeenCalled();
  });
});

describe("hideCandidate", () => {
  it("상태를 hidden으로 바꾼다", async () => {
    expect((await hideCandidate(candidate.id)).ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("viewer는 숨길 수 없다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@x.com",
      permission: "viewer",
    });
    expect((await hideCandidate(candidate.id)).ok).toBe(false);
  });
});
