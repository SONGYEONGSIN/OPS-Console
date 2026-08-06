import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AutomationRunEntry } from "../types";

const h = vi.hoisted(() => ({
  insert: vi.fn(),
  getAutomationRunLog: vi.fn(),
  sendAutomationReport: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ insert: h.insert }) }),
}));
vi.mock("../run-logs", () => ({ getAutomationRunLog: h.getAutomationRunLog }));
vi.mock("../report-send", () => ({
  sendAutomationReport: h.sendAutomationReport,
}));

import { recordAutomationRun } from "../run-recorder";

const entry = (over: Partial<AutomationRunEntry> = {}): AutomationRunEntry => ({
  ranAt: "2026-08-06T09:08:00+09:00",
  ok: true,
  skipped: false,
  message: "",
  ...over,
});

describe("recordAutomationRun — 실패 즉시 알림", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.insert.mockResolvedValue({ error: null });
    h.sendAutomationReport.mockResolvedValue({ sent: true });
  });

  it("첫 실패면 보고를 발송한다", async () => {
    h.getAutomationRunLog.mockResolvedValue([
      entry({ ok: false, message: "엑셀 다운로드 타임아웃" }),
      entry({ ok: true }),
    ]);
    await recordAutomationRun("closing-scrape", {
      ok: false,
      message: "엑셀 다운로드 타임아웃",
    });
    expect(h.sendAutomationReport).toHaveBeenCalledTimes(1);
    const html = h.sendAutomationReport.mock.calls[0][0] as string;
    expect(html).toContain("엑셀 다운로드 타임아웃");
    expect(html).toContain("서비스 마감 스크래핑"); // registry의 잡 이름
  });

  it("직전도 실패였으면 발송하지 않는다", async () => {
    h.getAutomationRunLog.mockResolvedValue([
      entry({ ok: false, message: "또 터짐" }),
      entry({ ok: false, message: "터짐" }),
    ]);
    await recordAutomationRun("closing-scrape", {
      ok: false,
      message: "또 터짐",
    });
    expect(h.sendAutomationReport).not.toHaveBeenCalled();
  });

  it("성공이면 발송하지 않는다", async () => {
    h.getAutomationRunLog.mockResolvedValue([entry({ ok: true })]);
    await recordAutomationRun("closing-scrape", {
      ok: true,
      message: "적재 3건",
    });
    expect(h.sendAutomationReport).not.toHaveBeenCalled();
  });

  it("기록은 언제나 남긴다", async () => {
    h.getAutomationRunLog.mockResolvedValue([entry({ ok: true })]);
    await recordAutomationRun("closing-scrape", {
      ok: true,
      message: "적재 3건",
    });
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: "closing-scrape", ok: true }),
    );
  });

  it("알림이 터져도 예외를 올리지 않는다 — 잡 결과를 뒤집으면 안 된다", async () => {
    h.getAutomationRunLog.mockRejectedValue(new Error("DB 조회 실패"));
    await expect(
      recordAutomationRun("closing-scrape", { ok: false, message: "터짐" }),
    ).resolves.toBeUndefined();
  });

  it("등록되지 않은 잡 id면 id를 그대로 제목에 쓴다", async () => {
    h.getAutomationRunLog.mockResolvedValue([
      entry({ ok: false, message: "터짐" }),
    ]);
    await recordAutomationRun("unknown-job", { ok: false, message: "터짐" });
    const html = h.sendAutomationReport.mock.calls[0][0] as string;
    expect(html).toContain("unknown-job");
  });
});
