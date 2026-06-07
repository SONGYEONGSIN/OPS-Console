import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/github/dispatch-workflow", () => ({
  dispatchWorkflow: vi.fn(),
}));

import { dispatchWorkflow } from "@/lib/github/dispatch-workflow";
import { runClosingScrape } from "../closing-scrape";

describe("runClosingScrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatch 성공 → ok:true (워크플로 1회 트리거)", async () => {
    vi.mocked(dispatchWorkflow).mockResolvedValue({ ok: true });

    const r = await runClosingScrape();

    expect(r.ok).toBe(true);
    expect(dispatchWorkflow).toHaveBeenCalledTimes(1);
  });

  it("dispatch 실패 → ok:false + 헬퍼 에러 메시지 전달", async () => {
    vi.mocked(dispatchWorkflow).mockResolvedValue({
      ok: false,
      error: "환경변수 누락: GITHUB_DISPATCH_TOKEN",
    });

    const r = await runClosingScrape();

    expect(r.ok).toBe(false);
    expect(r.message).toContain("GITHUB_DISPATCH_TOKEN");
  });
});
