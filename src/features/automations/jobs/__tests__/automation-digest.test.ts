import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  getAutomationStatuses: vi.fn(),
  getAutomationRunLog: vi.fn(),
  sendAutomationReport: vi.fn(),
}));

vi.mock("../../queries", () => ({
  getAutomationStatuses: h.getAutomationStatuses,
}));
vi.mock("../../run-logs", () => ({
  getAutomationRunLog: h.getAutomationRunLog,
}));
vi.mock("../../report-send", () => ({
  sendAutomationReport: h.sendAutomationReport,
}));

import { runAutomationDigest } from "../automation-digest";

const status = (over: Record<string, unknown> = {}) => ({
  id: "job-a",
  label: "잡 A",
  description: "",
  scheduleInfo: "",
  cadence: "weekday" as const,
  cooldownMinutes: 0,
  lastRunAt: "2026-08-06T09:00:00+09:00",
  cooldownRemainingMinutes: 0,
  enabled: true,
  localOnly: false,
  manualOnly: false,
  ...over,
});

describe("runAutomationDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T11:00:00+09:00"));
    h.getAutomationRunLog.mockResolvedValue([]);
    h.sendAutomationReport.mockResolvedValue({ sent: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("자기 자신은 집계에서 뺀다 — 보고가 보고를 보고하면 소음이다", async () => {
    h.getAutomationStatuses.mockResolvedValue([
      status(),
      status({ id: "automation-digest", label: "자동화 일일 보고" }),
    ]);
    const result = await runAutomationDigest();
    expect(h.getAutomationRunLog).toHaveBeenCalledTimes(1);
    expect(h.getAutomationRunLog).toHaveBeenCalledWith("job-a");
    expect(result.message).toContain("잡 1");
  });

  it("오늘(KST) 실행분만 집계한다", async () => {
    h.getAutomationStatuses.mockResolvedValue([status()]);
    h.getAutomationRunLog.mockResolvedValue([
      {
        ranAt: "2026-08-06T09:08:00+09:00",
        ok: false,
        skipped: false,
        message: "오늘 실패",
      },
      {
        ranAt: "2026-08-05T09:08:00+09:00",
        ok: false,
        skipped: false,
        message: "어제 실패",
      },
    ]);
    const result = await runAutomationDigest();
    const html = h.sendAutomationReport.mock.calls[0][0] as string;
    expect(html).toContain("오늘 실패");
    expect(html).not.toContain("어제 실패");
    expect(result.message).toContain("실패 1");
  });

  it("발송에 성공하면 ok", async () => {
    h.getAutomationStatuses.mockResolvedValue([status()]);
    const result = await runAutomationDigest();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("발송");
  });

  it("DRY RUN이면 보내지 않고도 ok", async () => {
    h.getAutomationStatuses.mockResolvedValue([status()]);
    h.sendAutomationReport.mockResolvedValue({ sent: false, dryRun: true });
    const result = await runAutomationDigest();
    expect(result.ok).toBe(true);
    expect(result.message).toContain("DRY RUN");
  });

  it("발송에 실패하면 ok=false + 사유", async () => {
    h.getAutomationStatuses.mockResolvedValue([status()]);
    h.sendAutomationReport.mockResolvedValue({
      sent: false,
      error: "Teams 위임 토큰 없음",
    });
    const result = await runAutomationDigest();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Teams 위임 토큰 없음");
  });
});
