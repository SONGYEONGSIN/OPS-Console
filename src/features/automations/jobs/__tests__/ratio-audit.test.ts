import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/ratio-audit/audit-requests/enqueue", () => ({
  enqueueLocalAuditRequest: vi.fn(),
  AUTOMATION_REQUESTER: "automation",
}));

import { enqueueLocalAuditRequest } from "@/features/ratio-audit/audit-requests/enqueue";
import { runRatioAudit } from "../ratio-audit";

describe("runRatioAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로컬 큐에 requested_by='automation'으로 1건 적재", async () => {
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: true,
      message: "로컬 실행을 요청했습니다.",
    });

    const r = await runRatioAudit();

    expect(r.ok).toBe(true);
    expect(enqueueLocalAuditRequest).toHaveBeenCalledTimes(1);
    expect(enqueueLocalAuditRequest).toHaveBeenCalledWith("automation");
  });

  it("적재 실패 → ok:false + 원인 메시지 전달", async () => {
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: false,
      message: "이미 대기/진행 중인 요청이 있습니다.",
    });

    const r = await runRatioAudit();

    expect(r.ok).toBe(false);
    expect(r.message).toContain("대기/진행 중");
  });
});
