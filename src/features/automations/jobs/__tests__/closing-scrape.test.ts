import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/closing/scrape-requests/enqueue", () => ({
  enqueueLocalScrapeRequest: vi.fn(),
  AUTOMATION_REQUESTER: "automation",
}));

import { enqueueLocalScrapeRequest } from "@/features/closing/scrape-requests/enqueue";
import { runClosingScrape } from "../closing-scrape";

describe("runClosingScrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로컬 큐에 requested_by='automation'으로 1건 적재", async () => {
    vi.mocked(enqueueLocalScrapeRequest).mockResolvedValue({
      ok: true,
      message: "로컬 실행을 요청했습니다.",
    });

    const r = await runClosingScrape();

    expect(r.ok).toBe(true);
    expect(enqueueLocalScrapeRequest).toHaveBeenCalledTimes(1);
    expect(enqueueLocalScrapeRequest).toHaveBeenCalledWith("automation");
  });

  it("적재 실패 → ok:false + 원인 메시지 전달", async () => {
    vi.mocked(enqueueLocalScrapeRequest).mockResolvedValue({
      ok: false,
      message: "이미 대기/진행 중인 요청이 있습니다.",
    });

    const r = await runClosingScrape();

    expect(r.ok).toBe(false);
    expect(r.message).toContain("대기/진행 중");
  });

  it("GitHub workflow_dispatch를 더 이상 호출하지 않는다", async () => {
    vi.mocked(enqueueLocalScrapeRequest).mockResolvedValue({
      ok: true,
      message: "ok",
    });

    await runClosingScrape();

    // dispatch-workflow 모듈이 제거됐으므로 import 자체가 없어야 한다.
    const mod = await import("../closing-scrape");
    expect(Object.keys(mod)).toEqual(["runClosingScrape"]);
  });
});
