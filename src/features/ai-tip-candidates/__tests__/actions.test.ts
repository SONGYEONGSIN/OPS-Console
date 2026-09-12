import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetCurrentOperator,
  mockCreateAiTip,
  mockCandidateSelect,
  mockUpdate,
  mockUpdatePayload,
} = vi.hoisted(() => ({
  mockGetCurrentOperator: vi.fn(),
  mockCreateAiTip: vi.fn(),
  mockCandidateSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdatePayload: vi.fn(),
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
      update: (payload: Record<string, unknown>) => {
        mockUpdatePayload(payload);
        return { eq: mockUpdate };
      },
    }),
  })),
}));

import {
  promoteCandidate,
  hideCandidate,
  unhideCandidate,
  promoteCandidateAction,
  hideCandidateAction,
  unhideCandidateAction,
} from "../actions";

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

  it("리포명·설명이 길어도 TIP 스키마 길이 제한(title 80·summary_md 500)에 맞춰 자른다", async () => {
    const longOwner = "o".repeat(60);
    const longRepo = "r".repeat(100);
    mockCandidateSelect.mockResolvedValue({
      data: {
        ...candidate,
        repo_full_name: `${longOwner}/${longRepo}`,
        repo_description: "d".repeat(400),
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
    expect(arg.title.length).toBeLessThanOrEqual(80);
    expect(arg.summary_md.length).toBeLessThanOrEqual(500);
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
describe("promoteCandidate — 상태 가드", () => {
  it("이미 등록된 후보는 다시 등록하지 않는다 — 같은 TIP이 두 벌 생긴다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: { ...candidate, status: "promoted" },
      error: null,
    });
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(false);
    expect(mockCreateAiTip).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("숨긴 후보는 되돌리기 전에는 등록할 수 없다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: { ...candidate, status: "hidden" },
      error: null,
    });
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(false);
    expect(mockCreateAiTip).not.toHaveBeenCalled();
  });
});

describe("hideCandidate — 존재·상태 가드", () => {
  it("없는 후보를 숨기면 실패한다 — update만 하면 조용히 성공한다", async () => {
    mockCandidateSelect.mockResolvedValue({ data: null, error: null });
    const res = await hideCandidate(candidate.id);
    expect(res.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("등록된 후보는 숨길 수 없다 — TIP은 남는데 후보만 사라진다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: { ...candidate, status: "promoted" },
      error: null,
    });
    const res = await hideCandidate(candidate.id);
    expect(res.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("unhideCandidate", () => {
  const hidden = { ...candidate, status: "hidden" };

  it("숨긴 후보를 검토 대기로 되돌린다 — 수집기가 재수집을 안 해 유일한 복구 경로다", async () => {
    mockCandidateSelect.mockResolvedValue({ data: hidden, error: null });
    const res = await unhideCandidate(candidate.id);
    expect(res.ok).toBe(true);
    expect(mockUpdatePayload).toHaveBeenCalledWith({ status: "pending" });
  });

  it("검토 대기 건은 되돌릴 대상이 아니다", async () => {
    mockCandidateSelect.mockResolvedValue({ data: candidate, error: null });
    expect((await unhideCandidate(candidate.id)).ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("등록된 후보는 되돌릴 수 없다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: { ...candidate, status: "promoted" },
      error: null,
    });
    expect((await unhideCandidate(candidate.id)).ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("없는 후보면 실패한다", async () => {
    mockCandidateSelect.mockResolvedValue({ data: null, error: null });
    expect((await unhideCandidate(candidate.id)).ok).toBe(false);
  });

  it("viewer는 되돌릴 수 없다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@x.com",
      permission: "viewer",
    });
    mockCandidateSelect.mockResolvedValue({ data: hidden, error: null });
    expect((await unhideCandidate(candidate.id)).ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("formData 래퍼", () => {
  const form = (id?: string) => {
    const fd = new FormData();
    if (id !== undefined) fd.set("id", id);
    return fd;
  };

  it("promoteCandidateAction — id가 없으면 실패 메시지를 돌려준다", async () => {
    const res = await promoteCandidateAction(undefined, form());
    expect(res.ok).toBe(false);
    expect(res.message.length).toBeGreaterThan(0);
    expect(mockCreateAiTip).not.toHaveBeenCalled();
  });

  it("promoteCandidateAction — 성공하면 ok와 안내 문구를 돌려준다", async () => {
    const res = await promoteCandidateAction(undefined, form(candidate.id));
    expect(res.ok).toBe(true);
    expect(res.message.length).toBeGreaterThan(0);
  });

  it("hideCandidateAction — id가 없으면 실패 메시지를 돌려준다", async () => {
    const res = await hideCandidateAction(undefined, form());
    expect(res.ok).toBe(false);
    expect(res.message.length).toBeGreaterThan(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("unhideCandidateAction — id가 없으면 실패 메시지를 돌려준다", async () => {
    const res = await unhideCandidateAction(undefined, form());
    expect(res.ok).toBe(false);
    expect(res.message.length).toBeGreaterThan(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("unhideCandidateAction — 숨긴 후보를 되돌리고 안내 문구를 돌려준다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: { ...candidate, status: "hidden" },
      error: null,
    });
    const res = await unhideCandidateAction(undefined, form(candidate.id));
    expect(res.ok).toBe(true);
    expect(mockUpdatePayload).toHaveBeenCalledWith({ status: "pending" });
  });
});
