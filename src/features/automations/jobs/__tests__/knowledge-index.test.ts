import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/knowledge/index-vault", () => ({ indexVault: vi.fn() }));

const { indexVault } = await import("@/features/knowledge/index-vault");
const { runKnowledgeIndex } = await import("../knowledge-index");

beforeEach(() => vi.clearAllMocks());

describe("runKnowledgeIndex", () => {
  it("인덱싱 결과를 그대로 잡 결과로 돌려준다", async () => {
    vi.mocked(indexVault).mockResolvedValue({
      ok: true,
      message: "지식망 10건 — 갱신 2 · 그대로 8 · 삭제 0",
      details: { indexed: 10, updated: 2, unchanged: 8, removed: 0 },
    });

    const r = await runKnowledgeIndex();

    expect(r.ok).toBe(true);
    expect(r.message).toContain("10건");
    expect(r.details?.indexed).toBe(10);
  });

  it("실패도 그대로 전달한다 — 잡이 성공으로 덮지 않는다", async () => {
    // 실패를 삼키면 일일 보고가 '정상'으로 잡아 인덱스가 멈춘 걸 아무도 모른다.
    vi.mocked(indexVault).mockResolvedValue({
      ok: false,
      message: "SHAREPOINT_KNOWLEDGE_FOLDER_ID 환경변수가 필요합니다.",
    });

    const r = await runKnowledgeIndex();

    expect(r.ok).toBe(false);
    expect(r.message).toContain("SHAREPOINT_KNOWLEDGE_FOLDER_ID");
  });
});
