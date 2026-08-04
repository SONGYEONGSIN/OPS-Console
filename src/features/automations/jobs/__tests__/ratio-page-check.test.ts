import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/ratio-audit/audit-requests/enqueue", () => ({
  enqueueLocalAuditRequest: vi.fn(),
  AUTOMATION_REQUESTER: "automation",
}));

import { enqueueLocalAuditRequest } from "@/features/ratio-audit/audit-requests/enqueue";
import { runRatioPageCheck } from "../ratio-page-check";

describe("runRatioPageCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("페이지 점검(kind=page)으로 로컬 큐에 적재한다", async () => {
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: true,
      message: "로컬 실행을 요청했습니다.",
    });

    const r = await runRatioPageCheck();

    expect(r.ok).toBe(true);
    // 세 번째 인자가 종류 — 이게 빠지면 스케줄 점검이 대신 돌아간다.
    expect(enqueueLocalAuditRequest).toHaveBeenCalledWith(
      "automation",
      expect.any(Date),
      "page",
    );
  });

  it("적재 실패 → ok:false + 원인 메시지 전달", async () => {
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: false,
      message: "이미 대기/진행 중인 점검이 있습니다.",
    });

    const r = await runRatioPageCheck();

    expect(r.ok).toBe(false);
    expect(r.message).toContain("대기/진행 중");
  });
});
