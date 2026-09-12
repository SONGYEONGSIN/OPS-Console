import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockEq, mockOrder } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: mockEq, order: mockOrder }),
    }),
  })),
}));

import { listCandidates } from "../queries";

const base = {
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
  collected_at: "2026-08-11T00:00:00Z",
  // 백필 전 기존 행 모양 — 컬럼은 있고 값은 null('안 물어봤다').
  repo_language: null,
  repo_pushed_at: null,
  repo_synced_at: null,
};

const row = (id: string, status: string) => ({ ...base, id, status });

const PENDING = row("11111111-1111-4111-8111-111111111111", "pending");
const PROMOTED = row("22222222-2222-4222-8222-222222222222", "promoted");
const HIDDEN = row("33333333-3333-4333-8333-333333333333", "hidden");

beforeEach(() => {
  vi.clearAllMocks();
  mockEq.mockReturnValue({ order: mockOrder });
  mockOrder.mockResolvedValue({
    data: [PENDING, PROMOTED, HIDDEN],
    error: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listCandidates", () => {
  it("status로 거르지 않고 전건을 돌려준다 — 숨긴 건을 되돌리려면 화면에 보여야 한다", async () => {
    const rows = await listCandidates();
    expect(rows.map((r) => r.status)).toEqual([
      "pending",
      "promoted",
      "hidden",
    ]);
    expect(mockEq).not.toHaveBeenCalled();
  });

  it("최신 수집순으로 정렬한다", async () => {
    await listCandidates();
    expect(mockOrder).toHaveBeenCalledWith("collected_at", {
      ascending: false,
    });
  });

  it("파싱 실패 행은 건너뛰되 나머지 전건은 그대로 돌려준다", async () => {
    mockOrder.mockResolvedValue({
      data: [PENDING, { ...HIDDEN, repo_url: "그냥-문자열" }, PROMOTED],
      error: null,
    });
    const rows = await listCandidates();
    expect(rows.map((r) => r.id)).toEqual([PENDING.id, PROMOTED.id]);
  });
});
