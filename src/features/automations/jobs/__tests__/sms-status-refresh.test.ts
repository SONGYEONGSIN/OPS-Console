import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/sms-sender/status-refresh/enqueue", () => ({
  enqueueStatusRefresh: vi.fn(),
  STATUS_REFRESH_AUTOMATION_REQUESTER: "automation",
}));

import { QUEUED_MARK } from "@/features/automations/run-log-kind";
import { enqueueStatusRefresh } from "@/features/sms-sender/status-refresh/enqueue";
import { runSmsStatusRefresh } from "../sms-status-refresh";

describe("runSmsStatusRefresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("자동화 요청자로 적재하고 접수 표식을 붙인다 — 성공으로 보이지 않게", async () => {
    vi.mocked(enqueueStatusRefresh).mockResolvedValue({
      ok: true,
      message: "회사 PC 에 요청했습니다.",
    });
    const r = await runSmsStatusRefresh();
    expect(enqueueStatusRefresh).toHaveBeenCalledWith("automation");
    expect(r).toEqual({
      ok: true,
      message: `${QUEUED_MARK} 회사 PC 에 요청했습니다.`,
    });
  });

  it("적재가 막히면 ok:false 와 그 이유", async () => {
    vi.mocked(enqueueStatusRefresh).mockResolvedValue({
      ok: false,
      message: "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.",
    });
    const r = await runSmsStatusRefresh();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("이미 대기/진행 중인 최신화가 있습니다.");
  });
});
